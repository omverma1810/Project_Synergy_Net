from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Profile


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'username', 'role', 'company_name', 'is_verified', 'is_active']
    list_filter = ['role', 'is_verified', 'is_active', 'created_at']
    search_fields = ['email', 'username', 'company_name']
    fieldsets = UserAdmin.fieldsets + (
        ('Synergy', {'fields': ('role', 'company_name', 'company_registration', 'phone', 'country', 'timezone', 'is_verified')}),
    )


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'producer_type', 'partner_type', 'vetting_status']
    list_filter = ['vetting_status', 'producer_type', 'partner_type']
