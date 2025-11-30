"""Serializers for cohort project models"""
import logging
from rest_framework import serializers
from api.models import CohortProject, ChatMessage
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user info in sharing"""
    full_name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'initials']
        read_only_fields = ['id', 'username', 'email', 'first_name', 'last_name']
    
    def get_full_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.username
    
    def get_initials(self, obj):
        if obj.first_name and obj.last_name:
            return f"{obj.first_name[0]}{obj.last_name[0]}".upper()
        elif obj.first_name:
            return obj.first_name[0].upper()
        elif obj.last_name:
            return obj.last_name[0].upper()
        return obj.username[0].upper() if obj.username else "U"


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'cohort_project', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class CohortProjectSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    total_chats = serializers.SerializerMethodField()
    shared_with = UserSerializer(many=True, read_only=True)
    owner = UserSerializer(read_only=True, source='user')
    is_owner = serializers.SerializerMethodField()
    
    class Meta:
        model = CohortProject
        fields = [
            'id', 'name', 'atlas_id', 'atlas_name', 'user', 'owner',
            'description', 'message_count', 'title', 'total_chats',
            'shared_with', 'is_owner', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'owner', 'created_at', 'updated_at']
    
    def get_message_count(self, obj):
        return obj.messages.count()
    
    def get_title(self, obj):
        """Get the title from the first user query"""
        first_user_message = obj.messages.filter(role='user').order_by('created_at').first()
        if first_user_message:
            # Truncate to 100 characters for display
            title = first_user_message.content[:100]
            if len(first_user_message.content) > 100:
                title += '...'
            return title
        return 'No queries yet'
    
    def get_total_chats(self, obj):
        """Get the count of user queries (chat messages from user)"""
        try:
            # Refresh the object from database to ensure we have latest data
            # Count user messages directly from database using the ID
            # This bypasses any relationship caching issues
            count = ChatMessage.objects.filter(
                cohort_project_id=obj.id,
                role='user'
            ).count()
            
            # Debug logging to help diagnose issues
            if count == 0:
                # Check if there are any messages at all for this project
                total_messages = ChatMessage.objects.filter(cohort_project_id=obj.id).count()
                if total_messages > 0:
                    # Check what roles exist
                    roles = ChatMessage.objects.filter(
                        cohort_project_id=obj.id
                    ).values_list('role', flat=True).distinct()
                    logger.warning(
                        f"Project {obj.id} ({obj.name}): "
                        f"total_chats=0 but total_messages={total_messages}, "
                        f"roles={list(roles)}"
                    )
            
            return count
        except Exception as e:
            # Fallback to 0 if there's any error
            logger.error(f"Error counting total_chats for project {obj.id}: {e}", exc_info=True)
            return 0
    
    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.user == request.user
        return False
