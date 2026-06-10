from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Analysis, AnalysisResult
from .serializers import AnalysisSerializer, AnalysisResultSerializer
from .tasks import run_analysis
from projects.models import Project


class AnalysisListView(generics.ListAPIView):
    serializer_class = AnalysisSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Analysis.objects.filter(project__producer=self.request.user)


class AnalysisDetailView(generics.RetrieveAPIView):
    serializer_class = AnalysisSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Analysis.objects.filter(project__producer=self.request.user)


class AnalysisResultListView(generics.ListAPIView):
    serializer_class = AnalysisResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        analysis = get_object_or_404(
            Analysis, pk=self.kwargs['analysis_id'], project__producer=self.request.user
        )
        return analysis.results.all()


class TriggerAnalysisView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id, producer=request.user)
        budget = project.budgets.filter(extraction_status='EXTRACTED').first()

        if not budget:
            return Response(
                {'error': 'No extracted budget found. Upload and process a budget first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = Analysis.objects.create(
            project=project,
            budget=budget,
            triggered_by=Analysis.Trigger.USER,
        )

        run_analysis.delay(analysis.id)

        return Response({'analysis_id': analysis.id, 'status': 'PENDING'}, status=status.HTTP_202_ACCEPTED)
