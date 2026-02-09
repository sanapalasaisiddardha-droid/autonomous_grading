from rest_framework import serializers
from .models import Submission, AnswerSheet

class AnswerSheetSerializer(serializers.ModelSerializer):
    question_number = serializers.IntegerField(source='question.question_number', read_only=True)
    
    class Meta:
        model = AnswerSheet
        fields = '__all__'

class SubmissionSerializer(serializers.ModelSerializer):
    answers = AnswerSheetSerializer(many=True, read_only=True)
    student_name = serializers.CharField(source='student.name', read_only=True)
    test_name = serializers.CharField(source='test.test_name', read_only=True)
    
    class Meta:
        model = Submission
        fields = '__all__'
