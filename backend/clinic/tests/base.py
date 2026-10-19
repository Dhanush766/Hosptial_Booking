"""Shared helpers for the tests. All data here is fictional and test-only."""
from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from django.utils import timezone

from clinic.models import Appointment, Doctor, Patient

User = get_user_model()


def future_date(days=3):
    return timezone.localdate() + timedelta(days=days)


def make_doctor(**overrides):
    data = {
        "full_name": "Dr. Anita Rao",
        "email": "anita@example.com",
        "phone_number": "9876543210",
        "specialization": "Cardiology",
        "experience_years": 10,
        "consultation_fee": Decimal("500.00"),
        "is_available": True,
    }
    data.update(overrides)
    return Doctor.objects.create(**data)


def make_patient(**overrides):
    data = {
        "full_name": "Rahul Verma",
        "email": "rahul@example.com",
        "phone_number": "9123456780",
        "date_of_birth": date(1990, 5, 14),
        "gender": "M",
    }
    data.update(overrides)
    return Patient.objects.create(**data)


def make_appointment(doctor, patient, **overrides):
    data = {
        "doctor": doctor,
        "patient": patient,
        "appointment_date": future_date(),
        "appointment_time": time(10, 0),
        "reason": "Check-up",
        "status": Appointment.Status.SCHEDULED,
    }
    data.update(overrides)
    return Appointment.objects.create(**data)


def doctor_payload(**overrides):
    data = {
        "full_name": "Dr. Suresh Kumar",
        "email": "suresh@example.com",
        "phone_number": "9000011111",
        "specialization": "Orthopedics",
        "experience_years": 12,
        "consultation_fee": "700.00",
        "is_available": True,
    }
    data.update(overrides)
    return data


def patient_payload(**overrides):
    data = {
        "full_name": "Sunita Devi",
        "email": "sunita@example.com",
        "phone_number": "9000022222",
        "date_of_birth": "1985-02-20",
        "gender": "F",
        "address": "Chennai",
        "medical_notes": "",
    }
    data.update(overrides)
    return data


def appointment_payload(doctor, patient, **overrides):
    data = {
        "doctor": doctor.pk,
        "patient": patient.pk,
        "appointment_date": future_date().isoformat(),
        "appointment_time": "10:00",
        "reason": "Fever",
    }
    data.update(overrides)
    return data


class BaseAPITestCase(APITestCase):
    password = "Test-only-pass-12345"

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(
            "admin", "admin@example.com", cls.password, is_staff=True
        )
        cls.receptionist = User.objects.create_user(
            "reception", "reception@example.com", cls.password
        )

    def setUp(self):
        cache.clear()  # reset the login rate limiter between tests
        self.client.force_authenticate(self.admin)
