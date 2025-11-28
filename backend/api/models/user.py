"""User profile models"""
from django.db import models, transaction
from django.contrib.auth.models import User
from api.utils.encryption import encrypt_api_key, decrypt_api_key


class UserProfile(models.Model):
    """Extended user profile for authentication and user management"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    company_name = models.CharField(max_length=255, blank=True)
    designation = models.CharField(max_length=255, blank=True)
    polly_api_key = models.CharField(max_length=1000, blank=True)  # Increased size for encrypted data
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"UserProfile(email={self.user.email}, company_name='{self.company_name}')"
    
    @property
    def has_completed_profile(self):
        """Check if user has completed their profile"""
        return bool(self.company_name and self.designation)
    
    def set_polly_api_key(self, plain_key: str):
        """Encrypt and store the Polly API key"""
        if plain_key:
            self.polly_api_key = encrypt_api_key(plain_key)
        else:
            self.polly_api_key = ""
    
    def get_polly_api_key(self) -> str:
        """Decrypt and return the Polly API key"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"get_polly_api_key called for user: {self.user.username}")
        logger.info(f"Raw polly_api_key from DB (first 50): {self.polly_api_key[:50]}")
        logger.info(f"Type of polly_api_key: {type(self.polly_api_key)}")
        decrypted = decrypt_api_key(self.polly_api_key)
        logger.info(f"Decrypted key (first 20): {decrypted[:20] if decrypted else 'None'}")
        return decrypted
    
    @staticmethod
    def create_or_update_user(username: str, email: str, first_name: str = "", last_name: str = "") -> User:
        """Create or update a user and their profile"""
        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': username,
                    'first_name': first_name,
                    'last_name': last_name,
                }
            )
            
            # Update names on subsequent logins
            update_fields = []
            if user.first_name != first_name:
                user.first_name = first_name
                update_fields.append('first_name')
            if user.last_name != last_name:
                user.last_name = last_name
                update_fields.append('last_name')
            
            if update_fields:
                user.save(update_fields=update_fields)
            
            # Create or get user profile
            UserProfile.objects.get_or_create(
                user=user,
                defaults={'is_approved': True}
            )
            
            return user
