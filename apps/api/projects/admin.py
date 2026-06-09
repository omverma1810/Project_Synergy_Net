from django.contrib import admin
from .models import Project, Budget, BudgetLineItem


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'producer', 'type', 'status', 'total_budget', 'currency', 'created_at']
    list_filter = ['type', 'status', 'currency']
    search_fields = ['title', 'slug', 'producer__email']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['project', 'file_name', 'file_type', 'extraction_status', 'confidence_score', 'created_at']
    list_filter = ['file_type', 'extraction_status']
    search_fields = ['project__title', 'file_name']
    readonly_fields = ['created_at', 'extracted_at']


@admin.register(BudgetLineItem)
class BudgetLineItemAdmin(admin.ModelAdmin):
    list_display = ['budget', 'account_code', 'description', 'category', 'amount', 'currency', 'is_above_the_line']
    list_filter = ['category', 'is_above_the_line', 'is_local_eligible', 'currency']
    search_fields = ['description', 'account_code']
