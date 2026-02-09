"""
Script to create sample data for testing the grading system
Run this after migrations: python manage.py shell < create_sample_data.py
"""

from apps.students.models import Student
from apps.tests.models import Test, Question
from apps.uploads.models import Submission, AnswerSheet
from django.contrib.auth.models import User
from datetime import date
import random

# Create teacher user
teacher, created = User.objects.get_or_create(
    username='teacher1',
    defaults={
        'first_name': 'John',
        'last_name': 'Teacher',
        'email': 'teacher@school.com',
        'is_staff': True
    }
)
if created:
    teacher.set_password('teacher123')
    teacher.save()
    print(f"✓ Created teacher user: {teacher.username}")

# Create students
students_data = [
    {'name': 'Alice Johnson', 'roll_number': 'R001', 'grade': '10-A'},
    {'name': 'Bob Smith', 'roll_number': 'R002', 'grade': '10-A'},
    {'name': 'Charlie Brown', 'roll_number': 'R003', 'grade': '10-A'},
    {'name': 'Diana Prince', 'roll_number': 'R004', 'grade': '10-A'},
    {'name': 'Eve Davis', 'roll_number': 'R005', 'grade': '10-A'},
    {'name': 'Frank Miller', 'roll_number': 'R006', 'grade': '10-A'},
    {'name': 'Grace Lee', 'roll_number': 'R007', 'grade': '10-A'},
    {'name': 'Henry Wilson', 'roll_number': 'R008', 'grade': '10-A'},
]

students = []
for student_data in students_data:
    student, created = Student.objects.get_or_create(
        roll_number=student_data['roll_number'],
        defaults=student_data
    )
    students.append(student)
    if created:
        print(f"✓ Created student: {student.name}")

# Create test
test, created = Test.objects.get_or_create(
    test_name='Weekly Math Test #1',
    defaults={
        'grade': '10-A',
        'total_questions': 5,
        'test_date': date.today()
    }
)
if created:
    print(f"✓ Created test: {test.test_name}")

# Create questions
questions_data = [
    {'question_number': 1, 'max_marks': 4, 'marking_grid': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]},
    {'question_number': 2, 'max_marks': 3, 'marking_grid': [0, 0.5, 1, 1.5, 2, 2.5, 3]},
    {'question_number': 3, 'max_marks': 5, 'marking_grid': [0, 1, 2, 3, 4, 5]},
    {'question_number': 4, 'max_marks': 2, 'marking_grid': [0, 0.5, 1, 1.5, 2]},
    {'question_number': 5, 'max_marks': 6, 'marking_grid': [0, 1, 2, 3, 4, 5, 6]},
]

questions = []
for q_data in questions_data:
    question, created = Question.objects.get_or_create(
        test=test,
        question_number=q_data['question_number'],
        defaults={
            'max_marks': q_data['max_marks'],
            'marking_grid': q_data['marking_grid']
        }
    )
    questions.append(question)
    if created:
        print(f"✓ Created question: Q{question.question_number}")

# Create submissions and answer sheets (without actual images for now)
for student in students:
    submission, created = Submission.objects.get_or_create(
        test=test,
        student=student,
        defaults={'status': 'processed'}
    )
    
    if created:
        print(f"✓ Created submission for: {student.name}")
        
        # Create answer sheets for each question
        for question in questions:
            quality_levels = ['high', 'high', 'high', 'medium', 'low']  # More high quality
            
            answer_sheet, _ = AnswerSheet.objects.get_or_create(
                submission=submission,
                question=question,
                defaults={
                    'quality_score': round(random.uniform(0.6, 1.0), 2),
                    'confidence_level': random.choice(quality_levels),
                    'ocr_text': f'Sample answer text for Q{question.question_number}'
                }
            )

print("\n" + "="*50)
print("✓ Sample data created successfully!")
print("="*50)
print(f"\nCreated:")
print(f"  - 1 Test: {test.test_name}")
print(f"  - {len(questions)} Questions")
print(f"  - {len(students)} Students")
print(f"  - {len(students) * len(questions)} Answer Sheets")
print("\nNote: This MVP doesn't require actual images.")
print("The system will work with the metadata to demonstrate anonymization.")
print("\nNext steps:")
print("1. Run backend: python manage.py runserver")
print("2. Run frontend: cd ../frontend && npm start")
print("3. Open http://localhost:3000")
