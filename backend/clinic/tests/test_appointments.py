from datetime import time, timedelta

from django.urls import reverse
from django.utils import timezone

from clinic.models import Appointment

from .base import (
    BaseAPITestCase,
    appointment_payload,
    future_date,
    make_appointment,
    make_doctor,
    make_patient,
)


class AppointmentBookingTests(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.doctor = make_doctor()
        cls.patient = make_patient()

    def book(self, **overrides):
        return self.client.post(
            reverse("appointment-list"),
            appointment_payload(self.doctor, self.patient, **overrides),
        )

    def test_book_appointment(self):
        response = self.book()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "SCHEDULED")
        self.assertEqual(response.data["patient_name"], "Rahul Verma")
        self.assertEqual(response.data["doctor_name"], "Dr. Anita Rao")
        self.assertEqual(response.data["doctor_specialization"], "Cardiology")

    def test_past_date_is_rejected(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = self.book(appointment_date=yesterday)
        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_date", response.data)

    def test_time_outside_clinic_hours_is_rejected(self):
        for bad_time in ("07:00", "20:30"):
            with self.subTest(time=bad_time):
                response = self.book(appointment_time=bad_time)
                self.assertEqual(response.status_code, 400)
                self.assertIn("appointment_time", response.data)

    def test_double_booking_the_same_doctor_is_rejected(self):
        self.assertEqual(self.book().status_code, 201)
        other_patient = make_patient(email="other@example.com", full_name="Other Person")
        response = self.client.post(
            reverse("appointment-list"),
            appointment_payload(self.doctor, other_patient),
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_time", response.data)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_different_doctor_can_be_booked_at_the_same_time(self):
        self.assertEqual(self.book().status_code, 201)
        second_doctor = make_doctor(email="second@example.com", full_name="Dr. Second Doctor")
        response = self.client.post(
            reverse("appointment-list"),
            appointment_payload(second_doctor, self.patient),
        )
        self.assertEqual(response.status_code, 201, response.data)

    def test_cancelled_slot_can_be_booked_again(self):
        make_appointment(self.doctor, self.patient, status=Appointment.Status.CANCELLED)
        self.assertEqual(self.book().status_code, 201)

    def test_unavailable_doctor_cannot_be_booked(self):
        away = make_doctor(email="away@example.com", full_name="Dr. Away Person", is_available=False)
        response = self.client.post(
            reverse("appointment-list"), appointment_payload(away, self.patient)
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("doctor", response.data)

    def test_unknown_doctor_or_patient_is_rejected(self):
        response = self.book(doctor=9999)
        self.assertEqual(response.status_code, 400)
        self.assertIn("doctor", response.data)

    def test_required_fields(self):
        response = self.client.post(reverse("appointment-list"), {})
        self.assertEqual(response.status_code, 400)
        for field in ("patient", "doctor", "appointment_date", "appointment_time", "reason"):
            self.assertIn(field, response.data)

    def test_new_appointment_must_be_scheduled(self):
        response = self.book(status="COMPLETED")
        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)


class AppointmentUpdateTests(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.doctor = make_doctor()
        cls.patient = make_patient()

    def test_editing_an_appointment_does_not_clash_with_itself(self):
        appointment = make_appointment(self.doctor, self.patient)
        response = self.client.patch(
            reverse("appointment-detail", args=[appointment.pk]), {"reason": "Follow-up visit"}
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_reschedule_to_a_taken_slot_is_rejected(self):
        make_appointment(self.doctor, self.patient, appointment_time=time(11, 0))
        movable = make_appointment(
            self.doctor,
            make_patient(email="b@example.com", full_name="Second Patient"),
            appointment_time=time(12, 0),
        )
        response = self.client.patch(
            reverse("appointment-detail", args=[movable.pk]), {"appointment_time": "11:00"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("appointment_time", response.data)

    def test_mark_appointment_completed_and_cancelled(self):
        appointment = make_appointment(self.doctor, self.patient)
        url = reverse("appointment-detail", args=[appointment.pk])
        self.assertEqual(self.client.patch(url, {"status": "COMPLETED"}).status_code, 200)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, "COMPLETED")
        self.assertEqual(self.client.patch(url, {"status": "CANCELLED"}).status_code, 200)

    def test_past_appointment_can_still_be_completed(self):
        past = make_appointment(
            self.doctor, self.patient, appointment_date=timezone.localdate() - timedelta(days=2)
        )
        response = self.client.patch(
            reverse("appointment-detail", args=[past.pk]), {"status": "COMPLETED"}
        )
        self.assertEqual(response.status_code, 200, response.data)

    def test_cannot_move_an_appointment_into_the_past(self):
        appointment = make_appointment(self.doctor, self.patient)
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = self.client.patch(
            reverse("appointment-detail", args=[appointment.pk]), {"appointment_date": yesterday}
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_status_is_rejected(self):
        appointment = make_appointment(self.doctor, self.patient)
        response = self.client.patch(
            reverse("appointment-detail", args=[appointment.pk]), {"status": "DONE"}
        )
        self.assertEqual(response.status_code, 400)

    def test_only_admin_can_delete(self):
        appointment = make_appointment(self.doctor, self.patient)
        url = reverse("appointment-detail", args=[appointment.pk])
        self.client.force_authenticate(self.receptionist)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(Appointment.objects.filter(pk=appointment.pk).exists())


class AppointmentListTests(BaseAPITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.doctor_a = make_doctor(email="a@example.com", full_name="Dr. Alpha Doctor")
        cls.doctor_b = make_doctor(email="b@example.com", full_name="Dr. Beta Doctor")
        cls.patient_x = make_patient(email="x@example.com", full_name="Xavier Patient")
        cls.patient_y = make_patient(email="y@example.com", full_name="Yasmin Patient")
        cls.first = make_appointment(
            cls.doctor_a, cls.patient_x, appointment_date=future_date(2), reason="Headache"
        )
        cls.second = make_appointment(
            cls.doctor_b,
            cls.patient_y,
            appointment_date=future_date(4),
            reason="Back pain",
            status=Appointment.Status.COMPLETED,
        )

    def ids(self, **params):
        response = self.client.get(reverse("appointment-list"), params)
        self.assertEqual(response.status_code, 200)
        return [row["id"] for row in response.data["results"]]

    def test_list_is_ordered_by_date(self):
        self.assertEqual(self.ids(), [self.first.pk, self.second.pk])

    def test_filter_by_status(self):
        self.assertEqual(self.ids(status="COMPLETED"), [self.second.pk])

    def test_filter_by_doctor_and_patient(self):
        self.assertEqual(self.ids(doctor=self.doctor_a.pk), [self.first.pk])
        self.assertEqual(self.ids(patient=self.patient_y.pk), [self.second.pk])

    def test_filter_by_date(self):
        self.assertEqual(self.ids(date=future_date(4).isoformat()), [self.second.pk])

    def test_search(self):
        self.assertEqual(self.ids(search="xavier"), [self.first.pk])
        self.assertEqual(self.ids(search="beta"), [self.second.pk])
        self.assertEqual(self.ids(search="headache"), [self.first.pk])

    def test_invalid_filter_values_are_ignored(self):
        both = [self.first.pk, self.second.pk]
        self.assertEqual(self.ids(status="NOPE"), both)
        self.assertEqual(self.ids(doctor="abc"), both)
        self.assertEqual(self.ids(date="not-a-date"), both)
        self.assertEqual(self.ids(date="2026-02-31"), both)

    def test_detail_view(self):
        response = self.client.get(reverse("appointment-detail", args=[self.first.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["patient_name"], "Xavier Patient")
