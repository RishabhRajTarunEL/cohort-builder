"""Serializers for cohort project models"""
from rest_framework import serializers
from api.models import CohortProject, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'cohort_project', 'role', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']


class CohortProjectSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    
    class Meta:
        model = CohortProject
        fields = [
            'id', 'name', 'atlas_id', 'atlas_name', 'user',
            'description', 'message_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def get_message_count(self, obj):
        return obj.messages.count()
