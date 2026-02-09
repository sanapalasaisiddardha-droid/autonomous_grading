from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GradingSessionViewSet, GradeViewSet

router = DefaultRouter()
router.register(r'sessions', GradingSessionViewSet, basename='gradingsession')
router.register(r'grades', GradeViewSet, basename='grade')

urlpatterns = [
    path('', include(router.urls)),
]
