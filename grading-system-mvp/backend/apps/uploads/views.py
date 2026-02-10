from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from .models import Submission, AnswerSheet
from .serializers import SubmissionSerializer, AnswerSheetSerializer
from apps.tests.models import Question
from apps.students.models import Student
from .image_processor import ImageProcessor
import random
import os
import hashlib
import tempfile
from datetime import datetime
import cv2

class SubmissionViewSet(viewsets.ModelViewSet):
    queryset = Submission.objects.all()
    serializer_class = SubmissionSerializer

    @action(detail=False, methods=['post'])
    def upload_answers(self, request):
        """
        Upload answer sheet for a student.
        Two modes:
        1. Single full answer sheet (answer_sheet) - will be duplicated for all questions
        2. Individual question files (question_1, question_2, etc.)
        """
        test_id = request.data.get('test_id')
        student_id = request.data.get('student_id')
        roll_number = request.data.get('roll_number')

        if not test_id:
            return Response(
                {'error': 'test_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not student_id and not roll_number:
            return Response(
                {'error': 'Either student_id or roll_number is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get test to extract grade
        from apps.tests.models import Test
        try:
            test = Test.objects.get(test_id=test_id)
        except Test.DoesNotExist:
            return Response(
                {'error': 'Test not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get or create student
        student = None

        # First try to find by student_id if provided
        if student_id:
            try:
                student = Student.objects.get(student_id=student_id)
                if roll_number and student.roll_number != roll_number:
                    return Response(
                        {'error': f'Roll number mismatch for student {student.name}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                # Ensure student belongs to the same grade as the test
                if student.grade != test.grade:
                    print(f"⚠️ student_id grade mismatch: student grade={student.grade}, "
                          f"test grade={test.grade}. Ignoring student_id, will lookup by roll_number.")
                    student = None  # Force lookup by roll_number + grade
            except Student.DoesNotExist:
                pass  # Will try to find/create by roll_number

        # If not found by student_id, try by roll_number within the same grade
        if not student and roll_number:
            try:
                student = Student.objects.get(roll_number=roll_number, grade=test.grade)
            except Student.DoesNotExist:
                # Create new student with roll_number
                student = Student.objects.create(
                    roll_number=roll_number,
                    name=f"Student {roll_number}",  # Default name, can be updated later
                    grade=test.grade
                )
                print(f"✨ Auto-created student: {student.name} (Roll No: {roll_number}, Grade: {test.grade})")

        if not student:
            return Response(
                {'error': 'Could not find or create student'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create submission (use the actual student object we found/created)
        submission, created = Submission.objects.get_or_create(
            test_id=test_id,
            student_id=student.student_id,  # Use the student we just found/created
            defaults={'status': 'pending'}
        )

        # Get all questions for this test
        questions = Question.objects.filter(test_id=test_id).order_by('question_number')

        if not questions.exists():
            return Response(
                {'error': 'No questions found for this test'},
                status=status.HTTP_400_BAD_REQUEST
            )

        uploaded_count = 0

        # Check if single answer sheet uploaded
        if 'answer_sheet' in request.FILES:
            # Single full answer sheet - extract individual question sections
            answer_sheet_file = request.FILES['answer_sheet']

            # Determine file extension from uploaded file
            file_ext = os.path.splitext(answer_sheet_file.name)[1] or '.jpg'
            if not file_ext:
                file_ext = '.jpg'

            # Ensure file read pointer is at start (guards against any prior reads)
            answer_sheet_file.seek(0)

            # Save uploaded file temporarily with correct extension
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
                for chunk in answer_sheet_file.chunks():
                    temp_file.write(chunk)
                temp_path = temp_file.name

            # Debug: log file identity so we can verify the correct file is processed
            temp_size = os.path.getsize(temp_path)
            with open(temp_path, 'rb') as f:
                file_hash = hashlib.md5(f.read()).hexdigest()[:12]
            print(f"📄 Upload: file='{answer_sheet_file.name}', size={temp_size}, "
                  f"hash={file_hash}, test={test.test_name}({test.grade}), "
                  f"student={student.roll_number}({student.grade}), temp={temp_path}",
                  flush=True)

            try:
                # Delete ALL old answer sheets for this submission before re-extracting.
                old_sheets = AnswerSheet.objects.filter(submission=submission)
                old_count = old_sheets.count()
                if old_count > 0:
                    old_sheets.delete()
                    print(f"🗑️ Deleted {old_count} old answer sheets for "
                          f"{student.roll_number} in {test.test_name}({test.grade})",
                          flush=True)

                # Initialize image processor
                processor = ImageProcessor()

                # Process answer sheet to extract question sections
                result = processor.process_answer_sheet(
                    temp_path,
                    num_questions=len(questions),
                    use_advanced=False  # Use simple extraction for now
                )

                # Check if processing failed
                if result.get('error'):
                    return Response(
                        {'error': f"Failed to process answer sheet: {result['error']}. If uploading PDF, make sure poppler is installed."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get extracted question images
                question_images = result.get('question_images', [])
                quality_score = result.get('quality_score', 0.75)
                confidence_level = result.get('confidence_level', 'medium')

                if len(question_images) != len(questions):
                    # Extraction count mismatch — fall back to equal-split
                    print(f"⚠️ Extracted {len(question_images)} sections but expected "
                          f"{len(questions)}. Falling back to equal split.")

                    if not question_images:
                        import cv2 as cv2_fallback
                        processed_img = cv2_fallback.imread(temp_path) if not processor.is_pdf(temp_path) else None
                        if processed_img is None:
                            img_path, _ = processor.convert_pdf_to_image(temp_path)
                            if img_path:
                                processed_img = cv2_fallback.imread(img_path)
                                os.remove(img_path)

                        if processed_img is not None:
                            h = processed_img.shape[0]
                            section_h = h // len(questions)
                            question_images = [
                                processed_img[i * section_h:(i + 1) * section_h]
                                for i in range(len(questions))
                            ]

                    confidence_level = 'low'

                # Save ALL extracted images as fresh AnswerSheet records
                for idx, question in enumerate(questions):
                    if idx < len(question_images):
                        _, buffer = cv2.imencode('.jpg', question_images[idx])
                        image_bytes = buffer.tobytes()

                        AnswerSheet.objects.create(
                            submission=submission,
                            question=question,
                            image_data=image_bytes,
                            quality_score=quality_score,
                            confidence_level=confidence_level,
                            processed_at=datetime.now()
                        )

                        print(f"  ✅ Q{question.question_number}: saved to DB "
                              f"({len(image_bytes)} bytes)", flush=True)
                    else:
                        AnswerSheet.objects.create(
                            submission=submission,
                            question=question,
                            quality_score=0.0,
                            confidence_level='low',
                            processed_at=datetime.now()
                        )
                    uploaded_count += 1

            except Exception as e:
                # Detailed error logging
                import traceback
                print(f"Error processing answer sheet:")
                print(f"  Error type: {type(e).__name__}")
                print(f"  Error message: {str(e)}")
                print(f"  Traceback:")
                traceback.print_exc()

                return Response(
                    {'error': f'Failed to process answer sheet: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            finally:
                # Clean up temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        else:
            # Individual question files — also nuke old sheets first
            old_sheets = AnswerSheet.objects.filter(submission=submission)
            if old_sheets.exists():
                old_sheets.delete()

            for key in request.FILES:
                if key.startswith('question_'):
                    question_number = int(key.split('_')[1])
                    image_file = request.FILES[key]

                    try:
                        question = Question.objects.get(
                            test_id=test_id,
                            question_number=question_number
                        )

                        # Read uploaded file bytes directly into DB
                        image_bytes = image_file.read()

                        AnswerSheet.objects.create(
                            submission=submission,
                            question=question,
                            image_data=image_bytes,
                            quality_score=round(random.uniform(0.6, 1.0), 2),
                            confidence_level=random.choice(['high', 'medium']),
                            processed_at=datetime.now()
                        )
                        uploaded_count += 1
                    except Question.DoesNotExist:
                        continue

        if uploaded_count == 0:
            return Response(
                {'error': 'No valid answer sheets uploaded'},
                status=status.HTTP_400_BAD_REQUEST
            )

        submission.status = 'processed'
        submission.save()

        return Response({
            'message': f'Successfully uploaded {uploaded_count} answer sheet(s) for {student.name}',
            'submission_id': str(submission.submission_id),
            'student_name': student.name,
            'roll_number': student.roll_number
        })

class AnswerSheetViewSet(viewsets.ModelViewSet):
    queryset = AnswerSheet.objects.all()
    serializer_class = AnswerSheetSerializer


def serve_answer_image(request, answer_id):
    """Serve answer sheet image bytes directly from the database."""
    sheet = get_object_or_404(AnswerSheet, answer_id=answer_id)
    if not sheet.image_data:
        return HttpResponse(status=404)
    return HttpResponse(sheet.image_data, content_type='image/jpeg')
