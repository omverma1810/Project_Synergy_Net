from django.urls import path
from .views import (
    AnalysisListCreateView,
    AnalysisDetailView,
    AnalysisResultListView,
    TriggerAnalysisView,
    FinancialModelView,
    FinancialModelPDFView,
    BusinessPlanPDFView,
    PitchDeckPDFView,
    FinancialStructuringPDFView,
)

urlpatterns = [
    path('', AnalysisListCreateView.as_view(), name='analysis-list'),
    path('<int:pk>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('<int:analysis_id>/results/', AnalysisResultListView.as_view(), name='analysis-results'),
    path('trigger/<int:project_id>/', TriggerAnalysisView.as_view(), name='trigger-analysis'),
    path('financial-model/<int:project_id>/', FinancialModelView.as_view(), name='financial-model'),
    path('financial-model/<int:project_id>/pdf/', FinancialModelPDFView.as_view(), name='financial-model-pdf'),
    path('business-plan/<int:project_id>/pdf/', BusinessPlanPDFView.as_view(), name='business-plan-pdf'),
    path('pitch-deck/<int:project_id>/pdf/', PitchDeckPDFView.as_view(), name='pitch-deck-pdf'),
    path('financial-structuring/<int:project_id>/pdf/', FinancialStructuringPDFView.as_view(), name='financial-structuring-pdf'),
]
