from django.urls import path
from .views import TerritoryListView, TerritoryDetailView, TerritoryRuleListView

urlpatterns = [
    path('', TerritoryListView.as_view(), name='territory-list'),
    path('<int:pk>/', TerritoryDetailView.as_view(), name='territory-detail'),
    path('<int:territory_id>/rules/', TerritoryRuleListView.as_view(), name='territory-rules'),
]
