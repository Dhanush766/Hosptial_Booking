from rest_framework.permissions import BasePermission


class StaffOnlyDelete(BasePermission):
    """
    Used together with IsAuthenticated.

    Any logged-in hospital user may read, create and update records, but only
    users with "staff status" (administrators) may delete them.
    """

    message = "Only administrators can delete records."

    def has_permission(self, request, view):
        if request.method == "DELETE":
            return bool(request.user and request.user.is_staff)
        return True
