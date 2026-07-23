from django.urls import path
from .views import (
    AnalysisListCreateView,
    AnalysisDetailView,
    AnalysisResultListView,
    TriggerAnalysisView,
    FinancialModelView,
)

urlpatterns = [
    path('', AnalysisListCreateView.as_view(), name='analysis-list'),
    path('<int:pk>/', AnalysisDetailView.as_view(), name='analysis-detail'),
    path('<int:analysis_id>/results/', AnalysisResultListView.as_view(), name='analysis-results'),
    path('trigger/<int:project_id>/', TriggerAnalysisView.as_view(), name='trigger-analysis'),
    path('financial-model/<int:project_id>/', FinancialModelView.as_view(), name='financial-model'),
]
