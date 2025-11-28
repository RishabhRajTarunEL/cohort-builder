"""
Custom middleware for JSON error responses
"""
from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware


class JsonCsrfMiddleware(CsrfViewMiddleware):
    """CSRF middleware that returns JSON responses"""
    
    def _reject(self, request, reason):
        return JsonResponse({
            'detail': 'CSRF verification failed',
            'reason': reason
        }, status=403)
