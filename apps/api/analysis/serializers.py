from rest_framework import serializers
from .models import Analysis, AnalysisResult


class AnalysisResultSerializer(serializers.ModelSerializer):
    territory_name = serializers.CharField(source='territory.name', read_only=True)
    territory_country = serializers.CharField(source='territory.country_code', read_only=True)
    territory_percentage = serializers.DecimalField(
        source='territory.base_percentage', max_digits=5, decimal_places=2, read_only=True
    )
    territory_region = serializers.CharField(source='territory.region', read_only=True)
    territory_incentive_type = serializers.CharField(source='territory.incentive_type', read_only=True)

    class Meta:
        model = AnalysisResult
        fields = [
            'id', 'territory', 'territory_name', 'territory_country', 'territory_percentage',
            'territory_region', 'territory_incentive_type',
            'rank', 'qualified_spend_total', 'estimated_rebate', 'estimated_rebate_pct',
            'logistics_premium', 'net_benefit', 'payback_timeline_months',
            'confidence_score', 'currency',
            'rebate_timing_months', 'loan_against_rebate_available',
            'financing_benefit_estimate', 'recoupment_priority',
            'details', 'created_at',
        ]


class AnalysisSerializer(serializers.ModelSerializer):
    results = AnalysisResultSerializer(many=True, read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Analysis
        fields = [
            'id', 'project', 'project_title', 'budget', 'status', 'triggered_by',
            'started_at', 'completed_at', 'results', 'created_at',
        ]
