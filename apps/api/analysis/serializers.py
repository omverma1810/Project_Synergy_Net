from rest_framework import serializers
from .models import Analysis, AnalysisResult
from .insights import derive_risk_flags, risk_summary, build_finance_snapshot


class AnalysisResultSerializer(serializers.ModelSerializer):
    territory_name = serializers.CharField(source='territory.name', read_only=True)
    territory_country = serializers.CharField(source='territory.country_code', read_only=True)
    territory_percentage = serializers.DecimalField(
        source='territory.base_percentage', max_digits=5, decimal_places=2, read_only=True
    )
    territory_region = serializers.CharField(source='territory.region', read_only=True)
    territory_incentive_type = serializers.CharField(source='territory.incentive_type', read_only=True)
    risk_flags = serializers.SerializerMethodField()
    risk_level = serializers.SerializerMethodField()

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
            'details', 'risk_flags', 'risk_level', 'created_at',
        ]

    def get_risk_flags(self, obj):
        return derive_risk_flags(obj)

    def get_risk_level(self, obj):
        return risk_summary(obj)


class AnalysisSerializer(serializers.ModelSerializer):
    results = AnalysisResultSerializer(many=True, read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    project_currency = serializers.CharField(source='project.currency', read_only=True)
    finance_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = Analysis
        fields = [
            'id', 'project', 'project_title', 'project_currency', 'budget', 'status', 'triggered_by',
            'started_at', 'completed_at', 'results', 'finance_snapshot', 'created_at',
        ]

    def get_finance_snapshot(self, obj):
        if obj.status != Analysis.Status.COMPLETE:
            return None
        return build_finance_snapshot(obj)
