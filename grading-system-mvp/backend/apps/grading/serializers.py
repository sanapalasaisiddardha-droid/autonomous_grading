from rest_framework import serializers
from .models import GradingSession, StudentAnonymization, Grade
from apps.uploads.models import AnswerSheet

class AnonymizedAnswerSerializer(serializers.Serializer):
    """Serializer for anonymized answer display in grading dashboard"""
    anonymous_code = serializers.CharField()
    answer_id = serializers.UUIDField()
    image_url = serializers.CharField()
    quality_score = serializers.DecimalField(max_digits=3, decimal_places=2, allow_null=True)
    confidence_level = serializers.CharField(allow_null=True)
    ocr_text = serializers.CharField(allow_blank=True)
    marks_awarded = serializers.DecimalField(max_digits=4, decimal_places=2, allow_null=True)
    already_graded = serializers.BooleanField()

class GradingSessionSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source='test.test_name', read_only=True)
    total_questions = serializers.IntegerField(source='test.total_questions', read_only=True)
    question_number = serializers.IntegerField(source='question.question_number', read_only=True)
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    max_marks = serializers.DecimalField(source='question.max_marks', max_digits=4, decimal_places=2, read_only=True)
    marking_grid = serializers.JSONField(source='question.marking_grid', read_only=True)

    class Meta:
        model = GradingSession
        fields = '__all__'

class GradeSubmissionSerializer(serializers.Serializer):
    """Serializer for submitting grades"""
    answer_id = serializers.UUIDField()
    marks_awarded = serializers.DecimalField(max_digits=4, decimal_places=2)
    flag_for_rescan = serializers.BooleanField(default=False)
