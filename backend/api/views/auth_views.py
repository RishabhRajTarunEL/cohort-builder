"""
Authentication views for login, logout, and user management
"""
from typing import Any
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import UserProfile


def user_to_dict(user: User) -> dict[str, Any]:
    """Serialize user data for API responses"""
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_approved': user.profile.is_approved,
        'has_completed_profile': user.profile.has_completed_profile,
    }


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CSRFTokenView(APIView):
    """
    Provide CSRF token for pre-login requests
    """
    permission_classes = (permissions.AllowAny,)
    authentication_classes = []
    
    def get(self, request):
        csrf_token = get_token(request)
        return Response({'csrfToken': csrf_token})


@method_decorator(csrf_protect, name='dispatch')
class LoginView(APIView):
    """
    Handle user login with username/email and password
    """
    permission_classes = (permissions.AllowAny,)
    authentication_classes = []
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'detail': 'Username and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try to authenticate with username or email
        from django.contrib.auth import authenticate
        user = authenticate(request, username=username, password=password)
        
        if user is None:
            return Response(
                {'detail': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Create Django session
        login(request, user, backend='cohort_backend.auth_backends.SimpleAuthBackend')
        
        return Response(user_to_dict(user))


@method_decorator(csrf_protect, name='dispatch')
class RegisterView(APIView):
    """
    Handle user registration
    """
    permission_classes = (permissions.AllowAny,)
    authentication_classes = []
    
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        polly_api_key = request.data.get('polly_api_key', '')
        
        if not username or not email or not password:
            return Response(
                {'detail': 'Username, email, and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return Response(
                {'detail': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(email=email).exists():
            return Response(
                {'detail': 'Email already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user
        user = UserProfile.create_or_update_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name
        )
        user.set_password(password)
        user.save()
        
        # Update user profile with polly_api_key (encrypted)
        if polly_api_key:
            user.profile.set_polly_api_key(polly_api_key)
            user.profile.save()
        
        # Auto-login after registration
        login(request, user, backend='cohort_backend.auth_backends.SimpleAuthBackend')
        
        return Response(user_to_dict(user), status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """
    Handle user logout
    """
    permission_classes = (permissions.IsAuthenticated,)
    
    def post(self, request):
        logout(request)
        return Response({'detail': 'Successfully logged out'})


class MeView(APIView):
    """
    Return current authenticated user information
    """
    permission_classes = (permissions.IsAuthenticated,)
    
    def get(self, request):
        return Response(user_to_dict(request.user))


@method_decorator(csrf_protect, name='dispatch')
class ProfileUpdateView(APIView):
    """
    Update user profile information including Polly API key
    """
    permission_classes = (permissions.IsAuthenticated,)
    
    def patch(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        user = request.user
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        polly_api_key = request.data.get('polly_api_key')
        
        logger.info(f"Profile update request for user: {user.username}")
        logger.info(f"Update data - first_name: {first_name}, last_name: {last_name}, api_key provided: {bool(polly_api_key)}")
        
        # Update user fields
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        
        user.save()
        logger.info(f"User fields updated successfully")
        
        # Update profile fields (encrypt API key)
        if polly_api_key is not None and polly_api_key.strip():
            logger.info(f"Encrypting and saving API key")
            user.profile.set_polly_api_key(polly_api_key)
            user.profile.save()
            logger.info(f"API key saved successfully")
        
        return Response(user_to_dict(user))
