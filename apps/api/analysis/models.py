from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Analysis(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        RUNNING = 'RUNNING', 'Running'
        COMPLETE = 'COMPLETE', 'Complete'
        FAILED = 'FAILED', 'Failed'

    class Trigger(models.TextChoices):
        USER = 'USER', 'User Initiated'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        POLICY_CHANGE = 'POLICY_CHANGE', 'Policy Change'

    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='analyses')
    budget = models.ForeignKey('projects.Budget', on_delete=models.CASCADE, related_name='analyses')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    triggered_by = models.CharField(max_length=20, choices=Trigger.choices, default=Trigger.USER)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analyses'
        ordering = ['-created_at']
        verbose_name_plural = 'analyses'


class AnalysisResult(models.Model):
    class RecoupmentPriority(models.TextChoices):
        FIRST = 'first', 'First Position'
        SHARED = 'shared', 'Shared'
        LAST = 'last', 'Last Position'

    analysis = models.ForeignKey(Analysis, on_delete=models.CASCADE, related_name='results')
    territory = models.ForeignKey('territories.Territory', on_delete=models.CASCADE)
    rank = models.IntegerField()
    qualified_spend_total = models.DecimalField(max_digits=15, decimal_places=2)
    estimated_rebate = models.DecimalField(max_digits=15, decimal_places=2)
    estimated_rebate_pct = models.DecimalField(max_digits=5, decimal_places=2)
    logistics_premium = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    net_benefit = models.DecimalField(max_digits=15, decimal_places=2)
    payback_timeline_months = models.IntegerField(null=True, blank=True)
    confidence_score = models.DecimalField(max_digits=3, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    details = models.JSONField(default=dict)

    # Financing & recoupment
    rebate_timing_months = models.IntegerField(default=12)
    loan_against_rebate_available = models.BooleanField(default=False)
    financing_benefit_estimate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    recoupment_priority = models.CharField(
        max_length=10, choices=RecoupmentPriority.choices, default=RecoupmentPriority.SHARED
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analysis_results'
        ordering = ['rank']
