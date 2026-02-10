from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubmissionViewSet, AnswerSheetViewSet, serve_answer_image

router = DefaultRouter()
router.register(r'submissions', SubmissionViewSet, basename='submission')
router.register(r'answers', AnswerSheetViewSet, basename='answersheet')

urlpatterns = [
    path('answer-image/<uuid:answer_id>/', serve_answer_image, name='serve-answer-image'),
    path('', include(router.urls)),
]
