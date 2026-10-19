from django.core.cache import cache
from django.urls import reverse
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient, APITestCase

from .base import User


class AuthApiTests(APITestCase):
    password = "Test-only-pass-12345"

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("reception", "r@example.com", cls.password)

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_login_returns_a_token(self):
        response = self.client.post(
            reverse("login"), {"username": "reception", "password": self.password}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "reception")
        self.assertFalse(response.data["is_staff"])
        self.assertEqual(response.data["token"], Token.objects.get(user=self.user).key)

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            reverse("login"), {"username": "reception", "password": "wrong"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("token", response.data)

    def test_missing_fields_are_rejected(self):
        response = self.client.post(reverse("login"), {"username": "reception"})
        self.assertEqual(response.status_code, 400)

    def test_login_is_rate_limited(self):
        for _ in range(10):
            self.client.post(reverse("login"), {"username": "reception", "password": "bad"})
        response = self.client.post(reverse("login"), {"username": "reception", "password": "bad"})
        self.assertEqual(response.status_code, 429)

    def test_endpoints_require_a_token(self):
        for name in ("doctor-list", "patient-list", "appointment-list", "dashboard", "me"):
            with self.subTest(endpoint=name):
                self.assertEqual(self.client.get(reverse(name)).status_code, 401)

    def test_invalid_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        self.assertEqual(self.client.get(reverse("doctor-list")).status_code, 401)

    def test_valid_token_grants_access(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.get(reverse("doctor-list")).status_code, 200)
        me = self.client.get(reverse("me"))
        self.assertEqual(me.data["username"], "reception")

    def test_logout_invalidates_the_token(self):
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(self.client.post(reverse("logout")).status_code, 204)
        self.assertEqual(self.client.get(reverse("doctor-list")).status_code, 401)
