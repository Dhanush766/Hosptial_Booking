"""
Serializers convert model objects to JSON and validate incoming JSON.

All validation is done here on the server, so it cannot be bypassed from
the React frontend.
"""
import re
from datetime import datetime

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import Appointment, Doctor, Patient


class NormalizeInputMixin:
    """Cleans e-mail (trim, lower-case) and phone (remove spaces/hyphens) before validation."""

    def to_internal_value(self, data):
        if hasattr(data, "get"):
            email = data.get("email")
            phone = data.get("phone_number")
            if isinstance(email, str) or isinstance(phone, str):
                data = data.copy()
                if isinstance(email, str):
                    data["email"] = email.strip().lower()
                if isinstance(phone, str):
                    data["phone_number"] = re.sub(r"[\s-]", "", phone)
        return super().to_internal_value(data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class DoctorSerializer(NormalizeInputMixin, serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = [
            "id",
            "full_name",
            "email",
            "phone_number",
            "specialization",
            "experience_years",
            "consultation_fee",
            "is_available",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_full_name(self, value):
        return " ".join(value.split())

    def validate_specialization(self, value):
        cleaned = " ".join(value.split())
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned


class PatientSerializer(NormalizeInputMixin, serializers.ModelSerializer):
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "full_name",
            "email",
            "phone_number",
            "date_of_birth",
            "age",
            "gender",
            "address",
            "medical_notes",
            "created_at",
        ]
        read_only_fields = ["created_at", "age"]

    def get_age(self, obj):
        today = timezone.localdate()
        born = obj.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    def validate_full_name(self, value):
        return " ".join(value.split())


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    doctor_specialization = serializers.CharField(source="doctor.specialization", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "doctor_specialization",
            "appointment_date",
            "appointment_time",
            "reason",
            "status",
            "notes",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate_appointment_time(self, value):
        opens, closes = settings.CLINIC_OPENS_AT, settings.CLINIC_CLOSES_AT
        if not (opens <= value <= closes):
            raise serializers.ValidationError(
                f"Appointments are available from {opens:%H:%M} to {closes:%H:%M}."
            )
        return value

    def validate_reason(self, value):
        cleaned = " ".join(value.split())
        if not cleaned:
            raise serializers.ValidationError("This field may not be blank.")
        return cleaned

    def validate(self, attrs):
        instance = self.instance
        Status = Appointment.Status

        def current(name):
            """New value if it was sent, otherwise the stored value (for partial updates)."""
            if name in attrs:
                return attrs[name]
            return getattr(instance, name, None)

        doctor = current("doctor")
        date_ = current("appointment_date")
        time_ = current("appointment_time")
        status = current("status") or Status.SCHEDULED

        errors = {}

        if instance is None and status != Status.SCHEDULED:
            errors["status"] = "A new appointment must have the status Scheduled."

        if status == Status.SCHEDULED and not errors:
            slot_changed = instance is None or (
                doctor != instance.doctor
                or date_ != instance.appointment_date
                or time_ != instance.appointment_time
            )
            reopening = instance is not None and instance.status != Status.SCHEDULED

            # 1. Cannot book a time that has already passed.
            if slot_changed or reopening:
                requested = datetime.combine(date_, time_)
                if requested < timezone.localtime().replace(tzinfo=None):
                    errors["appointment_date"] = "Appointment cannot be in the past."

            # 2. The doctor must be accepting appointments.
            if (instance is None or doctor != instance.doctor) and not doctor.is_available:
                errors["doctor"] = f"{doctor.full_name} is not available for appointments."

            # 3. A doctor cannot have two active appointments at the same time.
            clash = Appointment.objects.filter(
                doctor=doctor, appointment_date=date_, appointment_time=time_
            ).exclude(status=Status.CANCELLED)
            if instance is not None:
                clash = clash.exclude(pk=instance.pk)
            if clash.exists():
                errors["appointment_time"] = (
                    f"{doctor.full_name} already has an appointment at this time."
                )

        if errors:
            raise serializers.ValidationError(errors)
        return attrs
