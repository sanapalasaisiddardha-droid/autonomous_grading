from django.db import models
import uuid

class Test(models.Model):
    test_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test_name = models.CharField(max_length=200)
    subject = models.CharField(max_length=100, blank=True, default='')
    grade = models.CharField(max_length=50)
    total_questions = models.IntegerField()
    test_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-test_date']

    def __str__(self):
        return self.test_name


class Question(models.Model):
    question_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    question_number = models.IntegerField()
    question_text = models.TextField(blank=True, default='')  # The actual question content
    max_marks = models.DecimalField(max_digits=4, decimal_places=2)
    marking_grid = models.JSONField(default=list)  # e.g., [0, 0.5, 1, 1.5, 2]

    class Meta:
        unique_together = ('test', 'question_number')
        ordering = ['question_number']

    def __str__(self):
        return f"{self.test.test_name} - Q{self.question_number}"
