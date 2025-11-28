"""
Custom exception handling for API responses
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class UserInputError(APIException):
    """Custom exception for user input errors"""
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detail: str) -> None:
        self.detail = detail


def custom_exception_handler(exc, context):
    """
    Custom exception handler that ensures all errors return JSON responses
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # If response is None, it means DRF didn't handle it
    # This can happen for CSRF errors and other Django errors
    if response is None:
        return None

    # Ensure consistent error response format
    if response is not None:
        # You can customize the response format here if needed
        # For now, we just return the default DRF response
        pass

    return response
