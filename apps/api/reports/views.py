from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import FileResponse
from django.core.files.base import ContentFile
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

    # Map the client-facing format aliases to the stored Report.Format value.
    FORMAT_ALIASES = {
        'PDF': Report.Format.PDF,
        'EXCEL': Report.Format.EXCEL,
        'XLSX': Report.Format.EXCEL,
        'XLS': Report.Format.EXCEL,
        'JSON': Report.Format.JSON,
    }

    def post(self, request, analysis_id=None):
        # analysis id may arrive via the URL or the request body.
        if analysis_id is None:
            analysis_id = request.data.get('analysis')
        if analysis_id is None:
            return Response(
                {'error': 'An analysis id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = get_object_or_404(Analysis, pk=analysis_id, project__producer=request.user)

        if analysis.status != Analysis.Status.COMPLETE:
            return Response(
                {'error': 'Analysis must be COMPLETE before generating a report.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_format = str(request.data.get('format', 'PDF')).upper()
        report_format = self.FORMAT_ALIASES.get(raw_format)
        if report_format is None:
            return Response(
                {'error': 'Invalid format. Use PDF or XLSX.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if report_format == Report.Format.PDF:
            content = PDFReportGenerator(analysis).generate()
            filename = f"report_{analysis.id}.pdf"
        else:
            content = ExcelReportGenerator(analysis).generate()
            filename = f"report_{analysis.id}.xlsx"

        report = Report.objects.create(
            analysis=analysis,
            format=report_format,
            generated_by=request.user,
            file_size=len(content),
        )
        report.file.save(filename, ContentFile(content), save=True)

        serializer = ReportSerializer(report, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DownloadReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, report_id):
        report = get_object_or_404(
            Report, pk=report_id, analysis__project__producer=request.user
        )
        report.download_count += 1
        report.save(update_fields=['download_count'])

        ext = 'xlsx' if report.format == Report.Format.EXCEL else report.format.lower()
        return FileResponse(
            report.file.open('rb'),
            as_attachment=True,
            filename=f"synergy_report_{report.id}.{ext}",
        )
