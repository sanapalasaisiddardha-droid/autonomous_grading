from django.db import models
import uuid

class Student(models.Model):
    student_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    roll_number = models.CharField(max_length=50, unique=True)
    grade = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['roll_number']

    def __str__(self):
        return f"{self.name} ({self.roll_number})"
