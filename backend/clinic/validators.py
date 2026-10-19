"""Reusable field validators (plain functions, so models and migrations can use them)."""
import re

from django.core.exceptions import ValidationError
from django.utils import timezone

_PHONE_RE = re.compile(r"^\+?[0-9]{10,15}$")
_NAME_EXTRA_CHARS = " .'-"


def validate_person_name(value):
    cleaned = value.strip()
    if len(cleaned) < 2:
        raise ValidationError("Name must be at least 2 characters long.", code="short_name")
    if not cleaned[0].isalpha() or not all(
        ch.isalpha() or ch in _NAME_EXTRA_CHARS for ch in cleaned
    ):
        raise ValidationError(
            "Name may contain only letters, spaces, apostrophes, hyphens and dots.",
            code="invalid_name",
        )


def validate_phone_number(value):
    if not _PHONE_RE.match(value):
        raise ValidationError(
            "Enter 10 to 15 digits, optionally starting with '+'.", code="invalid_phone"
        )


def validate_positive_amount(value):
    if value is not None and value <= 0:
        raise ValidationError("Amount must be greater than zero.", code="invalid_amount")


def validate_birth_date(value):
    if value > timezone.localdate():
        raise ValidationError("Date of birth cannot be in the future.", code="future_date")
    if value.year < 1900:
        raise ValidationError("Date of birth must be 1900 or later.", code="too_old")
