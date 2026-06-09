from django.contrib import admin
from .models import Analysis, AnalysisResult


@admin.register(Analysis)
class AnalysisAdmin(admin.ModelAdmin):
    list_display = ['id', 'project', 'status', 'triggered_by', 'started_at', 'completed_at', 'created_at']
    list_filter = ['status', 'triggered_by']
    raw_id_fields = ['project', 'budget']


@admin.register(AnalysisResult)
class AnalysisResultAdmin(admin.ModelAdmin):
    list_display = ['id', 'analysis', 'territory', 'rank', 'estimated_rebate', 'net_benefit', 'confidence_score']
    list_filter = ['currency']
    raw_id_fields = ['analysis', 'territory']
