from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from clinic.models import Doctor, Patient

from .base import (
    BaseAPITestCase,
    doctor_payload,
    make_appointment,
    make_doctor,
    make_patient,
    patient_payload,
)


class DoctorApiTests(BaseAPITestCase):
    def test_create_doctor(self):
        response = self.client.post(reverse("doctor-list"), doctor_payload())
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Doctor.objects.filter(email="suresh@example.com").exists())

    def test_input_is_normalised(self):
        response = self.client.post(
            reverse("doctor-list"),
            doctor_payload(email="  MIXED@Example.COM ", phone_number="+91 90000-11111"),
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["email"], "mixed@example.com")
        self.assertEqual(response.data["phone_number"], "+919000011111")

    def test_invalid_data_is_rejected_with_field_errors(self):
        cases = {
            "email": "not-an-email",
            "phone_number": "12345",
            "full_name": "Dr. 123",
            "consultation_fee": "0",
            "experience_years": "99",
        }
        for field, bad_value in cases.items():
            with self.subTest(field=field):
                response = self.client.post(
                    reverse("doctor-list"), doctor_payload(**{field: bad_value})
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_duplicate_email_is_rejected_ignoring_case(self):
        make_doctor(email="anita@example.com")
        response = self.client.post(
            reverse("doctor-list"), doctor_payload(email="ANITA@example.com")
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_update_doctor(self):
        doctor = make_doctor()
        response = self.client.patch(
            reverse("doctor-detail", args=[doctor.pk]), {"is_available": False}
        )
        self.assertEqual(response.status_code, 200)
        doctor.refresh_from_db()
        self.assertFalse(doctor.is_available)

    def test_search_and_filters(self):
        make_doctor(full_name="Dr. Anita Rao", email="a@example.com", specialization="Cardiology")
        make_doctor(
            full_name="Dr. Suresh Kumar",
            email="s@example.com",
            specialization="Orthopedics",
            is_available=False,
        )
        url = reverse("doctor-list")

        names = lambda params: [d["full_name"] for d in self.client.get(url, params).data["results"]]
        self.assertEqual(names({"search": "anita"}), ["Dr. Anita Rao"])
        self.assertEqual(names({"search": "ortho"}), ["Dr. Suresh Kumar"])
        self.assertEqual(names({"available": "true"}), ["Dr. Anita Rao"])
        self.assertEqual(names({"available": "false"}), ["Dr. Suresh Kumar"])
        self.assertEqual(names({"specialization": "cardio"}), ["Dr. Anita Rao"])
        self.assertEqual(len(names({"available": "maybe"})), 2)  # invalid value ignored

    def test_list_is_paginated(self):
        for number in range(12):
            make_doctor(email=f"doc{number}@example.com", full_name=f"Dr. Name{chr(65 + number)}")
        response = self.client.get(reverse("doctor-list"))
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 10)
        bigger = self.client.get(reverse("doctor-list"), {"page_size": 100})
        self.assertEqual(len(bigger.data["results"]), 12)

    def test_doctor_with_appointments_cannot_be_deleted(self):
        doctor = make_doctor()
        make_appointment(doctor, make_patient())
        response = self.client.delete(reverse("doctor-detail", args=[doctor.pk]))
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Doctor.objects.filter(pk=doctor.pk).exists())

    def test_admin_can_delete_doctor_without_appointments(self):
        doctor = make_doctor()
        response = self.client.delete(reverse("doctor-detail", args=[doctor.pk]))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Doctor.objects.filter(pk=doctor.pk).exists())

    def test_non_admin_cannot_delete_but_can_create(self):
        doctor = make_doctor()
        self.client.force_authenticate(self.receptionist)
        response = self.client.delete(reverse("doctor-detail", args=[doctor.pk]))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Doctor.objects.filter(pk=doctor.pk).exists())
        created = self.client.post(reverse("doctor-list"), doctor_payload())
        self.assertEqual(created.status_code, 201)

    def test_missing_doctor_returns_404(self):
        self.assertEqual(self.client.get(reverse("doctor-detail", args=[9999])).status_code, 404)


class PatientApiTests(BaseAPITestCase):
    def test_create_patient_and_age_is_calculated(self):
        response = self.client.post(reverse("patient-list"), patient_payload())
        self.assertEqual(response.status_code, 201, response.data)
        self.assertGreaterEqual(response.data["age"], 0)

    def test_future_birth_date_is_rejected(self):
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        response = self.client.post(
            reverse("patient-list"), patient_payload(date_of_birth=tomorrow)
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("date_of_birth", response.data)

    def test_invalid_gender_and_phone_are_rejected(self):
        for field, bad_value in {"gender": "X", "phone_number": "abc"}.items():
            with self.subTest(field=field):
                response = self.client.post(
                    reverse("patient-list"), patient_payload(**{field: bad_value})
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.data)

    def test_duplicate_email_is_rejected(self):
        make_patient(email="sunita@example.com")
        response = self.client.post(reverse("patient-list"), patient_payload())
        self.assertEqual(response.status_code, 400)

    def test_search_and_gender_filter(self):
        make_patient(full_name="Rahul Verma", email="r@example.com", gender="M")
        make_patient(full_name="Sunita Devi", email="s@example.com", gender="F", phone_number="9555555555")
        url = reverse("patient-list")
        names = lambda params: [p["full_name"] for p in self.client.get(url, params).data["results"]]
        self.assertEqual(names({"search": "sunita"}), ["Sunita Devi"])
        self.assertEqual(names({"search": "9555"}), ["Sunita Devi"])
        self.assertEqual(names({"gender": "M"}), ["Rahul Verma"])
        self.assertEqual(len(names({"gender": "Z"})), 2)  # invalid value ignored

    def test_update_patient(self):
        patient = make_patient()
        response = self.client.patch(
            reverse("patient-detail", args=[patient.pk]), {"address": "New address"}
        )
        self.assertEqual(response.status_code, 200)
        patient.refresh_from_db()
        self.assertEqual(patient.address, "New address")

    def test_patient_with_appointments_cannot_be_deleted(self):
        patient = make_patient()
        make_appointment(make_doctor(), patient)
        response = self.client.delete(reverse("patient-detail", args=[patient.pk]))
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Patient.objects.filter(pk=patient.pk).exists())

    def test_non_admin_cannot_delete_patient(self):
        patient = make_patient()
        self.client.force_authenticate(self.receptionist)
        self.assertEqual(
            self.client.delete(reverse("patient-detail", args=[patient.pk])).status_code, 403
        )
