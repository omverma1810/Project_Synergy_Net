from django.urls import path
from .views import ReportListView, GenerateReportView, DownloadReportView

urlpatterns = [
    path('', ReportListView.as_view(), name='report-list'),
    # Analysis id may be supplied in the request body (preferred by the client)
    # or as a path component (legacy / direct use).
    path('generate/', GenerateReportView.as_view(), name='generate-report'),
    path('generate/<int:analysis_id>/', GenerateReportView.as_view(), name='generate-report-by-id'),
    path('download/<int:report_id>/', DownloadReportView.as_view(), name='download-report'),
]
