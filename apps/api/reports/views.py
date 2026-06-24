from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import Report
from .serializers import ReportSerializer
from .generators import PDFReportGenerator, ExcelReportGenerator
from analysis.models import Analysis


class ReportListView(generics.ListAPIView):
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Report.objects.filter(analysis__project__producer=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class GenerateReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    FORMAT_ALIASES = {
        'PDF': Report.Format.PDF,
        'EXCEL': Report.Format.EXCEL,
        'XLSX': Report.Format.EXCEL,
        'XLS': Report.Format.EXCEL,
        'JSON': Report.Format.JSON,
    }

    def post(self, request, analysis_id=None):
        if analysis_id is None:
            analysis_id = request.data.get('analysis')
        if analysis_id is None:
            return Response(
                {'detail': 'An analysis id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = get_object_or_404(Analysis, pk=analysis_id, project__producer=request.user)

        if analysis.status != Analysis.Status.COMPLETE:
            return Response(
                {'detail': 'Analysis must be COMPLETE before generating a report.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_format = str(request.data.get('format', 'PDF')).upper()
        report_format = self.FORMAT_ALIASES.get(raw_format)
        if report_format is None:
            return Response(
                {'detail': 'Invalid format. Use PDF or XLSX.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate content to capture file_size; don't persist to disk since
        # Cloud Run's filesystem is ephemeral — DownloadReportView regenerates.
        if report_format == Report.Format.PDF:
            content = PDFReportGenerator(analysis).generate()
        else:
            content = ExcelReportGenerator(analysis).generate()

        report = Report.objects.create(
            analysis=analysis,
            format=report_format,
            generated_by=request.user,
            file_size=len(content),
        )

        serializer = ReportSerializer(report, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DownloadReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, report_id):
        report = get_object_or_404(
            Report, pk=report_id, analysis__project__producer=request.user
        )

        # Regenerate on every download — avoids ephemeral Cloud Run storage issues.
        if report.format == Report.Format.PDF:
            content = PDFReportGenerator(report.analysis).generate()
            content_type = 'application/pdf'
            ext = 'pdf'
        else:
            content = ExcelReportGenerator(report.analysis).generate()
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ext = 'xlsx'

        report.download_count += 1
        report.save(update_fields=['download_count'])

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="synergy_report_{report.id}.{ext}"'
        response['Content-Length'] = len(content)
        return response
