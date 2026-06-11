from django.urls import path
from .views import (
    TerritoryListView, TerritoryDetailView, TerritoryRuleListView,
    TerritoryPartnerListView, PolicyAlertListView,
)

urlpatterns = [
    path('', TerritoryListView.as_view(), name='territory-list'),
    path('<int:pk>/', TerritoryDetailView.as_view(), name='territory-detail'),
    path('<int:territory_id>/rules/', TerritoryRuleListView.as_view(), name='territory-rules'),
    path('<int:territory_id>/partners/', TerritoryPartnerListView.as_view(), name='territory-partners'),
    path('alerts/', PolicyAlertListView.as_view(), name='policy-alerts'),
]
