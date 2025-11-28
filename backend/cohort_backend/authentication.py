"""
Custom authentication classes for REST framework
"""
from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication


class CustomSessionAuthentication(DRFSessionAuthentication):
    """
    Session authentication that returns 401 instead of 403 on auth failures.
    This provides better error handling for frontend applications.
    """
    
    def authenticate_header(self, request):
        return 'Bearer error="invalid_token", error_description="The access token is invalid or expired"'
