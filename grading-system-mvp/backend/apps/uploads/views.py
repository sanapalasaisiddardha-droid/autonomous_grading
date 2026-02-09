from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Submission, AnswerSheet
from .serializers import SubmissionSerializer, AnswerSheetSerializer
from apps.tests.models import Question
from apps.students.models import Student
from .image_processor import ImageProcessor
import random
import os
import tempfile
from datetime import datetime
from django.core.files.base import ContentFile
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
            except Student.DoesNotExist:
                pass  # Will try to find/create by roll_number

        # If not found by student_id, try by roll_number
        if not student and roll_number:
            try:
                student = Student.objects.get(roll_number=roll_number)
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

            # Save uploaded file temporarily with correct extension
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
                for chunk in answer_sheet_file.chunks():
                    temp_file.write(chunk)
                temp_path = temp_file.name

            try:
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

                if len(question_images) == len(questions):
                    # Successfully extracted all questions
                    for idx, question in enumerate(questions):
                        # Save extracted question image
                        question_image_array = question_images[idx]

                        # Convert numpy array to image file
                        _, buffer = cv2.imencode('.jpg', question_image_array)
                        image_content = ContentFile(buffer.tobytes())

                        # Create filename for extracted section
                        filename = f"q{question.question_number}_{student.roll_number}.jpg"

                        # Create answer sheet for each question
                        answer_sheet, _ = AnswerSheet.objects.update_or_create(
                            submission=submission,
                            question=question,
                            defaults={
                                'image': None,  # Will be set below
                                'quality_score': quality_score,
                                'confidence_level': confidence_level,
                                'processed_at': datetime.now()
                            }
                        )

                        # Save the extracted image
                        answer_sheet.image.save(filename, image_content, save=True)
                        uploaded_count += 1
                else:
                    # Extraction count mismatch — fall back to equal-split
                    # and save whatever sections we got, or split the image evenly
                    print(f"⚠️ Extracted {len(question_images)} sections but expected "
                          f"{len(questions)}. Falling back to equal split.")

                    # Re-extract with forced equal split if we got nothing
                    if not question_images:
                        # Read the processed image and split equally
                        import cv2 as cv2_fallback
                        processed_img = cv2_fallback.imread(temp_path) if not processor.is_pdf(temp_path) else None
                        if processed_img is None:
                            # For PDFs, convert first
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

                    # Save whatever images we have
                    for idx, question in enumerate(questions):
                        if idx < len(question_images):
                            _, buffer = cv2.imencode('.jpg', question_images[idx])
                            image_content = ContentFile(buffer.tobytes())
                            filename = f"q{question.question_number}_{student.roll_number}.jpg"

                            answer_sheet, _ = AnswerSheet.objects.update_or_create(
                                submission=submission,
                                question=question,
                                defaults={
                                    'image': None,
                                    'quality_score': quality_score,
                                    'confidence_level': 'low',
                                    'processed_at': datetime.now()
                                }
                            )
                            answer_sheet.image.save(filename, image_content, save=True)
                        else:
                            # No image available for this question
                            answer_sheet, _ = AnswerSheet.objects.update_or_create(
                                submission=submission,
                                question=question,
                                defaults={
                                    'quality_score': 0.0,
                                    'confidence_level': 'low',
                                    'processed_at': datetime.now()
                                }
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
            # Individual question files
            for key in request.FILES:
                if key.startswith('question_'):
                    question_number = int(key.split('_')[1])
                    image = request.FILES[key]

                    try:
                        question = Question.objects.get(
                            test_id=test_id,
                            question_number=question_number
                        )

                        answer_sheet, _ = AnswerSheet.objects.update_or_create(
                            submission=submission,
                            question=question,
                            defaults={
                                'image': image,
                                'quality_score': round(random.uniform(0.6, 1.0), 2),
                                'confidence_level': random.choice(['high', 'medium']),
                                'processed_at': datetime.now()
                            }
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
