from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Report(models.Model):
    class Format(models.TextChoices):
        PDF = 'PDF', 'PDF'
        EXCEL = 'EXCEL', 'Excel'
        JSON = 'JSON', 'JSON'

    analysis = models.ForeignKey('analysis.Analysis', on_delete=models.CASCADE, related_name='reports')
    format = models.CharField(max_length=10, choices=Format.choices)
    file = models.FileField(upload_to='reports/%Y/%m/')
    file_size = models.IntegerField(null=True, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    download_count = models.IntegerField(default=0)
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-generated_at']
