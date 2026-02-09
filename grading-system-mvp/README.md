# 🎓 Unbiased Grading System - MVP

A Django + React application for anonymized test grading to eliminate teacher bias.

## 📋 Features

- ✅ **Anonymous Grading**: Students are displayed as S1, S2, S3... with unique randomization per teacher
- ✅ **Question-by-Question Grading**: Teachers grade all students' answers for Question 1, then Question 2, etc.
- ✅ **Quality Indicators**: Mock quality scores flag low-quality submissions
- ✅ **Flexible Marking Grid**: Custom marks per question (supports decimals like 0.5, 1.5)
- ✅ **Progress Tracking**: Real-time progress bars show grading completion
- ✅ **Responsive Dashboard**: Modern, user-friendly interface

---

## 🛠️ Tech Stack

**Backend:**
- Django 4.2
- Django REST Framework
- SQLite (for local development)
- Python 3.10+

**Frontend:**
- React 18
- React Router
- Axios
- CSS3

---

## 📦 Installation & Setup

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- pip and npm

### Step 1: Setup Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser (for admin access)
python manage.py createsuperuser
# Follow prompts: username=admin, email=admin@test.com, password=admin123

# Load sample data
python manage.py shell < create_sample_data.py

# Start Django server
python manage.py runserver
```

Backend will run at: **http://localhost:8000**

### Step 2: Setup Frontend

Open a **NEW terminal window** and:

```bash
cd frontend

# Install dependencies
npm install

# Start React development server
npm start
```

Frontend will open automatically at: **http://localhost:3000**

---

## 🚀 Usage Guide

### 1. Access the Application

Open your browser and go to: **http://localhost:3000**

### 2. View Available Tests

- You'll see a list of tests with questions
- Sample test: "Weekly Math Test #1" with 5 questions

### 3. Start Grading

- Click on any question button (Q1, Q2, Q3, etc.)
- Dashboard will load with anonymized student answers

### 4. Grade Answers

- Each student is shown as S1, S2, S3 (anonymous codes)
- View the answer (currently no images in MVP, just quality indicators)
- Select marks from the grading grid
- Optionally flag for rescan if quality is poor
- Click "Submit Grade"

### 5. Track Progress

- Progress bar shows how many students graded
- Filter by "All Answers", "Low Quality", or "Ungraded"
- Once all students graded, click "Next Question"

---

## 📂 Project Structure

```
grading-system-mvp/
├── backend/
│   ├── config/                 # Django settings
│   ├── apps/
│   │   ├── students/           # Student models & APIs
│   │   ├── tests/              # Test & Question models
│   │   ├── uploads/            # Answer submissions
│   │   └── grading/            # Grading logic & anonymization
│   ├── media/                  # Uploaded files
│   ├── manage.py
│   ├── requirements.txt
│   └── create_sample_data.py   # Sample data generator
│
└── frontend/
    ├── src/
    │   ├── components/         # React components
    │   ├── pages/              # Page components
    │   ├── services/           # API calls
    │   └── App.js
    ├── public/
    └── package.json
```

---

## 🔑 Key Concepts

### Anonymization Algorithm

```python
# Each teacher sees DIFFERENT student order for same question
seed = hash(teacher_id + test_id + question_id)
random.seed(seed)
shuffled_students = random.shuffle(students)

