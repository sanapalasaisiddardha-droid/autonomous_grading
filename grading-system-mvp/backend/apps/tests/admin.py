from django.contrib import admin
from .models import Test, Question

class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1

@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('test_name', 'grade', 'total_questions', 'test_date')
    search_fields = ('test_name',)
    list_filter = ('grade', 'test_date')
    inlines = [QuestionInline]

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('test', 'question_number', 'max_marks')
    list_filter = ('test',)
