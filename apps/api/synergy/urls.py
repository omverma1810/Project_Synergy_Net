from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/territories/', include('territories.urls')),
    path('api/analysis/', include('analysis.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/partners/', include('partners.urls')),
    path('api/advisor/', include('advisor.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
