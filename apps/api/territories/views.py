from rest_framework import generics, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import (
    Territory, TerritoryRule, CoProductionTreaty, QualifiedSpendMapping,
    PolicyAlert, TerritoryPartner,
)
from .serializers import (
    TerritorySerializer, TerritoryListSerializer,
    TerritoryRuleSerializer,
    CoProductionTreatySerializer,
    QualifiedSpendMappingSerializer,
    PolicyAlertSerializer,
    TerritoryPartnerSerializer,
)


class TerritoryListView(generics.ListAPIView):
    serializer_class = TerritoryListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'country_code', 'region']
    ordering_fields = ['name', 'base_percentage', 'region']

    def get_queryset(self):
        qs = Territory.objects.filter(status='ACTIVE')
        region = self.request.query_params.get('region')
        incentive_type = self.request.query_params.get('incentive_type')
        genre = self.request.query_params.get('genre')

        if region:
            qs = qs.filter(region__iexact=region)
        if incentive_type:
            qs = qs.filter(incentive_type__iexact=incentive_type)
        if genre == 'animation':
            qs = qs.filter(animation_eligible=True)
        elif genre == 'documentary':
            qs = qs.filter(documentary_eligible=True)
        elif genre == 'streaming':
            qs = qs.filter(streaming_eligible=True)
        elif genre == 'sci_fi':
            qs = qs.filter(sci_fi_eligible=True)

        return qs


class TerritoryDetailView(generics.RetrieveAPIView):
    queryset = Territory.objects.prefetch_related(
        'rules', 'compliance_items', 'genre_profiles', 'partners'
    )
    serializer_class = TerritorySerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'pk'


class TerritoryRuleListView(generics.ListAPIView):
    serializer_class = TerritoryRuleSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        territory_id = self.kwargs.get('territory_id')
        return TerritoryRule.objects.filter(territory_id=territory_id, is_active=True)


class TerritoryPartnerListView(generics.ListAPIView):
    serializer_class = TerritoryPartnerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        territory_id = self.kwargs.get('territory_id')
        return TerritoryPartner.objects.filter(territory_id=territory_id)


class PolicyAlertListView(generics.ListAPIView):
    serializer_class = PolicyAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PolicyAlert.objects.filter(is_active=True).select_related('territory')
        territory_id = self.request.query_params.get('territory_id')
        if territory_id:
            qs = qs.filter(territory_id=territory_id)
        return qs
