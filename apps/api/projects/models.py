from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Project(models.Model):
    class Type(models.TextChoices):
        FEATURE = 'FEATURE', 'Feature Film'
        TV_SERIES = 'TV_SERIES', 'TV Series'
        DOCUMENTARY = 'DOCUMENTARY', 'Documentary'
        COMMERCIAL = 'COMMERCIAL', 'Commercial'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        UPLOADED = 'UPLOADED', 'Budget Uploaded'
        ANALYZING = 'ANALYZING', 'Analyzing'
        REVIEW = 'REVIEW', 'In Review'
        COMPLETE = 'COMPLETE', 'Complete'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class VettingStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Review'
        FLAGGED = 'FLAGGED', 'Flagged for Review'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    producer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    type = models.CharField(max_length=20, choices=Type.choices)
    genre = models.CharField(max_length=100, blank=True)
    language = models.CharField(max_length=50, default='English')
    synopsis = models.TextField(blank=True)
    total_budget = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    shoot_start_date = models.DateField(null=True, blank=True)
    shoot_end_date = models.DateField(null=True, blank=True)
    shoot_duration_days = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # Producer intake fields
    script_file = models.FileField(upload_to='scripts/%Y/%m/', blank=True, null=True)
    shooting_plan_file = models.FileField(upload_to='shooting_plans/%Y/%m/', blank=True, null=True)
    cast_crew_info = models.JSONField(default=dict, blank=True)
    spend_estimates = models.JSONField(default=dict, blank=True)
    production_timeline = models.JSONField(default=dict, blank=True)

    # Vetting workflow
    vetting_status = models.CharField(
        max_length=20, choices=VettingStatus.choices, default=VettingStatus.PENDING
    )
    vetting_notes = models.TextField(blank=True)
    vetting_reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vetted_projects'
    )
    vetting_reviewed_at = models.DateTimeField(null=True, blank=True)

    # Producer's intended shoot territory — drives the default incentive program
    # for the financial model. Set during intake; overridable per analysis.
    target_territory = models.ForeignKey(
        'territories.Territory', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='target_projects',
    )

    # Producer-supplied revenue window overrides for the financial model. Each entry
    # is {name, floor, base, breakout}; when present, replaces the modelled default
    # benchmarks so the model reflects real sales-agent quotes.
    revenue_overrides = models.JSONField(default=list, blank=True)

    # Whether the producer has confirmed the principal cast/writer/director are
    # Spain/EEA tax residents (or the equivalent local-residency requirement for
    # the chosen territory). Drives the financial engine's creative-staff haircut
    # classification — unconfirmed ATL creative spend is excluded from the rebate
    # until this is set, matching the reference workbook's audit-ready stance.
    creative_staff_local_resident = models.BooleanField(default=False)

    # Named roles distinct from `producer` (the account holder). The reference
    # structuring-analysis workbook lists Director / Producer / Executive Producer
    # as separate credited roles even when they're the same person.
    director = models.CharField(max_length=255, blank=True)
    executive_producer = models.CharField(max_length=255, blank=True)

    # Diligence/greenlight controls for the Assumptions & Controls tab. Each entry
    # is {area, owner, status, risk_level}; defaults to the five standard rows
    # (Budget Lock, Tax Incentive Qualification, Completion/Delivery Risk, Cash
    # Management, Legal Chain of Title) when empty — see financial_model.py
    # DEFAULT_DILIGENCE_CONTROLS. Producer-editable, same pattern as revenue_overrides.
    diligence_controls = models.JSONField(default=list, blank=True)

    # Cash-flow draw schedule as % of gross budget for the Finance Summary tab.
    # {prep_pct, photography_pct, post_pct, delivery_pct}; defaults to the
    # industry-standard 15/55/20/10 split when empty — see financial_model.py
    # DEFAULT_DRAW_SCHEDULE.
    draw_schedule = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'projects'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Budget(models.Model):
    class FileType(models.TextChoices):
        PDF = 'PDF', 'PDF'
        CSV = 'CSV', 'CSV'
        XLSX = 'XLSX', 'Excel'

    class ExtractionStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        EXTRACTED = 'EXTRACTED', 'Extracted'
        FAILED = 'FAILED', 'Failed'
        MANUAL_REVIEW = 'MANUAL_REVIEW', 'Manual Review Required'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='budgets')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10, choices=FileType.choices)
    file = models.FileField(upload_to='budgets/%Y/%m/')
    extraction_status = models.CharField(
        max_length=20, choices=ExtractionStatus.choices, default=ExtractionStatus.PENDING
    )
    extracted_data = models.JSONField(default=dict, blank=True)
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    extracted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_budgets'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'budgets'
        ordering = ['-created_at']


class BudgetLineItem(models.Model):
    class CommitmentStatus(models.TextChoices):
        BUDGETED_UNCOMMITTED = 'BUDGETED_UNCOMMITTED', 'Budgeted / Uncommitted'
        BUDGETED_COMMITTED = 'BUDGETED_COMMITTED', 'Budgeted / Committed'
        ACTUAL = 'ACTUAL', 'Actual'

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='line_items')
    account_code = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=500)
    category = models.CharField(max_length=100, blank=True)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    is_above_the_line = models.BooleanField(default=False)
    is_local_eligible = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)

    # Granular cost-reporting fields for the Budget Breakdown tab (top-sheet
    # convention: amount = units x rate when both are given; otherwise amount is
    # entered directly). All optional — existing spend-estimate/upload-derived
    # line items keep working with just `amount`.
    vendor_name = models.CharField(max_length=255, blank=True)
    units = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    actual_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    commitment_status = models.CharField(
        max_length=25, choices=CommitmentStatus.choices, default=CommitmentStatus.BUDGETED_UNCOMMITTED,
    )

    class Meta:
        db_table = 'budget_line_items'
        ordering = ['sort_order', 'id']
