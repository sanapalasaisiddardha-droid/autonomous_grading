from django.contrib import admin
from .models import GradingSession, StudentAnonymization, Grade

@admin.register(GradingSession)
class GradingSessionAdmin(admin.ModelAdmin):
    list_display = ('test', 'question', 'teacher', 'status', 'created_at')
    list_filter = ('status', 'test')

@admin.register(StudentAnonymization)
class StudentAnonymizationAdmin(admin.ModelAdmin):
    list_display = ('anonymous_code', 'session', 'student')
    list_filter = ('session',)

@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ('answer_sheet', 'marks_awarded', 'teacher', 'graded_at')
    list_filter = ('session__test', 'teacher')
