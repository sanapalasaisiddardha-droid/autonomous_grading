from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/students/', include('apps.students.urls')),
    path('api/tests/', include('apps.tests.urls')),
    path('api/uploads/', include('apps.uploads.urls')),
    path('api/grading/', include('apps.grading.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
