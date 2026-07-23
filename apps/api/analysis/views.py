from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from decimal import Decimal, InvalidOperation
from django.http import HttpResponse
from .models import Analysis, AnalysisResult
from .serializers import AnalysisSerializer, AnalysisResultSerializer
from .tasks import run_analysis, ensure_budget_has_line_items
from .financial_model import build_from_budget
from .financial_pdf import FinancialModelPDF
from projects.models import Project, Budget


class AnalysisListCreateView(generics.ListCreateAPIView):
    """GET: list the user's analyses (optionally filtered by ?project=).
    POST: create an analysis for {project, budget} and run it immediately."""
    serializer_class = AnalysisSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Analysis.objects.filter(project__producer=self.request.user)
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    def create(self, request, *args, **kwargs):
        project_id = request.data.get('project')
        budget_id = request.data.get('budget')

        project = get_object_or_404(Project, pk=project_id, producer=request.user)

        # Resolve budget: explicit id, else the project's most recent budget.
        budget = None
        if budget_id:
            budget = get_object_or_404(Budget, pk=budget_id, project=project)
        else:
            budget = project.budgets.order_by('-created_at').first()

        if not budget:
            return Response(
                {'detail': 'No budget found. Upload a budget file or add spend estimates first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Make sure the engine has line items to work with (synthesises from
        # spend_estimates when the budget was created without extracted items).
        ensure_budget_has_line_items(budget)
        if not budget.line_items.exists():
            return Response(
                {'detail': 'Budget has no line items and no spend estimates to analyse.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        analysis = Analysis.objects.create(
            project=project,
            budget=budget,
            triggered_by=Analysis.Trigger.USER,
        )

        # CELERY_TASK_ALWAYS_EAGER=True in production → runs synchronously.
        # Guard so an engine error surfaces as a FAILED analysis the client can
        # poll, rather than a 500 that loses the analysis id.
        try:
            run_analysis(analysis.id)
        except Exception:  # noqa: BLE001 — status already set to FAILED in task
            pass

        analysis.refresh_from_db()
        serializer = self.get_serializer(analysis)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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


def _resolve_territory(request, project):
    """Explicit ?territory=, else the top-ranked territory from the project's most
    recent completed analysis, else None (engine defaults to Canary Islands)."""
    from territories.models import Territory
    territory_id = request.query_params.get('territory')
    if territory_id:
        return get_object_or_404(Territory, pk=territory_id)
    latest = (
        Analysis.objects.filter(project=project, status='COMPLETED')
        .order_by('-completed_at')
        .first()
    )
    if latest:
        top = latest.results.order_by('rank').select_related('territory').first()
        if top:
            return top.territory
    return None


def _build_project_financial_model(request, project):
    """Shared builder for the JSON + PDF views. Returns (model, budget, None) on
    success or (None, None, error_response) on failure."""
    budget_id = request.query_params.get('budget')
    if budget_id:
        budget = get_object_or_404(Budget, pk=budget_id, project=project)
    else:
        budget = project.budgets.order_by('-created_at').first()

    if not budget:
        return None, None, Response(
            {'detail': 'No budget found. Upload a budget or add spend estimates first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    ensure_budget_has_line_items(budget)
    if not budget.line_items.exists():
        return None, None, Response(
            {'detail': 'Budget has no line items and no spend estimates to model.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    fx_rate = None
    raw_fx = request.query_params.get('fx_rate')
    if raw_fx:
        try:
            fx_rate = Decimal(str(raw_fx))
            if fx_rate <= 0:
                raise InvalidOperation
        except (InvalidOperation, ValueError):
            return None, None, Response(
                {'detail': 'fx_rate must be a positive number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    territory = _resolve_territory(request, project)
    model = build_from_budget(budget, territory=territory, fx_rate=fx_rate)
    model['project'] = {'id': project.id, 'title': project.title, 'budget_id': budget.id}
    return model, budget, None


class FinancialModelView(APIView):
    """GET /analysis/financial-model/<project_id>/

    Returns the Net-Cash-Exposure financial model (Archetype C) for the project's
    most recent budget: incentive/rebate, net cash exposure, capital-stack
    waterline, Floor/Base/Breakout revenue scenarios, and budget sensitivity.

    Optional query params:
      ?budget=<id>       use a specific budget instead of the latest
      ?territory=<id>    incentive program to model (default: top-ranked from the
                         project's latest analysis, else Canary Islands)
      ?fx_rate=<float>   override FX (presentation-currency units per 1 EUR)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id, producer=request.user)
        model, _budget, error = _build_project_financial_model(request, project)
        if error is not None:
            return error
        return Response(model)


class FinancialModelPDFView(APIView):
    """GET /analysis/financial-model/<project_id>/pdf/ — the same model rendered as
    a branded, investor-facing PDF (Investor Snapshot, Incentive Calculation,
    Revenue Scenarios, Budget Sensitivity). Accepts the same query params."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id, producer=request.user)
        model, _budget, error = _build_project_financial_model(request, project)
        if error is not None:
            return error
        try:
            content = FinancialModelPDF(model, project).generate()
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="synergy_financial_model_{project.id}.pdf"'
        )
        response['Content-Length'] = len(content)
        return response


class TriggerAnalysisView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, project_id):
        project = get_object_or_404(Project, pk=project_id, producer=request.user)
        budget = (
            project.budgets.filter(extraction_status='EXTRACTED').first()
            or project.budgets.order_by('-created_at').first()
        )

        if not budget:
            return Response(
                {'error': 'No budget found. Upload a budget or add spend estimates first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ensure_budget_has_line_items(budget)
        analysis = Analysis.objects.create(
            project=project,
            budget=budget,
            triggered_by=Analysis.Trigger.USER,
        )

        try:
            run_analysis(analysis.id)
        except Exception:  # noqa: BLE001
            pass

        analysis.refresh_from_db()
        return Response(AnalysisSerializer(analysis).data, status=status.HTTP_201_CREATED)
