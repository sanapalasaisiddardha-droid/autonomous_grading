from django.db import models
from django.contrib.auth.models import User
import uuid

class GradingSession(models.Model):
    session_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey('tests.Test', on_delete=models.CASCADE)
    question = models.ForeignKey('tests.Question', on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[('in_progress', 'In Progress'), ('completed', 'Completed')],
        default='in_progress'
    )

    class Meta:
        unique_together = ('test', 'question', 'teacher')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.teacher.username} - {self.test.test_name} Q{self.question.question_number}"


class StudentAnonymization(models.Model):
    anonymization_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(GradingSession, on_delete=models.CASCADE, related_name='anonymizations')
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    anonymous_code = models.CharField(max_length=10)  # S1, S2, S3...
    randomization_seed = models.IntegerField()

    class Meta:
        unique_together = ('session', 'student')
        ordering = ['anonymous_code']

    def __str__(self):
        return f"{self.anonymous_code}"


class Grade(models.Model):
    grade_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    answer_sheet = models.OneToOneField('uploads.AnswerSheet', on_delete=models.CASCADE)
    session = models.ForeignKey(GradingSession, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    marks_awarded = models.DecimalField(max_digits=4, decimal_places=2)
    flag_for_rescan = models.BooleanField(default=False)
    graded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-graded_at']

    def __str__(self):
        return f"{self.marks_awarded} marks"


class Annotation(models.Model):
    annotation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    answer_sheet = models.ForeignKey('uploads.AnswerSheet', on_delete=models.CASCADE)
    session = models.ForeignKey(GradingSession, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    annotation_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('answer_sheet', 'session')
        ordering = ['-updated_at']

    def __str__(self):
        return f"Annotation for {self.answer_sheet} in {self.session}"
