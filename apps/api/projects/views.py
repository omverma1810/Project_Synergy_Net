from rest_framework import generics, permissions, parsers
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from .models import Project, Budget, BudgetLineItem
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    BudgetSerializer,
    BudgetLineItemSerializer,
)
from .tasks import extract_budget_data


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Project.objects.filter(producer=self.request.user)

    def perform_create(self, serializer):
        title = serializer.validated_data['title']
        slug = base_slug = slugify(title)
        counter = 1
        while Project.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        serializer.save(producer=self.request.user, slug=slug)


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'pk'

    def get_queryset(self):
        return Project.objects.filter(producer=self.request.user)


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