# Teacher A sees: S1=Alice, S2=Bob, S3=Charlie
# Teacher B sees: S1=Bob, S2=Charlie, S3=Alice
```

### Grading Flow

```
1. Teacher selects Test + Question
2. Backend creates GradingSession
3. Students are randomized per teacher
4. Anonymized answers displayed (S1, S2, S3...)
5. Teacher grades without knowing identity
6. Backend maps grades back to actual students
```

---

## 🧪 Testing the System

### Test Different Scenarios

1. **Grade Question 1**
   - Go to test and click Q1
   - Grade all 8 students
   - Notice S1, S2, S3 codes

2. **Check Quality Flags**
   - Some answers marked "Low Quality"
   - Test the "Flag for rescan" option

3. **Complete Grading**
   - Finish all students for Q1
   - Click "Next Question" to move to Q2

4. **Verify Anonymization**
   - Open Django admin: http://localhost:8000/admin
   - Login with superuser credentials
   - Check `StudentAnonymization` table
   - See that S1 maps to different actual students

---

## 🎯 API Endpoints

### Tests
- `GET /api/tests/tests/` - List all tests
- `GET /api/tests/tests/{id}/` - Get test details

### Grading Sessions
- `POST /api/grading/sessions/start_session/` - Start grading
- `GET /api/grading/sessions/{id}/get_answers/` - Get anonymized answers
- `POST /api/grading/sessions/{id}/submit_grades/` - Submit grades

### Students
- `GET /api/students/` - List students

---

## 📊 Sample Data Included

The `create_sample_data.py` script creates:

- **1 Test**: Weekly Math Test #1 (5 questions)
- **8 Students**: Alice, Bob, Charlie, Diana, Eve, Frank, Grace, Henry
- **40 Answer Sheets**: 8 students × 5 questions
- **Quality Scores**: Random (60-100%) with some flagged as low quality

---

## 🔧 Customization

### Add More Tests

```bash
python manage.py shell
```

```python
from apps.tests.models import Test, Question
from datetime import date

test = Test.objects.create(
    test_name='Physics Test',
    grade='10-A',
    total_questions=10,
    test_date=date.today()
)

Question.objects.create(
    test=test,
    question_number=1,
    max_marks=5,
    marking_grid=[0, 1, 2, 3, 4, 5]
)
```

### Add More Students

```python
from apps.students.models import Student

Student.objects.create(
    name='New Student',
    roll_number='R009',
    grade='10-A'
)
```

---

## 🐛 Troubleshooting

### Backend Issues

**Error: "Port 8000 already in use"**
```bash
# Kill the process
# macOS/Linux:
lsof -ti:8000 | xargs kill -9
# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Error: "No module named 'apps'"**
```bash
# Ensure you're in backend directory
cd backend
# Reinstall requirements
pip install -r requirements.txt
```

### Frontend Issues

**Error: "Port 3000 already in use"**
```bash
# Frontend will ask to use 3001, press 'y'
# Or kill the process:
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

**Error: "Cannot connect to backend"**
- Ensure Django is running on port 8000
- Check `package.json` has `"proxy": "http://localhost:8000"`

---

## 🚀 Next Steps (Full Production)

This MVP demonstrates the core concept. For production:

1. **Add Image Upload**
   - Implement actual image upload from students
   - Integrate Google Cloud Vision API for OCR
   - Real quality assessment

2. **Add Authentication**
   - Teacher login system
   - Role-based access control
   - Student submission portal

3. **Database**
   - Switch from SQLite to PostgreSQL
   - Add indexes for performance

4. **Deploy**
   - Backend: AWS/GCP/Heroku
   - Frontend: Vercel/Netlify
   - Media storage: S3/GCS

5. **Advanced Features**
   - Real-time collaboration (multiple teachers)
   - Analytics dashboard
   - Export reports to Excel/PDF
   - Email notifications

---

## 📝 Notes

- This MVP uses **mock quality scores** (no actual image analysis)
- No actual images required - focuses on demonstrating anonymization
- Sample data is auto-generated for testing
- SQLite database is included (db.sqlite3 after migrations)

---

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Verify both servers are running
3. Check browser console for errors (F12)
4. Check Django terminal for API errors

---

## 📄 License

This is a prototype/MVP for educational purposes.

---

## ✅ Quick Start Checklist

- [ ] Python 3.10+ installed
- [ ] Node.js 18+ installed
- [ ] Backend: virtual env created
- [ ] Backend: dependencies installed
- [ ] Backend: migrations run
- [ ] Backend: superuser created
- [ ] Backend: sample data loaded
- [ ] Backend: server running on 8000
- [ ] Frontend: dependencies installed
- [ ] Frontend: server running on 3000
- [ ] Browser: opened http://localhost:3000
- [ ] Can see test list
- [ ] Can start grading Q1
- [ ] Can see anonymous students (S1, S2, S3...)
- [ ] Can submit grades

**Enjoy unbiased grading! 🎓**
