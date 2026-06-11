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
        read_only_fields = ['extraction_status', 'confidence_score', 'extracted_at']


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


class ProjectDetailSerializer(serializers.ModelSerializer):
    budgets = BudgetSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = '__all__'
        read_only_fields = ['slug', 'producer', 'created_at']
