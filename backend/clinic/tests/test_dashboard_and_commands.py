from io import StringIO

from django.core.management import call_command
from django.urls import reverse

from clinic.models import Appointment, Doctor, Patient

from .base import BaseAPITestCase, future_date, make_appointment, make_doctor, make_patient


class DashboardApiTests(BaseAPITestCase):
    def test_empty_dashboard(self):
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_doctors"], 0)
        self.assertEqual(response.data["total_appointments"], 0)
        self.assertEqual(response.data["upcoming_appointments"], [])
        self.assertEqual(
            response.data["status_counts"], {"SCHEDULED": 0, "COMPLETED": 0, "CANCELLED": 0}
        )

    def test_dashboard_numbers(self):
        busy = make_doctor(email="a@example.com", full_name="Dr. Busy Doctor")
        idle = make_doctor(email="b@example.com", full_name="Dr. Idle Doctor", is_available=False)
        patient = make_patient()
        make_appointment(busy, patient, appointment_date=future_date(1))
        make_appointment(busy, patient, appointment_date=future_date(2))
        make_appointment(idle, patient, status=Appointment.Status.CANCELLED)

        data = self.client.get(reverse("dashboard")).data
        self.assertEqual(data["total_doctors"], 2)
        self.assertEqual(data["available_doctors"], 1)
        self.assertEqual(data["total_patients"], 1)
        self.assertEqual(data["total_appointments"], 3)
        self.assertEqual(data["status_counts"]["SCHEDULED"], 2)
        self.assertEqual(data["status_counts"]["CANCELLED"], 1)
        self.assertEqual(len(data["upcoming_appointments"]), 2)
        self.assertEqual(data["busiest_doctors"][0]["full_name"], "Dr. Busy Doctor")
        self.assertEqual(data["busiest_doctors"][0]["total"], 2)


class SeedDemoDataTests(BaseAPITestCase):
    def test_seed_is_repeatable(self):
        call_command("seed_demo_data", stdout=StringIO())
        call_command("seed_demo_data", stdout=StringIO())
        self.assertEqual(Doctor.objects.count(), 5)
        self.assertEqual(Patient.objects.count(), 8)
        self.assertEqual(Appointment.objects.count(), 10)
