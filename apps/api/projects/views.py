from decimal import Decimal
from rest_framework import generics, permissions, parsers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from .models import Project, Budget, BudgetLineItem
from .serializers import (
    ProjectListSerializer,
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    BudgetSerializer,
    BudgetLineItemSerializer,
)
from .tasks import extract_budget_data


def _auto_populate_from_spend_estimates(project):
    """Create a synthetic budget + BudgetLineItems from project.spend_estimates."""
    estimates = project.spend_estimates
    if not estimates:
        return None
    budget = Budget.objects.create(
        project=project,
        file_name='spend_estimates_auto',
        file_type=Budget.FileType.CSV,
        extraction_status=Budget.ExtractionStatus.EXTRACTED,
        confidence_score=Decimal('0.50'),
        extracted_at=timezone.now(),
    )
    for idx, (category, amount) in enumerate(estimates.items()):
        BudgetLineItem.objects.create(
            budget=budget,
            description=category,
            category=category,
            amount=Decimal(str(amount)),
            currency=project.currency,
            is_local_eligible=True,
            sort_order=idx,
        )
    return budget


class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        # ProjectListSerializer is a narrow read-only whitelist for the list view;
        # using it for POST silently dropped synopsis/language/dates/territory/
        # cast/timeline (accepted but never persisted, no error). Creation gets
        # the full intake serializer instead.
        if self.request.method == 'POST':
            return ProjectCreateSerializer
        return ProjectListSerializer

    def get_queryset(self):
        return Project.objects.filter(producer=self.request.user)

    def perform_create(self, serializer):
        title = serializer.validated_data['title']
        slug = base_slug = slugify(title)
        counter = 1
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        project = serializer.save(producer=self.request.user, slug=slug)
        # Auto-create budget from spend_estimates if no file provided
        if project.spend_estimates and not project.budgets.exists():
            _auto_populate_from_spend_estimates(project)
            project.status = Project.Status.UPLOADED
            project.save(update_fields=['status'])

    def create(self, request, *args, **kwargs):
        # Respond with the full detail representation (budgets, target_territory_name,
        # etc.) rather than echoing back the narrow create-serializer fields.
        response = super().create(request, *args, **kwargs)
        project = Project.objects.get(pk=response.data['id'])
        response.data = ProjectDetailSerializer(project).data
        return response


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return Project.objects.filter(producer=self.request.user)


class ProjectVettingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not request.user.is_staff:
            return Response({'detail': 'Staff only.'}, status=status.HTTP_403_FORBIDDEN)
        project = get_object_or_404(Project, pk=pk)
        vetting_status = request.data.get('vetting_status')
        vetting_notes = request.data.get('vetting_notes', '')
        if vetting_status not in [c[0] for c in Project.VettingStatus.choices]:
            return Response({'detail': 'Invalid vetting_status.'}, status=status.HTTP_400_BAD_REQUEST)
        project.vetting_status = vetting_status
        project.vetting_notes = vetting_notes
        project.vetting_reviewed_by = request.user
        project.vetting_reviewed_at = timezone.now()
        project.save(update_fields=['vetting_status', 'vetting_notes', 'vetting_reviewed_by', 'vetting_reviewed_at'])
        return Response(ProjectDetailSerializer(project).data)


class BudgetUploadView(generics.CreateAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def perform_create(self, serializer):
        project = get_object_or_404(
            Project, pk=self.kwargs['project_id'], producer=self.request.user
        )
        budget = serializer.save(project=project)
        extract_budget_data.delay(budget.id)


class BudgetLineItemListView(generics.ListAPIView):
    serializer_class = BudgetLineItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        budget = get_object_or_404(
            Budget, pk=self.kwargs['budget_id'], project__producer=self.request.user
        )
        return budget.line_items.all()


class BudgetLineItemUpdateView(generics.UpdateAPIView):
    serializer_class = BudgetLineItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BudgetLineItem.objects.filter(budget__project__producer=self.request.user)
