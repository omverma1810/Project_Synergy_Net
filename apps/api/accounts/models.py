from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        PRODUCER = 'PRODUCER', 'Producer'
        PARTNER = 'PARTNER', 'Partner'
        ADMIN = 'ADMIN', 'Admin'
        ANALYST = 'ANALYST', 'Analyst'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PRODUCER)
    company_name = models.CharField(max_length=255, blank=True)
    company_registration = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    country = models.CharField(max_length=2, blank=True)
    timezone = models.CharField(max_length=50, default='UTC')
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'


class Profile(models.Model):
    class ProducerType(models.TextChoices):
        INDEPENDENT = 'INDEPENDENT', 'Independent'
        MID_MARKET = 'MID_MARKET', 'Mid Market'
        STUDIO = 'STUDIO', 'Studio'

    class PartnerType(models.TextChoices):
        CPA = 'CPA', 'CPA / Accountant'
        LINE_PRODUCER = 'LINE_PRODUCER', 'Line Producer'
        COMPLIANCE_BROKER = 'COMPLIANCE_BROKER', 'Compliance Broker'
        LEGAL = 'LEGAL', 'Legal Advisor'

    class VettingStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    producer_type = models.CharField(max_length=20, choices=ProducerType.choices, blank=True, null=True)
    partner_type = models.CharField(max_length=20, choices=PartnerType.choices, blank=True, null=True)
    credentials = models.JSONField(default=dict, blank=True)
    vetting_status = models.CharField(max_length=20, choices=VettingStatus.choices, default=VettingStatus.PENDING)
    bio = models.TextField(blank=True)
    website = models.URLField(blank=True)
    portfolio_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'profiles'
