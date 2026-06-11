from django.contrib import admin
from .models import (
    Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping,
    TerritoryComplianceChecklist, PolicyAlert, GenreIntelligenceProfile, TerritoryPartner,
)


@admin.register(Territory)
class TerritoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'country_code', 'incentive_type', 'base_percentage', 'status', 'effective_date', 'loan_against_rebate_available']
    list_filter = ['incentive_type', 'status', 'region', 'is_stackable', 'loan_against_rebate_available']
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


@admin.register(TerritoryComplianceChecklist)
class TerritoryComplianceChecklistAdmin(admin.ModelAdmin):
    list_display = ['territory', 'item_type', 'description', 'deadline_type', 'is_mandatory']
    list_filter = ['territory', 'item_type', 'deadline_type', 'is_mandatory']
    search_fields = ['description']


@admin.register(PolicyAlert)
class PolicyAlertAdmin(admin.ModelAdmin):
    list_display = ['title', 'territory', 'change_type', 'effective_date', 'is_active', 'created_at']
    list_filter = ['change_type', 'is_active', 'territory']
    search_fields = ['title', 'description']


@admin.register(GenreIntelligenceProfile)
class GenreIntelligenceProfileAdmin(admin.ModelAdmin):
    list_display = ['territory', 'genre', 'bonus_percentage']
    list_filter = ['genre', 'territory']


@admin.register(TerritoryPartner)
class TerritoryPartnerAdmin(admin.ModelAdmin):
    list_display = ['name', 'territory', 'partner_type', 'is_vetted', 'email']
    list_filter = ['partner_type', 'is_vetted', 'territory']
    search_fields = ['name', 'email']
