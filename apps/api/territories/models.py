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
    country_code = models.CharField(max_length=10)
    region = models.CharField(max_length=50)
    incentive_type = models.CharField(max_length=20, choices=IncentiveType.choices)
    base_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    provincial_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_regional_stacking_eligible = models.BooleanField(default=False)
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

    # Rebate timing for financing/recoupment modeling
    rebate_timing_months_min = models.IntegerField(default=6)
    rebate_timing_months_max = models.IntegerField(default=18)
    loan_against_rebate_available = models.BooleanField(default=False)

    # Genre eligibility flags
    documentary_eligible = models.BooleanField(default=True)
    animation_eligible = models.BooleanField(default=True)
    streaming_eligible = models.BooleanField(default=True)
    sci_fi_eligible = models.BooleanField(default=True)

    # Local crew requirement
    min_local_crew_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Geographic coordinates of the primary production hub (for the world map)
    latitude = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)
    longitude = models.DecimalField(max_digits=8, decimal_places=5, null=True, blank=True)

    # Local support: film commission / government boards / industry associations
    film_commission = models.CharField(max_length=150, blank=True)
    film_commission_url = models.URLField(blank=True)
    government_support = models.TextField(
        blank=True,
        help_text='Notes on local government / board support, soft money, and on-the-ground assistance.',
    )
    local_associations = models.JSONField(
        default=list, blank=True,
        help_text='List of {name, url} for film/media associations and guilds.',
    )

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
        TREATY_BONUS = 'TREATY_BONUS', 'Co-production Treaty Bonus'

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
    country_a = models.CharField(max_length=10)
    country_b = models.CharField(max_length=10)
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


class TerritoryComplianceChecklist(models.Model):
    class ItemType(models.TextChoices):
        DOCUMENT = 'DOCUMENT', 'Document Required'
        APPLICATION = 'APPLICATION', 'Application/Registration'
        MILESTONE = 'MILESTONE', 'Production Milestone'
        AUDIT = 'AUDIT', 'Audit/Certification'

    class DeadlineType(models.TextChoices):
        BEFORE_SHOOT = 'BEFORE_SHOOT', 'Before Principal Photography'
        DURING_SHOOT = 'DURING_SHOOT', 'During Production'
        AFTER_SHOOT = 'AFTER_SHOOT', 'After Wrap'
        AFTER_DELIVERY = 'AFTER_DELIVERY', 'After Delivery/Release'

    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='compliance_items')
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    description = models.CharField(max_length=500)
    deadline_type = models.CharField(max_length=20, choices=DeadlineType.choices)
    is_mandatory = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'territory_compliance_checklists'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.territory.name}: {self.description[:50]}"


class PolicyAlert(models.Model):
    class ChangeType(models.TextChoices):
        RATE_CHANGE = 'RATE_CHANGE', 'Rate Change'
        RULE_CHANGE = 'RULE_CHANGE', 'Rule Change'
        NEW_TERRITORY = 'NEW_TERRITORY', 'New Territory'
        SUSPENSION = 'SUSPENSION', 'Program Suspended'
        REINSTATEMENT = 'REINSTATEMENT', 'Program Reinstated'

    territory = models.ForeignKey(
        Territory, on_delete=models.CASCADE, related_name='policy_alerts', null=True, blank=True
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    change_type = models.CharField(max_length=20, choices=ChangeType.choices)
    previous_value = models.CharField(max_length=100, blank=True)
    new_value = models.CharField(max_length=100, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'policy_alerts'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class GenreIntelligenceProfile(models.Model):
    class Genre(models.TextChoices):
        SCI_FI = 'sci_fi', 'Sci-Fi'
        ANIMATION = 'animation', 'Animation'
        DOCUMENTARY = 'documentary', 'Documentary'
        HORROR = 'horror', 'Horror'
        STREAMING = 'streaming', 'Streaming/Series'
        DRAMA = 'drama', 'Drama'
        ACTION = 'action', 'Action'

    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='genre_profiles')
    genre = models.CharField(max_length=20, choices=Genre.choices)
    bonus_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    eligibility_notes = models.TextField(blank=True)
    spend_category_multipliers = models.JSONField(default=dict)

    class Meta:
        db_table = 'genre_intelligence_profiles'
        unique_together = ['territory', 'genre']

    def __str__(self):
        return f"{self.territory.name} — {self.genre} (+{self.bonus_percentage}%)"


class TerritoryPartner(models.Model):
    class PartnerType(models.TextChoices):
        CPA = 'cpa', 'CPA / Tax Advisor'
        LINE_PRODUCER = 'line_producer', 'Line Producer'
        LEGAL = 'legal', 'Legal Counsel'
        FIXER = 'fixer', 'Local Fixer'

    territory = models.ForeignKey(Territory, on_delete=models.CASCADE, related_name='partners')
    name = models.CharField(max_length=255)
    partner_type = models.CharField(max_length=20, choices=PartnerType.choices)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    website = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    is_vetted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'territory_partners'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_partner_type_display()}) — {self.territory.name}"
