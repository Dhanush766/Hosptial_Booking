"""
API views.

Access rules
------------
* Every endpoint except login requires a valid token (HTTP 401 otherwise).
* Any logged-in user may list, view, create and update records.
* Only staff users (administrators) may delete records (HTTP 403 otherwise).
* Deleting a doctor or patient who still has appointments is refused (HTTP 409).
"""
import logging

from django.contrib.auth import authenticate
from django.db.models import Count, Q
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import filters, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Appointment, Doctor, Patient
from .permissions import StaffOnlyDelete
from .serializers import (
    AppointmentSerializer,
    DoctorSerializer,
    LoginSerializer,
    PatientSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
class LoginView(APIView):
    """POST {username, password} -> {token, username, is_staff}."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"  # limited to 10 attempts per minute (see settings)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request=request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED
            )
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "username": user.get_username(), "is_staff": user.is_staff}
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"username": request.user.get_username(), "is_staff": request.user.is_staff})


# ---------------------------------------------------------------------------
# Shared base class for the three resources
# ---------------------------------------------------------------------------
class ClinicViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, StaffOnlyDelete]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    protected_message = "This record cannot be deleted because other records depend on it."

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            logger.info("Blocked deletion of %s: protected by related records.", self.get_object())
            return Response({"detail": self.protected_message}, status=status.HTTP_409_CONFLICT)


# ---------------------------------------------------------------------------
# Doctors, patients, appointments
# ---------------------------------------------------------------------------
class DoctorViewSet(ClinicViewSet):
    """
    GET /api/doctors/?search=&available=true|false&specialization=&page=
    """

    serializer_class = DoctorSerializer
    search_fields = ["full_name", "specialization", "email"]
    ordering_fields = ["full_name", "specialization", "experience_years", "consultation_fee"]
    protected_message = (
        "This doctor cannot be deleted because they have appointments. "
        "Mark the doctor as unavailable instead."
    )

    def get_queryset(self):
        queryset = Doctor.objects.all()
        params = self.request.query_params
        available = params.get("available", "").lower()
        if available in ("true", "false"):
            queryset = queryset.filter(is_available=(available == "true"))
        specialization = params.get("specialization", "").strip()
        if specialization:
            queryset = queryset.filter(specialization__icontains=specialization)
        return queryset


class PatientViewSet(ClinicViewSet):
    """
    GET /api/patients/?search=&gender=M|F|O&page=
    """

    serializer_class = PatientSerializer
    search_fields = ["full_name", "email", "phone_number"]
    ordering_fields = ["full_name", "date_of_birth", "created_at"]
    protected_message = "This patient cannot be deleted because they have appointments."

    def get_queryset(self):
        queryset = Patient.objects.all()
        gender = self.request.query_params.get("gender", "")
        if gender in Patient.Gender.values:
            queryset = queryset.filter(gender=gender)
        return queryset


class AppointmentViewSet(ClinicViewSet):
    """
    GET /api/appointments/?search=&status=&doctor=<id>&patient=<id>&date=YYYY-MM-DD&page=

    Invalid filter values are ignored instead of causing an error.
    """

    serializer_class = AppointmentSerializer
    search_fields = ["patient__full_name", "doctor__full_name", "reason"]
    ordering_fields = ["appointment_date", "appointment_time", "status"]

    def get_queryset(self):
        queryset = Appointment.objects.select_related("patient", "doctor")
        params = self.request.query_params

        if params.get("status") in Appointment.Status.values:
            queryset = queryset.filter(status=params["status"])

        for key in ("doctor", "patient"):
            value = params.get(key, "")
            if value.isdigit():
                queryset = queryset.filter(**{f"{key}_id": int(value)})

        try:
            day = parse_date(params.get("date", ""))
        except ValueError:  # well-formed but impossible date, e.g. 2026-02-31
            day = None
        if day:
            queryset = queryset.filter(appointment_date=day)
        return queryset


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class DashboardView(APIView):
    """GET /api/dashboard/ -> headline numbers for the dashboard page."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        status_counts = dict(
            Appointment.objects.order_by().values_list("status").annotate(total=Count("id"))
        )
        upcoming = Appointment.objects.select_related("patient", "doctor").filter(
            status=Appointment.Status.SCHEDULED, appointment_date__gte=today
        )[:5]
        busiest = Doctor.objects.annotate(
            total=Count("appointments"),
            scheduled=Count(
                "appointments", filter=Q(appointments__status=Appointment.Status.SCHEDULED)
            ),
        ).order_by("-total", "full_name")[:5]

        return Response(
            {
                "total_doctors": Doctor.objects.count(),
                "available_doctors": Doctor.objects.filter(is_available=True).count(),
                "total_patients": Patient.objects.count(),
                "total_appointments": Appointment.objects.count(),
                "todays_appointments": Appointment.objects.filter(
                    appointment_date=today, status=Appointment.Status.SCHEDULED
                ).count(),
                "status_counts": {
                    value: status_counts.get(value, 0) for value in Appointment.Status.values
                },
                "upcoming_appointments": AppointmentSerializer(upcoming, many=True).data,
                "busiest_doctors": [
                    {
                        "id": doctor.id,
                        "full_name": doctor.full_name,
                        "specialization": doctor.specialization,
                        "total": doctor.total,
                        "scheduled": doctor.scheduled,
                    }
                    for doctor in busiest
                ],
            }
        )
