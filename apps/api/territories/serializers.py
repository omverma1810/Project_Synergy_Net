from rest_framework import serializers
from .models import Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping


class TerritoryRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TerritoryRule
        fields = '__all__'


class TerritorySerializer(serializers.ModelSerializer):
    rules = TerritoryRuleSerializer(many=True, read_only=True)

    class Meta:
        model = Territory
        fields = '__all__'


class CoProductionTreatySerializer(serializers.ModelSerializer):
    class Meta:
        model = CoProductionTreaty
        fields = '__all__'


class QualifiedSpendMappingSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualifiedSpendMapping
        fields = '__all__'
