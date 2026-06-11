from django.urls import path
from .views import (
    ProjectListCreateView,
    ProjectDetailView,
    ProjectVettingView,
    BudgetUploadView,
    BudgetLineItemListView,
    BudgetLineItemUpdateView,
)

urlpatterns = [
    path('', ProjectListCreateView.as_view(), name='project-list'),
    path('<int:pk>/', ProjectDetailView.as_view(), name='project-detail'),
    path('<int:pk>/vetting/', ProjectVettingView.as_view(), name='project-vetting'),
    path('<int:project_id>/upload-budget/', BudgetUploadView.as_view(), name='budget-upload'),
    path('budgets/<int:budget_id>/line-items/', BudgetLineItemListView.as_view(), name='line-item-list'),
    path('line-items/<int:pk>/', BudgetLineItemUpdateView.as_view(), name='line-item-update'),
]
