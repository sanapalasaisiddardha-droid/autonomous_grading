# 🎓 Unbiased Grading System - Project Workflow & Architecture

## 📌 Quick Summary

**Purpose:** Eliminate teacher bias in grading by anonymizing student identities during test evaluation.

**Core Innovation:** Each teacher sees students in a different random order (S1, S2, S3...) so they can't identify who they're grading, preventing unconscious bias based on student reputation.

**Tech Stack:** Django REST Framework (Backend) + React (Frontend)

---

## 🎯 The Problem Being Solved

### Real-World Issue
Teachers often grade based on student reputation rather than actual answer quality:
- "Smart" students get benefit of doubt → higher marks
- "Weak" students get scrutinized more → lower marks
- Same answer quality receives different marks based on who wrote it

### Our Solution
- Hide student names during grading
- Show anonymous codes: S1, S2, S3...
- Different randomization per teacher (prevents coordination)
- Grade question-by-question (all students' Q1, then all Q2, etc.)
- Backend maintains the real identity mapping

---

## 🔄 Complete System Workflow

### Phase 1: Test Setup & Answer Collection

```
1. Admin creates Test → "Weekly Math Test #1"
2. Admin adds Questions → Q1 (5 marks), Q2 (10 marks), etc.
3. Students write test on paper
4. Students submit answer sheets (photos uploaded)
5. System processes images:
   - Extracts quality score (clarity, brightness)
   - Stores in database with student mapping
```

**Current MVP State:** Mock quality scores, manual answer sheet creation via sample data script

### Phase 2: Teacher Starts Grading

```
Teacher Action: Opens dashboard → Selects "Weekly Math Test #1" → Clicks "Q1"

Backend Process:
1. Creates GradingSession(test=Test1, question=Q1, teacher=TeacherA)
2. Triggers anonymization:
   - Generates unique seed: hash(teacher_id + test_id + question_id)
   - Randomizes student order using this seed
   - Creates mapping: S1→Alice, S2→Charlie, S3→Bob, S4→Diana...
   - Stores in StudentAnonymization table
3. Returns anonymized answer data to frontend

Frontend Display:
- Shows 8 answer cards with codes: S1, S2, S3, S4, S5, S6, S7, S8
- Displays answer image (or quality indicator in MVP)
- Provides grading grid with mark options
- Teacher has NO IDEA who S1, S2, etc. actually are
```

### Phase 3: Grading Process

```
Teacher sees:
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ S1          │  │ S2          │  │ S3          │
│ [Answer]    │  │ [Answer]    │  │ [Answer]    │
│ Quality: 85%│  │ Quality: 62%│  │ Quality: 91%│
│ [0][1][2][3]│  │ [0][1][2][3]│  │ [0][1][2][3]│
│ [4][5]      │  │ [4][5]      │  │ [4][5]      │
│ Submit      │  │ Submit      │  │ Submit      │
└─────────────┘  └─────────────┘  └─────────────┘

Teacher grades each answer objectively without knowing identity.

Backend Process:
1. Receives: { answer_id: "uuid-123", marks_awarded: 4.5 }
2. Creates Grade record linked to:
   - AnswerSheet (the actual student's answer)
   - GradingSession (the grading context)
   - Teacher (who graded it)
3. Updates progress: "6/8 students graded"
4. When all students graded → marks session as 'completed'
```

### Phase 4: Moving to Next Question

```
Teacher clicks "Next Question" → Goes to Q2

Backend repeats Phase 2 with NEW randomization:
- Same teacher, different question → DIFFERENT seed
- NEW student order: S1→Diana, S2→Bob, S3→Alice...
- S1 in Q1 ≠ S1 in Q2 (prevents pattern recognition)
```

### Phase 5: Results & Export

```
After all questions graded:

API Endpoint: GET /api/grading/sessions/test_results/?test_id=xyz

Backend Process:
1. Fetches all Grade records for this test
2. Uses StudentAnonymization to map back to real students
3. Groups by actual student:
   Alice: Q1=4, Q2=7, Q3=9, Q4=5, Q5=8 → Total: 33/50
   Bob: Q1=3, Q2=6, Q3=8, Q4=4, Q5=7 → Total: 28/50
4. Returns complete gradebook with real names

Frontend displays final results table
```

---

## 🏗️ Technical Architecture

### Database Models (Django)

#### 1. Student (apps/students/models.py)
```python
Student:
  - student_id (UUID, Primary Key)
  - name (String)
  - roll_number (String)
  - grade (String)  # e.g., "10-A"
```

#### 2. Test & Question (apps/tests/models.py)
```python
Test:
  - test_id (UUID, Primary Key)
  - test_name (String)
  - grade (String)
  - total_questions (Integer)
  - test_date (Date)

Question:
  - question_id (UUID, Primary Key)
  - test (ForeignKey → Test)
  - question_number (Integer)
  - max_marks (Decimal)
  - marking_grid (JSON Array)  # [0, 0.5, 1, 1.5, 2, 2.5, 3]
```

#### 3. Answer Submission (apps/uploads/models.py)
```python
Submission:
  - submission_id (UUID, Primary Key)
  - test (ForeignKey → Test)
  - student (ForeignKey → Student)
  - submitted_at (DateTime)

AnswerSheet:
  - answer_id (UUID, Primary Key)
  - submission (ForeignKey → Submission)
  - question (ForeignKey → Question)
  - image (ImageField)
  - quality_score (Decimal 0.0-1.0)
  - confidence_level ('high'/'medium'/'low')
  - ocr_text (Text, optional)
```

#### 4. Grading System (apps/grading/models.py)
```python
GradingSession:
  - session_id (UUID, Primary Key)
  - test (ForeignKey → Test)
  - question (ForeignKey → Question)
  - teacher (ForeignKey → User)
  - status ('in_progress'/'completed')
  - created_at (DateTime)
  - UNIQUE constraint: (test, question, teacher)
    → Each teacher can grade each question only once

StudentAnonymization:
  - anonymization_id (UUID, Primary Key)
  - session (ForeignKey → GradingSession)
  - student (ForeignKey → Student)
  - anonymous_code (String)  # "S1", "S2", "S3"...
  - randomization_seed (Integer)
  - UNIQUE constraint: (session, student)
    → Each student appears exactly once per session

Grade:
  - grade_id (UUID, Primary Key)
  - answer_sheet (OneToOneField → AnswerSheet)
  - session (ForeignKey → GradingSession)
  - teacher (ForeignKey → User)
  - marks_awarded (Decimal)
  - flag_for_rescan (Boolean)
  - graded_at (DateTime)
```

### Data Relationships

```
Test ──┬── Question (1 to many)
       └── Submission (1 to many)
              └── AnswerSheet (1 to many, one per question)

GradingSession ──┬── StudentAnonymization (1 to many)
                 └── Grade (1 to many)

AnswerSheet ←─── Grade (1 to 1)
               └─ StudentAnonymization (maps to Student)
```

---

## 🔐 Anonymization Algorithm Deep Dive

### Core Logic (apps/grading/anonymization.py)

```python
def generate_seed(teacher_id, test_id, question_id):
    """
    Creates deterministic but unique seed per combination
    Same inputs → Always same seed
    Different inputs → Different seed
    """
    seed_string = f"{teacher_id}_{test_id}_{question_id}"
    seed = int(hashlib.md5(seed_string.encode()).hexdigest(), 16) % (10**8)
    return seed
```

### Example Scenario

**Students in database:** Alice, Bob, Charlie, Diana, Eve

**Teacher A grades Q1:**
```python
seed = hash("teacher-a_test-1_question-1") = 12345678
random.seed(12345678)
shuffled = random.sample([Alice, Bob, Charlie, Diana, Eve], 5)
Result: [Charlie, Alice, Eve, Diana, Bob]

Mapping:
S1 → Charlie
S2 → Alice
S3 → Eve
S4 → Diana
S5 → Bob
```

**Teacher B grades Q1 (same test, same question):**
```python
seed = hash("teacher-b_test-1_question-1") = 87654321  # DIFFERENT!
random.seed(87654321)
shuffled = random.sample([Alice, Bob, Charlie, Diana, Eve], 5)
Result: [Diana, Bob, Alice, Charlie, Eve]  # DIFFERENT ORDER!

Mapping:
S1 → Diana
S2 → Bob
S3 → Alice
S4 → Charlie
S5 → Eve
```

**Teacher A grades Q2 (same teacher, different question):**
```python
seed = hash("teacher-a_test-1_question-2") = 45678901  # DIFFERENT!
random.seed(45678901)
shuffled = random.sample([Alice, Bob, Charlie, Diana, Eve], 5)
Result: [Eve, Diana, Charlie, Alice, Bob]  # DIFFERENT ORDER AGAIN!

Mapping:
S1 → Eve      # In Q1, S1 was Charlie - NOW it's Eve!
S2 → Diana    # Teacher can't track students across questions
S3 → Charlie
S4 → Alice
S5 → Bob
```

### Why This Works

1. **Reproducibility:** Same teacher + same question = always same order
   - If teacher refreshes page, S1 is still the same student

2. **Uniqueness per teacher:** Different teachers see different orders
   - Prevents teachers from comparing notes: "S1 is the smart student"

3. **Uniqueness per question:** Same teacher sees different order for each question
   - Prevents pattern recognition: "S1 always performs well"

4. **Cryptographic strength:** MD5 hash ensures unpredictable distribution
   - Teachers can't reverse-engineer who S1 actually is

---

## 🌐 API Endpoints & Flow

### 1. Start Grading Session

**Request:**
```http
POST /api/grading/sessions/start_session/
Content-Type: application/json

{
  "test_id": "uuid-of-test",
  "question_number": 1
}
```

**Backend Processing:**
```python
# views.py:16-55
1. Validates test and question exist
2. Gets/creates teacher user (MVP uses 'teacher1')
3. Gets or creates GradingSession (unique per teacher+question)
4. Calls AnonymizationService.get_anonymized_answers():
   a. Checks if StudentAnonymization records exist
   b. If not, generates seed and creates mapping
   c. Fetches all AnswerSheets for this question
   d. Maps to anonymous codes
   e. Checks if already graded
5. Returns anonymized data
```

**Response:**
```json
{
  "session": {
    "session_id": "uuid",
    "test": "uuid",
    "question": "uuid",
    "status": "in_progress"
  },
  "answers": [
    {
      "anonymous_code": "S1",
      "answer_id": "uuid",
      "image_url": "/media/answers/img.jpg",
      "quality_score": 0.85,
      "confidence_level": "high",
      "marks_awarded": null,
      "already_graded": false
    },
    {
      "anonymous_code": "S2",
      "answer_id": "uuid",
      "quality_score": 0.62,
      "confidence_level": "medium",
      "marks_awarded": null,
      "already_graded": false
    }
    // ... S3, S4, S5, etc.
  ],
  "total_students": 8
}
```

### 2. Submit Grades

**Request:**
```http
POST /api/grading/sessions/{session_id}/submit_grades/
Content-Type: application/json

{
  "grades": [
    {
      "answer_id": "uuid-of-answer",
      "marks_awarded": 4.5,
      "flag_for_rescan": false
    },
    {
      "answer_id": "uuid-of-another-answer",
      "marks_awarded": 3.0,
      "flag_for_rescan": true
    }
  ]
}
```

**Backend Processing:**
```python
# views.py:68-120
1. Validates session exists
2. For each grade in array:
   a. Validates answer_id exists
   b. Creates/updates Grade record
   c. Links to actual student's AnswerSheet
3. Counts total graded vs. total answers
4. If all graded → marks session as 'completed'
5. Returns progress status
```

**Response:**
```json
{
  "message": "Successfully graded 2 answers",
  "graded_count": 6,
  "total_count": 8,
  "session_complete": false
}
```

### 3. Get Test Results (Final Grades)

**Request:**
```http
GET /api/grading/sessions/test_results/?test_id=uuid-of-test
```

**Backend Processing:**
```python
# views.py:122-190
1. Fetches all Grade records for this test
2. Uses select_related to optimize queries:
   - Joins with AnswerSheet → Submission → Student
   - Joins with Question for max marks
3. Groups by actual student (now revealed!)
4. Calculates totals per student
5. Returns sorted by roll number
```

**Response:**
```json
{
  "test_id": "uuid",
  "test_name": "Weekly Math Test #1",
  "test_date": "2026-01-15",
  "grade": "10-A",
  "total_students": 8,
  "results": [
    {
      "student_id": "uuid",
      "roll_number": "R001",
      "name": "Alice Johnson",
      "grade": "10-A",
      "questions": {
        "Q1": { "marks": 4.5, "max_marks": 5 },
        "Q2": { "marks": 7.0, "max_marks": 10 },
        "Q3": { "marks": 9.0, "max_marks": 10 },
        "Q4": { "marks": 4.0, "max_marks": 5 },
        "Q5": { "marks": 8.5, "max_marks": 10 }
      },
      "total": 33.0,
      "max_total": 40.0
    },
    {
      "student_id": "uuid",
      "roll_number": "R002",
      "name": "Bob Smith",
      "questions": { ... },
      "total": 28.5,
      "max_total": 40.0
    }
    // ... other students
  ]
}
```

---

## 🎨 Frontend Architecture (React)

### Key Components

#### 1. GradingDashboard.js (Main Grading UI)
```javascript
Component State:
- test: Selected test object
- question: Current question being graded
- answers: Array of anonymized answers
- session: Current grading session
- filter: 'all' / 'low_quality' / 'ungraded'

Flow:
1. componentDidMount → fetches test data
2. User clicks Q1 button → calls startGradingSession()
3. Backend returns anonymized answers
4. Renders grid of AnswerCard components
5. Each graded card calls submitGrade()
6. Updates progress bar in real-time
```

#### 2. AnswerCard.js (Individual Answer Display)
```javascript
Props:
- answer: { anonymous_code, quality_score, image_url, ... }
- question: { max_marks, marking_grid }
- onGradeSubmit: callback function

Features:
- Displays anonymous code (S1, S2, S3...)
- Shows image or quality indicator
- Renders marking grid buttons
- Handles grade submission
- Shows "already graded" state
```

#### 3. services/api.js (API Communication)
```javascript
Key Functions:
- getTests() → GET /api/tests/tests/
- startGradingSession(testId, questionNum) → POST /api/grading/sessions/start_session/
- submitGrades(sessionId, grades) → POST /api/grading/sessions/{id}/submit_grades/
- getTestResults(testId) → GET /api/grading/sessions/test_results/

Uses axios with base URL: http://localhost:8000/api
```

---

## 📊 Current MVP State

### ✅ Implemented Features

1. **Core Anonymization**
   - Seed-based randomization working
   - Different order per teacher & question
   - Mapping stored in database

2. **Grading Interface**
   - Question-by-question workflow
   - Anonymous student codes (S1, S2, S3...)
   - Flexible marking grid
   - Progress tracking

3. **Data Management**
   - Complete Django models with relationships
   - RESTful API endpoints
   - Sample data generation script

4. **Frontend Dashboard**
   - Responsive React UI
   - Real-time grade submission
   - Filter options (all/low quality/ungraded)
   - Progress indicators

### ⏳ Mock/Placeholder Features

1. **Image Upload**
   - AnswerSheet model has ImageField
   - Currently: No actual upload interface
   - Sample data: Mock quality scores (random 0.6-1.0)

2. **Quality Assessment**
   - Database ready for quality_score & confidence_level
   - Currently: Random mock values
   - Future: Google Cloud Vision API integration

3. **Authentication**
   - Teacher model exists (uses Django User)
   - Currently: Auto-creates 'teacher1' user
   - Future: Real login system

### 🚫 Not Yet Implemented

1. **Real Image Processing**
   - OCR text extraction
   - Actual quality scoring
   - Image enhancement/rotation

2. **Multi-Teacher Support**
   - Currently works for single teacher
   - Backend supports multiple teachers
   - Frontend needs teacher selection UI

3. **Student Portal**
   - No interface for students to upload answers
   - Currently manual data creation

4. **Reports & Analytics**
   - No Excel/PDF export
   - No grading analytics dashboard
   - No email notifications

---

## 🔧 Key Technical Decisions

### Why Django?
- Robust ORM for complex relationships
- Built-in admin interface for data management
- Django REST Framework for clean API design

### Why UUIDs instead of Auto-Increment IDs?
- Prevents guessing student identities
- If we used ID=1,2,3... teacher could correlate with roll numbers
- UUIDs are unpredictable and secure

### Why Question-by-Question Grading?
- Focuses teacher attention on answer quality, not student
- Prevents halo effect (first question influences later ones)
- Standardizes grading criteria per question

### Why Seed-Based Randomization?
- Reproducible: Same teacher always sees same S1
- Unique: Different teachers see different order
- No database storage of random state needed
- Mathematically sound using cryptographic hash

### Why OneToOne Grade↔AnswerSheet?
- Each answer sheet can only be graded once
- Prevents duplicate grading
- Clear ownership of marks

---

## 🐛 Common Issues & Solutions

### Issue: "No students showing in dashboard"
**Cause:** No AnswerSheet records exist for this question
**Solution:** Run create_sample_data.py or manually create AnswerSheet entries

### Issue: "Same S1 for all questions"
**Debug:** Check if generate_seed() includes question_id
**Expected:** Each question should have different seed

### Issue: "Grades not saving"
**Check:**
1. AnswerSheet exists with correct answer_id
2. GradingSession exists and is active
3. API endpoint returns success status
4. Database has Grade records

### Issue: "Multiple teachers see same S1"
**Verify:** generate_seed() includes teacher_id
**Expected:** hash("teacherA_test1_q1") ≠ hash("teacherB_test1_q1")

---

## 🚀 Future Roadmap

### Phase 1 (Next Priority)
- [ ] Real image upload interface
- [ ] Google Cloud Vision API integration
- [ ] JWT authentication for teachers
- [ ] Student submission portal

### Phase 2
- [ ] Excel/PDF report generation
- [ ] Email notifications on grade completion
- [ ] Multi-teacher concurrent grading
- [ ] Grading analytics dashboard

### Phase 3
- [ ] Mobile app (React Native)
- [ ] Auto-crop answer regions from full test sheets
- [ ] ML-based answer similarity detection
- [ ] Rubric-based grading templates
- [ ] Collaborative grading (multiple teachers, average scores)

### Phase 4
- [ ] Answer key comparison
- [ ] Plagiarism detection
- [ ] Voice notes for feedback
- [ ] Integration with LMS platforms

---

## 📁 File Structure Reference

```
backend/
├── config/
│   ├── settings.py           # Django configuration
│   ├── urls.py               # Root URL routing
│   └── wsgi.py
├── apps/
│   ├── students/
│   │   ├── models.py         # Student model
│   │   ├── serializers.py
│   │   └── views.py
│   ├── tests/
│   │   ├── models.py         # Test & Question models
│   │   ├── serializers.py
│   │   └── views.py
│   ├── uploads/
│   │   ├── models.py         # Submission & AnswerSheet
│   │   ├── serializers.py
│   │   └── views.py
│   └── grading/
│       ├── models.py         # GradingSession, Grade, StudentAnonymization
│       ├── serializers.py
│       ├── views.py          # API endpoints
│       └── anonymization.py  # Core anonymization logic ⭐
├── media/                    # Uploaded images
├── manage.py
├── create_sample_data.py     # Sample data generator
└── requirements.txt

frontend/
├── src/
│   ├── components/
│   │   ├── AnswerCard.js     # Individual answer display
│   │   ├── TestCard.js
│   │   └── ProgressBar.js
│   ├── pages/
│   │   ├── GradingDashboard.js  # Main grading interface ⭐
│   │   └── HomePage.js
│   ├── services/
│   │   └── api.js            # API communication layer ⭐
│   ├── App.js
│   └── index.js
└── package.json
```

**⭐ = Most critical files for understanding the system**

---

## 💡 For AI Assistants

When helping with this project:

1. **Understand the anonymization first** - It's the core feature
2. **Check create_sample_data.py** - Shows how all models connect
3. **Read anonymization.py** - Only 91 lines, understand seed logic
4. **Follow the data flow**:
   - Test → Question → AnswerSheet → GradingSession → StudentAnonymization → Grade
5. **Remember the constraints**:
   - GradingSession unique per (test, question, teacher)
   - StudentAnonymization unique per (session, student)
   - Grade OneToOne with AnswerSheet
6. **MVP has mock data** - Quality scores are random, no real images yet
7. **Follow existing patterns** - Don't create new architectures, extend current ones

---

**Last Updated:** February 2026
**Status:** MVP Functional, Ready for Image Upload Integration
