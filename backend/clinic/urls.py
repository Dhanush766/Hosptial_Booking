"""API routes (all are under /api/, see config/urls.py)."""
from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("doctors", views.DoctorViewSet, basename="doctor")
router.register("patients", views.PatientViewSet, basename="patient")
router.register("appointments", views.AppointmentViewSet, basename="appointment")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
