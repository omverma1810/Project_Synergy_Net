from django.contrib import admin
from .models import Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping


@admin.register(Territory)
class TerritoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'country_code', 'incentive_type', 'base_percentage', 'status', 'effective_date']
    list_filter = ['incentive_type', 'status', 'region', 'is_stackable']
    search_fields = ['name', 'country_code']


@admin.register(TerritoryRule)
class TerritoryRuleAdmin(admin.ModelAdmin):
    list_display = ['territory', 'rule_type', 'priority', 'is_active']
    list_filter = ['rule_type', 'is_active']


@admin.register(CoProductionTreaty)
class CoProductionTreatyAdmin(admin.ModelAdmin):
    list_display = ['treaty_name', 'country_a', 'country_b', 'is_active']
    list_filter = ['is_active']


@admin.register(QualifiedSpendMapping)
class QualifiedSpendMappingAdmin(admin.ModelAdmin):
    list_display = ['territory', 'budget_category_pattern', 'mapped_eligible_category', 'eligibility_percentage']
    list_filter = ['territory', 'is_active']
