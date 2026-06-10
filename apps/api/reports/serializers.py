from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    project_title = serializers.CharField(source='analysis.project.title', read_only=True)
    analysis_status = serializers.CharField(source='analysis.status', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            'id', 'analysis', 'project_title', 'analysis_status',
            'format', 'file_url', 'file_size', 'generated_at',
            'generated_by', 'download_count', 'expiry_date',
        ]

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None
