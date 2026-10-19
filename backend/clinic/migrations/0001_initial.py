import django.core.validators
import django.db.models.deletion
from django.db import migrations, models

import clinic.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Doctor",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=100, validators=[clinic.validators.validate_person_name])),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("phone_number", models.CharField(max_length=16, validators=[clinic.validators.validate_phone_number])),
                ("specialization", models.CharField(max_length=100)),
                ("experience_years", models.PositiveSmallIntegerField(default=0, validators=[django.core.validators.MaxValueValidator(60)])),
                ("consultation_fee", models.DecimalField(decimal_places=2, max_digits=8, validators=[clinic.validators.validate_positive_amount])),
                ("is_available", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["full_name"],
            },
        ),
        migrations.CreateModel(
            name="Patient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=100, validators=[clinic.validators.validate_person_name])),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("phone_number", models.CharField(max_length=16, validators=[clinic.validators.validate_phone_number])),
                ("date_of_birth", models.DateField(validators=[clinic.validators.validate_birth_date])),
                ("gender", models.CharField(choices=[("M", "Male"), ("F", "Female"), ("O", "Other")], max_length=1)),
                ("address", models.TextField(blank=True)),
                ("medical_notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["full_name"],
            },
        ),
        migrations.CreateModel(
            name="Appointment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("appointment_date", models.DateField()),
                ("appointment_time", models.TimeField()),
                ("reason", models.CharField(max_length=255)),
                ("status", models.CharField(choices=[("SCHEDULED", "Scheduled"), ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled")], default="SCHEDULED", max_length=10)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("doctor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="appointments", to="clinic.doctor")),
                ("patient", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="appointments", to="clinic.patient")),
            ],
            options={
                "ordering": ["appointment_date", "appointment_time", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(fields=["appointment_date", "appointment_time"], name="appt_slot_idx"),
        ),
        migrations.AddIndex(
            model_name="appointment",
            index=models.Index(fields=["status"], name="appt_status_idx"),
        ),
    ]
