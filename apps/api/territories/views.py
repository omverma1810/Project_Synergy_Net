from rest_framework import generics, permissions
from .models import Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping
from .serializers import (
    TerritorySerializer,
    TerritoryRuleSerializer,
    CoProductionTreatySerializer,
    QualifiedSpendMappingSerializer,
)


class TerritoryListView(generics.ListAPIView):
    queryset = Territory.objects.filter(status='ACTIVE')
    serializer_class = TerritorySerializer
    permission_classes = [permissions.AllowAny]


class TerritoryDetailView(generics.RetrieveAPIView):
    queryset = Territory.objects.all()
    serializer_class = TerritorySerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'pk'


class TerritoryRuleListView(generics.ListAPIView):
    serializer_class = TerritoryRuleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        territory_id = self.kwargs.get('territory_id')
        return TerritoryRule.objects.filter(territory_id=territory_id, is_active=True)
