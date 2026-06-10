from django.urls import path
from .views import ReportListView, GenerateReportView, DownloadReportView

urlpatterns = [
    path('', ReportListView.as_view(), name='report-list'),
    path('generate/<int:analysis_id>/', GenerateReportView.as_view(), name='generate-report'),
    path('download/<int:report_id>/', DownloadReportView.as_view(), name='download-report'),
]
