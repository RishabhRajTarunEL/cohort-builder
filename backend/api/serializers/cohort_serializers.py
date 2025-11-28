"""Serializers for cohort-related models"""
from rest_framework import serializers
from api.models import Cohort, Filter, QueryHistory


class FilterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Filter
        fields = [
            'id', 'filter_type', 'table_name', 'field_name', 
            'operator', 'value', 'sql_criterion', 'enabled', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CohortSerializer(serializers.ModelSerializer):
    filters = FilterSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = Cohort
        fields = [
            'id', 'name', 'description', 'created_by', 'created_by_username',
            'created_at', 'updated_at', 'patient_count', 'filters'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'patient_count']


class QueryHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = QueryHistory
        fields = [
            'id', 'cohort', 'user', 'query_text', 'interpretation',
            'suggested_filters', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
