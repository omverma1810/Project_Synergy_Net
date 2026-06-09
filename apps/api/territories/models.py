from django.db import models


class Territory(models.Model):
    class IncentiveType(models.TextChoices):
        CASH_REBATE = 'CASH_REBATE', 'Cash Rebate'
        TAX_CREDIT = 'TAX_CREDIT', 'Tax Credit'
        TAX_SHELTER = 'TAX_SHELTER', 'Tax Shelter'
        GRANT = 'GRANT', 'Grant'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        PENDING = 'PENDING', 'Pending'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        EXPIRED = 'EXPIRED', 'Expired'

    name = models.CharField(max_length=100)
    country_code = models.CharField(max_length=2)
    region = models.CharField(max_length=50)
    incentive_type = models.CharField(max_length=20, choices=IncentiveType.choices)
    base_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    min_spend = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    max_rebate_cap = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    is_capped = models.BooleanField(default=False)
    is_stackable = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    effective_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    last_verified_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True
    )
    description = models.TextField(blank=True)
    official_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'territories'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.base_percentage}%)"


class TerritoryRule(models.Model):
    class RuleType(models.TextChoices):
        MIN_SPEND = 'MIN_SPEND', 'Minimum Spend'
        ELIGIBLE_CATEGORY = 'ELIGIBLE_CATEGORY', 'Eligible Category'
        CULTURAL_TEST = 'CULTURAL_TEST', 'Cultural Test'
        STACKING = 'STACKING', 'Stacking Rule'
        LOCAL_SPEND = 'LOCAL_SPEND', 'Local Spend Requirement'
        CREW_REQUIREMENT = 'CREW_REQUIREMENT', 'Crew Requirement'

    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='rules')
    rule_type = models.CharField(max_length=30, choices=RuleType.choices)
    configuration = models.JSONField(default=dict)
    priority = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'territory_rules'
        ordering = ['priority', 'rule_type']


class CoProductionTreaty(models.Model):
    country_a = models.CharField(max_length=2)
    country_b = models.CharField(max_length=2)
    treaty_name = models.CharField(max_length=255)
    convention_reference = models.CharField(max_length=100, blank=True)
    min_producer_countries = models.IntegerField(default=2)
    min_budget_ratio = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    eligible_incentive_types = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    effective_date = models.DateField()

    class Meta:
        db_table = 'co_production_treaties'
        unique_together = ['country_a', 'country_b']


class QualifiedSpendMapping(models.Model):
    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='spend_mappings')
    budget_category_pattern = models.CharField(max_length=255)
    mapped_eligible_category = models.CharField(max_length=100)
    eligibility_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    requires_local_vendor = models.BooleanField(default=False)
    requires_local_crew = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'qualified_spend_mappings'
