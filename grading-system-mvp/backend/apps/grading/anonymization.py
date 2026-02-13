import hashlib
import random
import time
from django.db import IntegrityError
from apps.grading.models import StudentAnonymization
from apps.uploads.models import AnswerSheet

class AnonymizationService:
    """Service to handle student anonymization for unbiased grading"""

    @staticmethod
    def generate_seed(teacher_id, test_id, question_id):
        """Generate unique seed for randomization"""
        seed_string = f"{teacher_id}_{test_id}_{question_id}"
        seed = int(hashlib.md5(seed_string.encode()).hexdigest(), 16) % (10**8)
        return seed

    @staticmethod
    def create_anonymization_mapping(session):
        """Create randomized student mapping for a grading session"""
        # Get all answer sheets for this test and question
        answer_sheets = AnswerSheet.objects.filter(
            submission__test=session.test,
            question=session.question
        ).select_related('submission__student')

        # Get all students who submitted this question
        students = [ans.submission.student for ans in answer_sheets]

        # Generate seed and randomize
        seed = AnonymizationService.generate_seed(
            session.teacher.id,
            str(session.test.test_id),
            str(session.question.question_id)
        )

        random.seed(seed)
        shuffled_students = random.sample(students, len(students))

        # Create anonymization records
        # Zero-pad the index so codes sort correctly (S01, S02, ... S10, S11)
        total = len(shuffled_students)
        pad_width = len(str(total))
        anonymizations = []
        for idx, student in enumerate(shuffled_students, start=1):
            anon = StudentAnonymization(
                session=session,
                student=student,
                anonymous_code=f"S{idx:0{pad_width}d}",
                randomization_seed=seed
            )
            anonymizations.append(anon)

        # Bulk create, ignore duplicates from concurrent requests
        StudentAnonymization.objects.bulk_create(anonymizations, ignore_conflicts=True)

        return StudentAnonymization.objects.filter(session=session)

    @staticmethod
    def get_anonymized_answers(session):
        """Get all answers with anonymous codes for grading"""
        # Get or create anonymization mapping
        anonymizations = StudentAnonymization.objects.filter(session=session)
        if not anonymizations.exists():
            try:
                anonymizations = AnonymizationService.create_anonymization_mapping(session)
            except IntegrityError:
                # Race condition: another request already created the mapping
                anonymizations = StudentAnonymization.objects.filter(session=session)
        
        # Build result with anonymized data
        results = []
        for anon in anonymizations:
            # Get answer sheet for this student and question
            try:
                answer_sheet = AnswerSheet.objects.get(
                    submission__student=anon.student,
                    submission__test=session.test,
                    question=session.question
                )
                
                # Check if already graded
                from apps.grading.models import Grade, Annotation
                grade = Grade.objects.filter(answer_sheet=answer_sheet, session=session).first()
                annotation = Annotation.objects.filter(answer_sheet=answer_sheet, session=session).first()
                
                # Serve image from DB via API endpoint with cache-buster
                image_url = None
                if answer_sheet.image_data:
                    cache_buster = int(time.time())
                    image_url = f"/api/uploads/answer-image/{answer_sheet.answer_id}/?t={cache_buster}"

                results.append({
                    'anonymous_code': anon.anonymous_code,
                    'answer_id': str(answer_sheet.answer_id),
                    'image_url': image_url,
                    'quality_score': float(answer_sheet.quality_score) if answer_sheet.quality_score else None,
                    'confidence_level': answer_sheet.confidence_level,
                    'ocr_text': answer_sheet.ocr_text,
                    'marks_awarded': float(grade.marks_awarded) if grade else None,
                    'already_graded': grade is not None,
                    'annotation_data': annotation.annotation_data if annotation else None,
                })
            except AnswerSheet.DoesNotExist:
                # Student didn't submit this question
                continue
        
        return results
