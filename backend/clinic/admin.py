"""Django Admin integration."""
from django.contrib import admin

from .models import Appointment, Doctor, Patient

admin.site.site_header = "Hospital Appointment Booking System - Administration"
admin.site.site_title = "Hospital Admin"
admin.site.index_title = "Manage doctors, patients and appointments"


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "email", "experience_years", "consultation_fee", "is_available")
    list_filter = ("is_available", "specialization")
    search_fields = ("full_name", "email", "specialization")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "phone_number", "gender", "date_of_birth")
    list_filter = ("gender",)
    search_fields = ("full_name", "email", "phone_number")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("appointment_date", "appointment_time", "patient", "doctor", "status")
    list_filter = ("status", "doctor", "appointment_date")
    search_fields = ("patient__full_name", "doctor__full_name", "reason")
    list_select_related = ("patient", "doctor")
    date_hierarchy = "appointment_date"
