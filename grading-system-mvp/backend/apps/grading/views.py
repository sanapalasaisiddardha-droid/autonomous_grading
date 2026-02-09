from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import GradingSession, Grade
from .serializers import GradingSessionSerializer, GradeSubmissionSerializer
from .anonymization import AnonymizationService
from apps.tests.models import Test, Question
from apps.uploads.models import AnswerSheet

class GradingSessionViewSet(viewsets.ModelViewSet):
    queryset = GradingSession.objects.all()
    serializer_class = GradingSessionSerializer
    
    @action(detail=False, methods=['post'])
    def start_session(self, request):
        """
        Start a new grading session for a teacher
        Expects: test_id, question_number
        """
        test_id = request.data.get('test_id')
        question_number = request.data.get('question_number')
        
        if not test_id or question_number is None:
            return Response(
                {'error': 'test_id and question_number required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        test = get_object_or_404(Test, test_id=test_id)
        question = get_object_or_404(Question, test=test, question_number=question_number)
        
        # Get or create teacher user (for MVP, we'll use first user or create one)
        from django.contrib.auth.models import User
        teacher, _ = User.objects.get_or_create(
            username='teacher1',
            defaults={'first_name': 'Teacher', 'last_name': 'One'}
        )
        
        # Get or create grading session
        session, created = GradingSession.objects.get_or_create(
            test=test,
            question=question,
            teacher=teacher
        )
        
        # Get anonymized answers
        anonymized_answers = AnonymizationService.get_anonymized_answers(session)
        
        serializer = self.get_serializer(session)
        return Response({
            'session': serializer.data,
            'answers': anonymized_answers,
            'total_students': len(anonymized_answers)
        })
    
    @action(detail=True, methods=['get'])
    def get_answers(self, request, pk=None):
        """Get anonymized answers for a grading session"""
        session = self.get_object()
        anonymized_answers = AnonymizationService.get_anonymized_answers(session)
        
        return Response({
            'answers': anonymized_answers,
            'total_students': len(anonymized_answers)
        })
    
    @action(detail=True, methods=['post'])
    def submit_grades(self, request, pk=None):
        """
        Submit grades for multiple answers
        Expects: grades = [{ answer_id, marks_awarded, flag_for_rescan }]
        """
        session = self.get_object()
        grades_data = request.data.get('grades', [])
        
        if not grades_data:
            return Response(
                {'error': 'grades array required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_grades = []
        errors = []
        max_marks = session.question.max_marks

        for grade_data in grades_data:
            serializer = GradeSubmissionSerializer(data=grade_data)
            if serializer.is_valid():
                marks = serializer.validated_data['marks_awarded']

                # Validate marks within allowed range
                if marks < 0 or marks > max_marks:
                    errors.append(
                        f"Answer {serializer.validated_data['answer_id']}: "
                        f"marks_awarded must be between 0 and {max_marks}"
                    )
                    continue

                answer_sheet = get_object_or_404(
                    AnswerSheet,
                    answer_id=serializer.validated_data['answer_id']
                )

                # Create or update grade
                grade, created = Grade.objects.update_or_create(
                    answer_sheet=answer_sheet,
                    session=session,
                    defaults={
                        'teacher': session.teacher,
                        'marks_awarded': marks,
                        'flag_for_rescan': serializer.validated_data.get('flag_for_rescan', False)
                    }
                )
                created_grades.append(str(grade.grade_id))
            else:
                errors.append(
                    f"Invalid data: {serializer.errors}"
                )
        
        # Check if all answers graded
        total_answers = AnswerSheet.objects.filter(
            submission__test=session.test,
            question=session.question
        ).count()
        graded_count = Grade.objects.filter(session=session).count()
        
        if graded_count >= total_answers:
            session.status = 'completed'
            session.save()
        
        response_data = {
            'message': f'Successfully graded {len(created_grades)} answers',
            'graded_count': graded_count,
            'total_count': total_answers,
            'session_complete': session.status == 'completed'
        }
        if errors:
            response_data['errors'] = errors

        return Response(response_data)

    @action(detail=False, methods=['get'])
    def test_results(self, request):
        """
        Get complete results for a test
        Query params: test_id
        Returns: All students with their grades for each question and total marks
        """
        test_id = request.query_params.get('test_id')

        if not test_id:
            return Response(
                {'error': 'test_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        test = get_object_or_404(Test, test_id=test_id)

        # Get all grades for this test
        grades = Grade.objects.filter(
            session__test=test
        ).select_related(
            'answer_sheet__submission__student',
            'answer_sheet__question'
        ).order_by(
            'answer_sheet__submission__student__roll_number',
            'answer_sheet__question__question_number'
        )

        # Group grades by student
        results = {}
        for grade in grades:
            student = grade.answer_sheet.submission.student
            question_num = grade.answer_sheet.question.question_number
            max_marks = grade.answer_sheet.question.max_marks

            student_key = student.student_id

            if student_key not in results:
                results[student_key] = {
                    'student_id': str(student.student_id),
                    'roll_number': student.roll_number,
                    'name': student.name,
                    'grade': student.grade,
                    'questions': {},
                    'total': 0.0,
                    'max_total': 0.0
                }

            results[student_key]['questions'][f'Q{question_num}'] = {
                'marks': float(grade.marks_awarded),
                'max_marks': float(max_marks)
            }
            results[student_key]['total'] += float(grade.marks_awarded)
            results[student_key]['max_total'] += float(max_marks)

        # Convert to list and sort by roll number
        results_list = sorted(
            list(results.values()),
            key=lambda x: x['roll_number']
        )

        return Response({
            'test_id': str(test.test_id),
            'test_name': test.test_name,
            'test_date': test.test_date,
            'grade': test.grade,
            'total_students': len(results_list),
            'results': results_list
        })

class GradeViewSet(viewsets.ReadOnlyModelViewSet):
    """View grades (read-only for now)"""
    queryset = Grade.objects.all()
    
    def list(self, request):
        # Get grades grouped by student
        grades = Grade.objects.select_related(
            'answer_sheet__submission__student',
            'answer_sheet__question',
            'session__test'
        ).all()
        
        # Group by student and test
        results = {}
        for grade in grades:
            student_name = grade.answer_sheet.submission.student.name
            test_name = grade.session.test.test_name
            question_num = grade.answer_sheet.question.question_number
            
            key = f"{student_name}_{test_name}"
            if key not in results:
                results[key] = {
                    'student': student_name,
                    'test': test_name,
                    'grades': {}
                }
            
            results[key]['grades'][f'Q{question_num}'] = float(grade.marks_awarded)
        
        return Response(list(results.values()))
