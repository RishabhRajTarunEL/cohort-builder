"""
API Views for cohort builder
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from django.db.models import Q
from api.models import Cohort, Filter, QueryHistory
from api.serializers import CohortSerializer, FilterSerializer, QueryHistorySerializer


class CohortViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing cohorts
    """
    serializer_class = CohortSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        if self.request.user.is_authenticated:
            return Cohort.objects.filter(created_by=self.request.user)
        return Cohort.objects.all()
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()
    
    @action(detail=True, methods=['post'])
    def calculate_count(self, request, pk=None):
        """Calculate patient count for cohort based on active filters"""
        cohort = self.get_object()
        # TODO: Implement actual database query based on filters
        # For now, return mock count
        count = 1000
        cohort.patient_count = count
        cohort.save()
        return Response({'patient_count': count})
    
    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Get analytics data for cohort"""
        cohort = self.get_object()
        # TODO: Implement actual analytics queries
        # For now, return mock data
        return Response({
            'gender_distribution': {'Male': 520, 'Female': 480},
            'age_distribution': {
                '0-18': 100,
                '19-35': 250,
                '36-50': 300,
                '51-65': 250,
                '66+': 100
            },
            'diagnosis_distribution': {
                'Diagnosis A': 400,
                'Diagnosis B': 300,
                'Diagnosis C': 200,
                'Other': 100
            }
        })


class FilterViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing filters
    """
    serializer_class = FilterSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        cohort_id = self.request.query_params.get('cohort_id')
        if self.request.user.is_authenticated:
            if cohort_id:
                return Filter.objects.filter(cohort_id=cohort_id, cohort__created_by=self.request.user)
            return Filter.objects.filter(cohort__created_by=self.request.user)
        return Filter.objects.all()
    
    @action(detail=True, methods=['post'])
    def toggle(self, request, pk=None):
        """Toggle filter enabled/disabled"""
        filter_obj = self.get_object()
        filter_obj.enabled = not filter_obj.enabled
        filter_obj.save()
        return Response({'enabled': filter_obj.enabled})


class QueryHistoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for query history
    """
    serializer_class = QueryHistorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        if self.request.user.is_authenticated:
            return QueryHistory.objects.filter(user=self.request.user)
        return QueryHistory.objects.all()
    
    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            serializer.save()
    
    @action(detail=False, methods=['post'])
    def process_query(self, request):
        """Process natural language query"""
        query_text = request.data.get('query_text', '')
        
        # TODO: Implement actual NLQ processing
        # For now, return mock response
        response_data = {
            'query_id': f'query-{QueryHistory.objects.count() + 1}',
            'interpretation': f'Processed query: {query_text}',
            'suggested_filters': [
                {
                    'table_name': 'patient',
                    'field_name': 'gender',
                    'operator': '=',
                    'value': 'Female',
                    'sql_criterion': "patient.gender = 'Female'"
                }
            ]
        }
        
        # Save to history
        if request.user.is_authenticated:
            QueryHistory.objects.create(
                user=request.user,
                query_text=query_text,
                interpretation=response_data['interpretation'],
                suggested_filters=response_data['suggested_filters']
            )
        
        return Response(response_data)
