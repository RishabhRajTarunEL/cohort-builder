"""Serializers for cohort project models"""
from rest_framework import serializers
from api.models import CohortProject, ChatMessage
from django.contrib.auth.models import User


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
    shared_with = UserSerializer(many=True, read_only=True)
    owner = UserSerializer(read_only=True, source='user')
    is_owner = serializers.SerializerMethodField()
    
    class Meta:
        model = CohortProject
        fields = [
            'id', 'name', 'atlas_id', 'atlas_name', 'user', 'owner',
            'description', 'message_count', 'shared_with', 'is_owner',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'owner', 'created_at', 'updated_at']
    
    def get_message_count(self, obj):
        return obj.messages.count()
    
    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.user == request.user
        return False
