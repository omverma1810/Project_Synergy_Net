from django.contrib import admin
from .models import Report


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'analysis', 'format', 'file_size', 'generated_by', 'download_count', 'generated_at']
    list_filter = ['format']
    raw_id_fields = ['analysis', 'generated_by']
