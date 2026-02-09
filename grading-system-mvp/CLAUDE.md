# 🤖 CLAUDE.md - Instructions for Claude Code

This file provides context and instructions for Claude Code (or any AI coding assistant) to help implement and extend the Unbiased Grading System.

---
run backend in port 8002

## 📋 Project Overview

**Project Name:** Unbiased Grading System  
**Purpose:** Anonymous test grading dashboard to eliminate teacher bias  
**Tech Stack:** Django (Backend) + React (Frontend)  
**Current Status:** Working MVP with core anonymization feature

---

## 🎯 Core Concept

### Problem Being Solved
Teachers unconsciously give biased grades based on student reputation (smart students get more marks, weak students get less) without properly analyzing answers.

### Solution
- Students shown as anonymous codes: S1, S2, S3...
- Different randomization per teacher (S1 for Teacher A ≠ S1 for Teacher B)
- Question-by-question grading (grade all students' Q1, then Q2, etc.)
- Backend maintains mapping to actual students

---

## 📂 Project Structure

```
grading-system-mvp/
├── backend/                    # Django REST API
│   ├── config/                 # Django settings & URLs
│   ├── apps/
│   │   ├── students/           # Student management
│   │   ├── tests/              # Test & Question models
│   │   ├── uploads/            # Answer sheet uploads
│   │   └── grading/            # Grading logic & anonymization
│   ├── manage.py
│   └── create_sample_data.py   # Sample data generator
│
└── frontend/                   # React SPA
    ├── src/
    │   ├── components/         # Reusable components
    │   ├── pages/              # Page components
    │   └── services/           # API communication
    └── package.json
```

---

## 🔑 Key Files to Understand

### Backend (Django)

1. **`apps/grading/anonymization.py`**
   - Core anonymization logic
   - Creates unique random student order per teacher
   - Algorithm: `seed = hash(teacher_id + test_id + question_id)`

2. **`apps/grading/models.py`**
   - `GradingSession`: Tracks teacher grading a specific question
   - `StudentAnonymization`: Maps S1, S2, S3 → actual students
   - `Grade`: Stores marks awarded

3. **`apps/grading/views.py`**
   - `start_session`: Creates grading session & returns anonymized answers
   - `submit_grades`: Saves grades and maps back to students

4. **`apps/uploads/models.py`**
   - `AnswerSheet`: Stores answer images + quality metadata

### Frontend (React)

1. **`src/pages/GradingDashboard.js`**
   - Main grading interface
   - Displays anonymous students
   - Handles grade submission

2. **`src/components/AnswerCard.js`**
   - Single student answer display
   - Grading grid interface
   - Quality indicators

3. **`src/services/api.js`**
   - API communication layer
   - All backend calls defined here

---

## 🛠️ Common Implementation Tasks

### Task 1: Add Real Image Upload

**Current State:** Mock quality scores, no real images  
**Goal:** Allow students to upload actual answer sheet images

**Files to Modify:**
- `apps/uploads/views.py` - `SubmissionViewSet.upload_answers()`
- `apps/uploads/models.py` - Verify `image` field configuration
- Frontend: Create upload component

**Steps:**
```python
# Backend: apps/uploads/views.py
@action(detail=False, methods=['post'])
def upload_answers(self, request):
    # Get multipart/form-data files
    for key in request.FILES:
        if key.startswith('question_'):
            question_num = int(key.split('_')[1])
            image_file = request.FILES[key]
            
            # Save to AnswerSheet model
            answer_sheet = AnswerSheet.objects.create(
                submission=submission,
                question=question,
                image=image_file  # Django handles file storage
            )
```

```javascript
// Frontend: Create upload form
const uploadAnswers = async (files) => {
  const formData = new FormData();
  formData.append('test_id', testId);
  formData.append('student_id', studentId);
  
  files.forEach((file, index) => {
    formData.append(`question_${index + 1}`, file);
  });
  
  await api.post('/api/uploads/submissions/upload_answers/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
```

---

### Task 2: Integrate Google Cloud Vision API

**Current State:** Mock quality scores (random 0.6-1.0)  
**Goal:** Real OCR + image quality assessment

**Files to Modify:**
- `apps/uploads/services.py` - Create new file for Vision API
- `requirements.txt` - Add `google-cloud-vision`
- `.env` - Add `GOOGLE_APPLICATION_CREDENTIALS`

**Implementation:**
```python
# apps/uploads/services.py
from google.cloud import vision
import io

class ImageQualityService:
    def __init__(self):
        self.client = vision.ImageAnnotatorClient()
    
    def analyze_image(self, image_path):
        """
        Returns: (quality_score, confidence_level, ocr_text)
        """
        with io.open(image_path, 'rb') as image_file:
            content = image_file.read()
        
        image = vision.Image(content=content)
        
        # OCR text detection
        response = self.client.text_detection(image=image)
        texts = response.text_annotations
        ocr_text = texts[0].description if texts else ""
        
        # Document quality detection
        properties = self.client.image_properties(image=image)
        
        # Calculate quality score based on:
        # - Brightness
        # - Contrast  
        # - Sharpness
        # - Text detection confidence
        
        quality_score = self._calculate_quality(response, properties)
        confidence = 'high' if quality_score > 0.75 else 'medium' if quality_score > 0.5 else 'low'
        
        return quality_score, confidence, ocr_text
    
    def _calculate_quality(self, text_response, properties):
        # Implement quality scoring logic
        # Consider: blur, brightness, contrast, OCR confidence
        pass
```

**Usage in views.py:**
```python
from apps.uploads.services import ImageQualityService

def process_answer_sheet(answer_sheet):
    service = ImageQualityService()
    quality_score, confidence, ocr_text = service.analyze_image(answer_sheet.image.path)
    
    answer_sheet.quality_score = quality_score
    answer_sheet.confidence_level = confidence
    answer_sheet.ocr_text = ocr_text
    answer_sheet.save()
```

---

### Task 3: Add Celery for Background Processing

**Goal:** Process images asynchronously without blocking uploads

**Files to Create:**
- `backend/config/celery.py`
- `backend/apps/uploads/tasks.py`

**Implementation:**
```python
# config/celery.py
from celery import Celery
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('grading_system')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# apps/uploads/tasks.py
from celery import shared_task
from .models import AnswerSheet
from .services import ImageQualityService

@shared_task
def process_image_quality(answer_sheet_id):
    answer_sheet = AnswerSheet.objects.get(answer_id=answer_sheet_id)
    service = ImageQualityService()
    
    quality_score, confidence, ocr_text = service.analyze_image(
        answer_sheet.image.path
    )
    
    answer_sheet.quality_score = quality_score
    answer_sheet.confidence_level = confidence
    answer_sheet.ocr_text = ocr_text
    answer_sheet.processed_at = timezone.now()
    answer_sheet.save()

# In views.py - trigger async processing
answer_sheet.save()
process_image_quality.delay(answer_sheet.answer_id)  # Async!
```

**Requirements:**
```txt
# Add to requirements.txt
celery==5.3.4
redis==5.0.1
```

**Run Celery:**
```bash
# Terminal 3 (in addition to Django + React)
celery -A config worker --loglevel=info
```

---

### Task 4: Add Authentication

**Current State:** No login required  
**Goal:** Teachers must login to access grading

**Files to Modify:**
- `config/settings.py` - Add JWT settings
- Create `apps/authentication/` app
- Frontend: Add login page

**Backend:**
```python
# requirements.txt
djangorestframework-simplejwt==5.3.0

# config/settings.py
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

# apps/authentication/views.py
from rest_framework_simplejwt.views import TokenObtainPairView

# urls.py
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('api/auth/login/', TokenObtainPairView.as_view()),
    path('api/auth/refresh/', TokenRefreshView.as_view()),
]
```

**Frontend:**
```javascript
// src/services/api.js
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login function
export const login = async (username, password) => {
  const response = await api.post('/auth/login/', { username, password });
  localStorage.setItem('access_token', response.data.access);
  localStorage.setItem('refresh_token', response.data.refresh);
  return response.data;
};
```

---

### Task 5: Export Results to Excel

**Goal:** Download grading results as Excel file

**Implementation:**
```python
# requirements.txt
openpyxl==3.1.2

# apps/grading/views.py
from openpyxl import Workbook
from django.http import HttpResponse

@action(detail=False, methods=['get'])
def export_results(self, request):
    test_id = request.query_params.get('test_id')
    
    # Get all grades for this test
    grades = Grade.objects.filter(
        session__test_id=test_id
    ).select_related(
        'answer_sheet__submission__student',
        'answer_sheet__question'
    )
    
    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Grading Results"
    
    # Headers
    ws.append(['Student Name', 'Roll Number', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Total'])
    
    # Group by student
    student_grades = {}
    for grade in grades:
        student = grade.answer_sheet.submission.student
        q_num = grade.answer_sheet.question.question_number
        
        if student.student_id not in student_grades:
            student_grades[student.student_id] = {
                'name': student.name,
                'roll': student.roll_number,
                'marks': {}
            }
        
        student_grades[student.student_id]['marks'][q_num] = float(grade.marks_awarded)
    
    # Write rows
    for student_data in student_grades.values():
        row = [
            student_data['name'],
            student_data['roll'],
            student_data['marks'].get(1, 0),
            student_data['marks'].get(2, 0),
            student_data['marks'].get(3, 0),
            student_data['marks'].get(4, 0),
            student_data['marks'].get(5, 0),
            sum(student_data['marks'].values())
        ]
        ws.append(row)
    
    # Prepare response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename=results_test_{test_id}.xlsx'
    wb.save(response)
    
    return response
```

---

## 🔍 Understanding the Anonymization Algorithm

**Core Logic:** `apps/grading/anonymization.py`

```python
def generate_seed(teacher_id, test_id, question_id):
    """
    Creates unique seed per teacher+question combination
    """
    seed_string = f"{teacher_id}_{test_id}_{question_id}"
    seed = int(hashlib.md5(seed_string.encode()).hexdigest(), 16) % (10**8)
    return seed

# Example:
# Teacher A, Test 1, Question 1:
# seed = hash("teacher-a_test-1_question-1") = 12345678
# random.seed(12345678)
# Students shuffled: [Charlie, Alice, Bob, Diana, Eve]
# Mapping: S1=Charlie, S2=Alice, S3=Bob, S4=Diana, S5=Eve

# Teacher B, Test 1, Question 1:
# seed = hash("teacher-b_test-1_question-1") = 87654321  (DIFFERENT!)
# random.seed(87654321)
# Students shuffled: [Eve, Diana, Alice, Charlie, Bob]  (DIFFERENT ORDER!)
# Mapping: S1=Eve, S2=Diana, S3=Alice, S4=Charlie, S5=Bob
```

**Why This Works:**
1. Same teacher + same question = Same seed = Reproducible order
2. Different teacher = Different seed = Different order
3. Same teacher, different question = Different seed = Different order

---

## 🐛 Debugging Tips

### Issue: "No students showing in dashboard"

**Check:**
```bash
# Backend: Verify answer sheets exist
python manage.py shell
>>> from apps.uploads.models import AnswerSheet
>>> AnswerSheet.objects.count()  # Should be > 0

# Backend: Check if submissions exist
>>> from apps.uploads.models import Submission
>>> Submission.objects.all()

# Backend: Verify question exists
>>> from apps.tests.models import Question
>>> Question.objects.filter(question_number=1)
```

**Debug anonymization:**
```python
# In Django shell
from apps.grading.anonymization import AnonymizationService
from apps.grading.models import GradingSession

session = GradingSession.objects.first()
answers = AnonymizationService.get_anonymized_answers(session)
print(answers)  # Should show list of anonymized answers
```

---

### Issue: "CORS errors in frontend"

**Check `config/settings.py`:**
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be at top!
    # ... other middleware
]
```

---

### Issue: "Images not loading"

**Check:**
```python
# settings.py
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# urls.py
from django.conf.urls.static import static
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

