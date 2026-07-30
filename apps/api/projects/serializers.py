from rest_framework import serializers
from .models import Project, Budget, BudgetLineItem


class BudgetLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetLineItem
        fields = '__all__'


class BudgetSerializer(serializers.ModelSerializer):
    line_items = BudgetLineItemSerializer(many=True, read_only=True)
    line_item_count = serializers.IntegerField(source='line_items.count', read_only=True)

    class Meta:
        model = Budget
        fields = [
            'id', 'project', 'file_name', 'file_type', 'file',
            'extraction_status', 'confidence_score', 'extracted_at',
            'reviewed_at', 'line_items', 'line_item_count', 'created_at',
        ]
        read_only_fields = ['id', 'project', 'extraction_status', 'confidence_score', 'extracted_at', 'created_at']


class ProjectListSerializer(serializers.ModelSerializer):
    budget_count = serializers.IntegerField(source='budgets.count', read_only=True)
    latest_analysis_status = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'slug', 'type', 'genre', 'total_budget',
            'currency', 'status', 'spend_estimates', 'budget_count',
            'latest_analysis_status', 'created_at',
        ]
        read_only_fields = ['id', 'slug', 'budget_count', 'latest_analysis_status', 'created_at']

    def get_latest_analysis_status(self, obj):
        latest = obj.analyses.order_by('-created_at').first()
        return latest.status if latest else None


class ProjectCreateSerializer(serializers.ModelSerializer):
    """Serializer for POST /projects/ — the full guided-intake payload.

    Deliberately excludes id/slug/producer/status/vetting_* (set server-side or
    via the dedicated vetting endpoint), unlike ProjectListSerializer which is a
    read-only display whitelist too narrow for creation (it silently dropped
    synopsis/language/dates/territory/cast/timeline before this fix).
    """

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'type', 'genre', 'language', 'synopsis',
            'total_budget', 'currency',
            'shoot_start_date', 'shoot_end_date', 'shoot_duration_days',
            'target_territory', 'spend_estimates',
            'cast_crew_info', 'production_timeline',
            'creative_staff_local_resident', 'revenue_overrides',
            'script_file', 'shooting_plan_file',
        ]
        read_only_fields = ['id']


class ProjectDetailSerializer(serializers.ModelSerializer):
    budgets = BudgetSerializer(many=True, read_only=True)
    target_territory_name = serializers.CharField(source='target_territory.name', read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['slug', 'producer', 'created_at']
