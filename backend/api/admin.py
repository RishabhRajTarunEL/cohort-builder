"""Django admin configuration"""
from django.contrib import admin

from api.models import UserProfile, Cohort, Filter, QueryHistory


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'email', 'company_name', 'designation', 'is_approved', 'created_at']
    list_filter = ['is_approved', 'created_at']
    search_fields = ['user__username', 'user__email', 'company_name', 'designation']
    readonly_fields = ['created_at', 'updated_at']
    
    def email(self, obj):
        return obj.user.email
    email.short_description = 'Email'


@admin.register(Cohort)
class CohortAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'patient_count', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Filter)
class FilterAdmin(admin.ModelAdmin):
    list_display = ['cohort', 'table_name', 'field_name', 'operator', 'enabled', 'created_at']
    list_filter = ['filter_type', 'enabled', 'table_name']
    search_fields = ['table_name', 'field_name', 'sql_criterion']


@admin.register(QueryHistory)
class QueryHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'query_text', 'created_at']
    list_filter = ['created_at']
    search_fields = ['query_text', 'interpretation']
    readonly_fields = ['created_at']