**Frontend image URL:**
```javascript
// Must include backend URL
<img src={`http://localhost:8000${answer.image_url}`} />
```

---

## 🧪 Testing Checklist

### Backend Tests
```bash
# Test API endpoints
curl http://localhost:8000/api/tests/tests/
curl http://localhost:8000/api/students/
curl -X POST http://localhost:8000/api/grading/sessions/start_session/ \
  -H "Content-Type: application/json" \
  -d '{"test_id": "uuid", "question_number": 1}'
```

### Frontend Tests
```javascript
// In browser console
fetch('http://localhost:8000/api/tests/tests/')
  .then(r => r.json())
  .then(console.log)
```

### Manual Testing Flow
1. ✅ Create test in Django admin
2. ✅ Add questions to test
3. ✅ Create students
4. ✅ Upload answer sheets (manually via admin or API)
5. ✅ Open frontend → See test
6. ✅ Click Q1 → See anonymized students
7. ✅ Grade answers → Check progress updates
8. ✅ Complete Q1 → Move to Q2
9. ✅ Check admin → Verify grades stored
10. ✅ Check anonymization mapping

---

## 📦 Deployment Preparation

### Environment Variables
```bash
# .env (production)
DEBUG=False
SECRET_KEY=generate-secure-random-key-here
DATABASE_URL=postgresql://user:pass@host:5432/dbname
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
CELERY_BROKER_URL=redis://localhost:6379/0
```

### Database Migration (SQLite → PostgreSQL)
```bash
# requirements.txt
psycopg2-binary==2.9.6

# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT', default='5432'),
    }
}
```

---

## 🚀 Performance Optimization

### Database Queries
```python
# Bad: N+1 queries
for grade in Grade.objects.all():
    print(grade.answer_sheet.submission.student.name)  # Query each time!

# Good: Use select_related
grades = Grade.objects.select_related(
    'answer_sheet__submission__student',
    'answer_sheet__question'
).all()
for grade in grades:
    print(grade.answer_sheet.submission.student.name)  # No extra queries!
```

### API Pagination
```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}
```

### Frontend Optimization
```javascript
// Lazy load images
<img loading="lazy" src={imageUrl} />

// Memoize expensive components
const AnswerCard = React.memo(({ answer, ...props }) => {
  // Component code
});
```

---

## 📚 Resources

### Documentation
- Django REST Framework: https://www.django-rest-framework.org/
- React Router: https://reactrouter.com/
- Google Cloud Vision: https://cloud.google.com/vision/docs
- Celery: https://docs.celeryq.dev/

### Helpful Commands
```bash
# Django
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py shell
python manage.py runserver

# Create new Django app
python manage.py startapp app_name

# React
npm install package-name
npm start
npm run build

# Database
python manage.py dbshell  # Open database shell
python manage.py dumpdata > backup.json  # Backup data
python manage.py loaddata backup.json  # Restore data
```

---

## 🎯 Next Features Roadmap

### Phase 1 (MVP - Current)
- ✅ Basic anonymization
- ✅ Question-by-question grading
- ✅ Mock quality scores
- ✅ Progress tracking

### Phase 2 (In Progress)
- 🔄 Real image upload
- 🔄 Google Cloud Vision integration
- 🔄 Celery background processing
- 🔄 Teacher authentication

### Phase 3 (Planned)
- ⏳ Multiple teacher support (same test, different sessions)
- ⏳ Student portal for submissions
- ⏳ Analytics dashboard
- ⏳ Excel/PDF report generation
- ⏳ Email notifications

### Phase 4 (Future)
- ⏳ Mobile app (React Native)
- ⏳ Auto-answer extraction from full sheets
- ⏳ ML-based answer similarity detection
- ⏳ Rubric-based grading
- ⏳ Collaborative grading (multiple teachers)

---

## 💡 Pro Tips for Claude Code

1. **Always check existing code** before suggesting changes
2. **Use select_related/prefetch_related** for Django queries
3. **Follow the existing architecture** (don't create new patterns)
4. **Test API endpoints** before writing frontend code
5. **Handle errors gracefully** (try-catch, proper status codes)
6. **Write migrations** after model changes
7. **Keep frontend API calls in services/api.js**
8. **Use Django REST Framework serializers** for validation
9. **Document new functions** with docstrings
10. **Ask for clarification** if requirements unclear

---

## 🤝 Contributing Guidelines

When adding new features:

1. **Backend changes:**
   - Create models first
   - Write serializers
   - Create views/viewsets
   - Add URL routes
   - Test with curl/Postman
   - Write migrations

2. **Frontend changes:**
   - Update API service first
   - Create/update components
   - Handle loading/error states
   - Test in browser
   - Ensure responsive design

3. **Documentation:**
   - Update this CLAUDE.md file
   - Add comments for complex logic
   - Update README.md if needed

---

## 📝 Notes

- **Current MVP status:** Fully functional for local development
- **Mock features:** Quality scores (random 0.6-1.0, no real image analysis)
- **Sample data:** 8 students × 5 questions = 40 answer sheets included
- **Database:** SQLite (switch to PostgreSQL for production)
- **Auth:** Not implemented (add JWT for production)
- **Deployment:** Not configured (add Docker, nginx for production)

---

**For questions or clarifications, refer to:**
- `README.md` - Full documentation
- `QUICKSTART.md` - Setup instructions
- `ARCHITECTURE.md` - System design diagrams

**This file last updated:** February 2026

---

Good luck building! 🚀
