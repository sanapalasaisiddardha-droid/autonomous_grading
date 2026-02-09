from django.db import models
from django.db.models.signals import pre_delete
from django.dispatch import receiver
import uuid

class Submission(models.Model):
    submission_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey('tests.Test', on_delete=models.CASCADE)
    student = models.ForeignKey('students.Student', on_delete=models.CASCADE)
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('processed', 'Processed')],
        default='pending'
    )

    class Meta:
        unique_together = ('test', 'student')
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.name} - {self.test.test_name}"


class AnswerSheet(models.Model):
    answer_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey('tests.Question', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='answer_sheets/%Y/%m/%d/')
    quality_score = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    confidence_level = models.CharField(
        max_length=10,
        choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')],
        null=True,
        blank=True
    )
    ocr_text = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('submission', 'question')
        ordering = ['question__question_number']

    def __str__(self):
        return f"{self.submission.student.name} - Q{self.question.question_number}"


@receiver(pre_delete, sender=AnswerSheet)
def delete_answer_sheet_image(sender, instance, **kwargs):
    """Delete the image file from disk when an AnswerSheet is deleted."""
    if instance.image:
        instance.image.delete(save=False)
