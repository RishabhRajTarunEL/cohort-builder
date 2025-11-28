"""
Encryption utilities for sensitive data like API keys
"""
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
from django.conf import settings


def get_encryption_key() -> bytes:
    """
    Derive encryption key from Django SECRET_KEY
    Uses PBKDF2HMAC to derive a Fernet-compatible key
    """
    # Use a fixed salt for key derivation (in production, consider using a separate env var)
    salt = b'cohort_builder_encryption_salt_v1'
    
    # Derive key from Django SECRET_KEY
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.SECRET_KEY.encode()))
    return key


# Create a global Fernet instance
_fernet = None

def get_fernet() -> Fernet:
    """Get or create Fernet cipher instance"""
    global _fernet
    if _fernet is None:
        _fernet = Fernet(get_encryption_key())
    return _fernet


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt an API key for storage
    
    Args:
        api_key: Plain text API key
        
    Returns:
        Base64 encoded encrypted API key
    """
    if not api_key:
        return ""
    
    fernet = get_fernet()
    encrypted = fernet.encrypt(api_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt an encrypted API key
    
    Args:
        encrypted_key: Base64 encoded encrypted API key
        
    Returns:
        Plain text API key
    """
    if not encrypted_key:
        return ""
    
    # Remove any surrounding quotes that might have been added
    cleaned_key = encrypted_key.strip('"').strip("'")
    
    try:
        fernet = get_fernet()
        decrypted = fernet.decrypt(cleaned_key.encode())
        return decrypted.decode()
    except Exception as e:
        # If decryption fails, it might be an old unencrypted key
        # Try to return it as-is if it looks like a plain text key
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to decrypt API key: {str(e)}")
        logger.error(f"Encrypted key (first 50 chars): {encrypted_key[:50]}")
        logger.error(f"Cleaned key (first 50 chars): {cleaned_key[:50]}")
        
        # If the key doesn't look like encrypted data (no special chars), assume it's plain text
        # This is for backward compatibility with old unencrypted keys
        if cleaned_key and not cleaned_key.startswith('gAAAAA'):
            logger.info("Treating as unencrypted legacy API key")
            return cleaned_key
        
        return ""
