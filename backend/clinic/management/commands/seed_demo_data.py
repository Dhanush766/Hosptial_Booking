"""Loads fictional demo data (doctors, patients, appointments) for demonstrations."""
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from clinic.models import Appointment, Doctor, Patient

DOCTORS = [
    # (name, specialization, experience, fee, available)
    ("Dr. Anita Rao", "Cardiology", 15, "800", True),
    ("Dr. Suresh Kumar", "Orthopedics", 12, "700", True),
    ("Dr. Kavya Nair", "Pediatrics", 8, "500", True),
    ("Dr. Imran Sheikh", "Dermatology", 10, "600", True),
    ("Dr. Meena Pillai", "General Medicine", 20, "400", False),
]

PATIENTS = [
    # (name, birth date, gender)
    ("Rahul Verma", date(1990, 5, 14), "M"),
    ("Sunita Devi", date(1978, 11, 2), "F"),
    ("Arjun Das", date(2015, 3, 21), "M"),
    ("Pooja Singh", date(1995, 8, 30), "F"),
    ("Mohan Lal", date(1958, 1, 9), "M"),
    ("Fatima Khan", date(2001, 12, 25), "F"),
    ("Deepak Joshi", date(1985, 6, 18), "M"),
    ("Lakshmi Iyer", date(1969, 4, 7), "F"),
]

# (patient index, doctor index, days from today, time, reason, status)
APPOINTMENTS = [
    (0, 0, 1, time(10, 0), "Chest pain check-up", "SCHEDULED"),
    (1, 1, 1, time(11, 30), "Knee pain", "SCHEDULED"),
    (2, 2, 2, time(9, 30), "Vaccination", "SCHEDULED"),
    (3, 3, 3, time(14, 0), "Skin allergy", "SCHEDULED"),
    (4, 0, 4, time(16, 0), "Blood pressure review", "SCHEDULED"),
    (5, 2, 5, time(10, 30), "Fever and cough", "SCHEDULED"),
    (6, 1, -2, time(12, 0), "Back pain", "COMPLETED"),
    (7, 3, -5, time(15, 0), "Rash follow-up", "COMPLETED"),
    (0, 2, -1, time(9, 0), "Routine check-up", "CANCELLED"),
    (3, 0, 7, time(13, 0), "Heart screening", "SCHEDULED"),
]


class Command(BaseCommand):
    help = "Create fictional doctors, patients and appointments. Safe to run repeatedly."

    def handle(self, *args, **options):
        doctors = []
        for number, (name, specialization, years, fee, available) in enumerate(DOCTORS, start=1):
            doctor, _ = Doctor.objects.get_or_create(
                email=f"doctor{number}@example.com",
                defaults={
                    "full_name": name,
                    "phone_number": f"+918000000{number:03d}",
                    "specialization": specialization,
                    "experience_years": years,
                    "consultation_fee": Decimal(fee),
                    "is_available": available,
                },
            )
            doctors.append(doctor)

        patients = []
        for number, (name, born, gender) in enumerate(PATIENTS, start=1):
            patient, _ = Patient.objects.get_or_create(
                email=f"patient{number}@example.com",
                defaults={
                    "full_name": name,
                    "phone_number": f"+919000000{number:03d}",
                    "date_of_birth": born,
                    "gender": gender,
                    "address": "Sample address, India",
                },
            )
            patients.append(patient)

        today = timezone.localdate()
        created = 0
        for patient_i, doctor_i, offset, at, reason, status in APPOINTMENTS:
            _, was_created = Appointment.objects.get_or_create(
                doctor=doctors[doctor_i],
                appointment_date=today + timedelta(days=offset),
                appointment_time=at,
                defaults={"patient": patients[patient_i], "reason": reason, "status": status},
            )
            created += int(was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo data ready: {len(doctors)} doctors, {len(patients)} patients, "
                f"{created} new appointments."
            )
        )
