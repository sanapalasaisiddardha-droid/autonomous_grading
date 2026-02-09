from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubmissionViewSet, AnswerSheetViewSet

router = DefaultRouter()
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'answers', AnswerSheetViewSet, basename='answersheet')

urlpatterns = [
    path('', include(router.urls)),
]
