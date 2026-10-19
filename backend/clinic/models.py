"""Database models: Doctor, Patient and Appointment."""
from django.core.validators import MaxValueValidator
from django.db import models

from .validators import (
    validate_birth_date,
    validate_person_name,
    validate_phone_number,
    validate_positive_amount,
)


class Doctor(models.Model):
    full_name = models.CharField(max_length=100, validators=[validate_person_name])
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=16, validators=[validate_phone_number])
    specialization = models.CharField(max_length=100)
    experience_years = models.PositiveSmallIntegerField(
        default=0, validators=[MaxValueValidator(60)]
    )
    consultation_fee = models.DecimalField(
        max_digits=8, decimal_places=2, validators=[validate_positive_amount]
    )
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.specialization})"

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)


class Patient(models.Model):
    class Gender(models.TextChoices):
        MALE = "M", "Male"
        FEMALE = "F", "Female"
        OTHER = "O", "Other"

    full_name = models.CharField(max_length=100, validators=[validate_person_name])
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=16, validators=[validate_phone_number])
    date_of_birth = models.DateField(validators=[validate_birth_date])
    gender = models.CharField(max_length=1, choices=Gender.choices)
    address = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    # PROTECT: a patient or doctor that has appointments cannot be deleted.
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="appointments")
    doctor = models.ForeignKey(Doctor, on_delete=models.PROTECT, related_name="appointments")
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    reason = models.CharField(max_length=255)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.SCHEDULED
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["appointment_date", "appointment_time", "id"]
        indexes = [
            models.Index(fields=["appointment_date", "appointment_time"], name="appt_slot_idx"),
            models.Index(fields=["status"], name="appt_status_idx"),
        ]

    def __str__(self):
        return f"{self.patient} with {self.doctor.full_name} on {self.appointment_date} {self.appointment_time}"
