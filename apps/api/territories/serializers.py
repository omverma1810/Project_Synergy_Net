from rest_framework import serializers
from .models import (
    Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping,
    TerritoryComplianceChecklist, PolicyAlert, GenreIntelligenceProfile, TerritoryPartner,
)


class TerritoryRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerritoryRule
        fields = '__all__'


class TerritoryComplianceChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerritoryComplianceChecklist
        fields = '__all__'


class GenreIntelligenceProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenreIntelligenceProfile
        fields = '__all__'


class TerritoryPartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerritoryPartner
        fields = '__all__'


class TerritorySerializer(serializers.ModelSerializer):
    rules = TerritoryRuleSerializer(many=True, read_only=True)
    compliance_items = TerritoryComplianceChecklistSerializer(many=True, read_only=True)
    genre_profiles = GenreIntelligenceProfileSerializer(many=True, read_only=True)
    partners = TerritoryPartnerSerializer(many=True, read_only=True)

    class Meta:
        model = Territory
        fields = '__all__'


class TerritoryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no nested relations."""
    class Meta:
        model = Territory
        fields = [
            'id', 'name', 'country_code', 'region', 'incentive_type',
            'base_percentage', 'provincial_percentage', 'is_stackable',
            'min_spend', 'max_rebate_cap', 'is_capped', 'currency', 'status',
            'rebate_timing_months_min', 'rebate_timing_months_max',
            'loan_against_rebate_available',
            'documentary_eligible', 'animation_eligible', 'streaming_eligible', 'sci_fi_eligible',
            'official_url', 'last_verified_at',
        ]


class CoProductionTreatySerializer(serializers.ModelSerializer):
    class Meta:
        model = CoProductionTreaty
        fields = '__all__'


class QualifiedSpendMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualifiedSpendMapping
        fields = '__all__'


class PolicyAlertSerializer(serializers.ModelSerializer):
    territory_name = serializers.CharField(source='territory.name', read_only=True, allow_null=True)

    class Meta:
        model = PolicyAlert
        fields = [
            'id', 'territory', 'territory_name', 'title', 'description',
            'change_type', 'previous_value', 'new_value', 'effective_date',
            'is_active', 'created_at',
        ]
