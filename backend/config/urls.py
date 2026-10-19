"""Root URL configuration: the Django Admin and the REST API under /api/."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("clinic.urls")),
]
