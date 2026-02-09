from django.contrib import admin
from .models import Submission, AnswerSheet

class AnswerSheetInline(admin.TabularInline):
    model = AnswerSheet
    extra = 0
    readonly_fields = ('image', 'quality_score', 'confidence_level')

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('student', 'test', 'status', 'submitted_at')
    list_filter = ('status', 'test')
    search_fields = ('student__name',)
    inlines = [AnswerSheetInline]

@admin.register(AnswerSheet)
class AnswerSheetAdmin(admin.ModelAdmin):
    list_display = ('submission', 'question', 'confidence_level', 'quality_score')
    list_filter = ('confidence_level', 'question__test')
