"""
Custom authentication backend for the cohort builder application
"""
from django.contrib.auth import get_user_model


class SimpleAuthBackend:
    """
    Simple authentication backend that supports username/password authentication
    and session restoration.
    """
    
    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Authenticate user with username/email and password
        """
        if username is None or password is None:
            return None
        
        User = get_user_model()
        
        try:
            # Try to find user by username or email
            if '@' in username:
                user = User.objects.select_related('profile').get(email=username)
            else:
                user = User.objects.select_related('profile').get(username=username)
            
            # Check password
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None
        
        return None
    
    def get_user(self, user_id: int):
        """
        Return the Django User instance for session restoration.
        Uses select_related to fetch the user profile in the same query.
        """
        User = get_user_model()
        try:
            return User.objects.select_related('profile').get(pk=user_id)
        except User.DoesNotExist:
            return None
