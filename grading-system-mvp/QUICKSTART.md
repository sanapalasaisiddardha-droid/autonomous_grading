# 🚀 QUICK START GUIDE

## For Experienced Developers (5 minutes)

```bash
# Terminal 1 - Backend
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations && python manage.py migrate
python manage.py createsuperuser  # username: admin, password: admin123
python manage.py shell < create_sample_data.py
python manage.py runserver

# Terminal 2 - Frontend  
cd frontend
npm install
npm start

# Open http://localhost:3000
```

---

## For Beginners (Step-by-Step)

### Step 1: Check Prerequisites

Open terminal/command prompt and check:

```bash
python --version   # Should be 3.10+
node --version     # Should be 18+
npm --version      # Should be 9+
```

If not installed:
- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/

### Step 2: Extract ZIP

Extract the `grading-system-mvp.zip` to your desired location.

### Step 3: Open 2 Terminals

You need 2 terminal/command prompt windows:
- Terminal 1: For Backend (Django)
- Terminal 2: For Frontend (React)

### Step 4: Setup Backend (Terminal 1)

```bash
# Navigate to backend folder
cd path/to/grading-system-mvp/backend

# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# You should see (venv) in your prompt

# Install packages (takes 2-3 minutes)
pip install -r requirements.txt

# Setup database
python manage.py makemigrations
python manage.py migrate

# Create admin account (remember these credentials!)
python manage.py createsuperuser
# Enter: username=admin, email=admin@test.com, password=admin123

# Load sample data
python manage.py shell < create_sample_data.py

# Start Django server
python manage.py runserver

# ✅ You should see: "Starting development server at http://127.0.0.1:8000/"
# Keep this terminal open!
```

### Step 5: Setup Frontend (Terminal 2)

Open a NEW terminal window:

```bash
# Navigate to frontend folder
cd path/to/grading-system-mvp/frontend

# Install packages (takes 3-5 minutes)
npm install

# Start React server
npm start

# ✅ Browser should open automatically at http://localhost:3000
# If not, manually open: http://localhost:3000
```

### Step 6: Use the Application

1. **View Tests**
   - You'll see "Weekly Math Test #1"

2. **Start Grading**
   - Click on "Q1" button
   - You'll see 8 anonymous students (S1, S2, S3... S8)

3. **Grade an Answer**
   - Click on a marking grid button (e.g., 2.5)
   - Click "Submit Grade"
   - Answer turns green (graded)

4. **Check Progress**
   - Progress bar updates
   - Grade all 8 students

5. **Move to Next Question**
   - Click "Next Question" button
   - Repeat for Q2, Q3, Q4, Q5

---

## 🎯 What to Test

### Core Feature: Anonymization

1. Grade Q1 for all students
2. Open Django admin: http://localhost:8000/admin
3. Login: admin / admin123
4. Go to: Grading → Student anonymizations
5. See how S1, S2, S3 map to actual students (Alice, Bob, etc.)
6. **Key Point**: The order is randomized per teacher

### Quality Indicators

- Some answers show "⚠ Medium Quality" or "✗ Low Quality"
- These would be flagged for manual review
- Test the "Flag for rescan" checkbox

---

## 🐛 Common Issues

### Backend Issues

**"No module named django"**
```bash
# Ensure virtual environment is activated
# You should see (venv) in your terminal prompt
# If not:
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate  # Windows
```

**"Port 8000 already in use"**
```bash
# Kill existing process
# macOS/Linux:
lsof -ti:8000 | xargs kill -9
# Windows:
netstat -ano | findstr :8000
# Note the PID, then:
taskkill /PID <number> /F
```

### Frontend Issues

**"Cannot find module"**
```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

**"Port 3000 already in use"**
```bash
# React will ask: "Would you like to run on another port?"
# Press: Y
# Or manually kill port 3000 (similar to 8000 above)
```

**"Cannot connect to backend"**
- Ensure Django is running (Terminal 1 should show "Starting development server")
- Check: http://localhost:8000/admin (should load Django admin)

---

## 📁 What's Included

```
grading-system-mvp/
├── README.md              ← Full documentation
├── QUICKSTART.md          ← This file
├── setup.sh               ← Auto-setup (macOS/Linux)
├── setup.bat              ← Auto-setup (Windows)
├── backend/               ← Django application
│   ├── requirements.txt   ← Python packages
│   ├── manage.py
│   └── create_sample_data.py  ← Sample data generator
└── frontend/              ← React application
    ├── package.json       ← NPM packages
    └── src/
```

---

## ✅ Success Checklist

- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:3000
- [ ] Can see test list in browser
- [ ] Can click Q1 and see grading dashboard
- [ ] Can see S1, S2, S3 (anonymous students)
- [ ] Can select marks and submit grade
- [ ] Progress bar updates after grading
- [ ] Can access admin at http://localhost:8000/admin

---

## 🎓 Learning Points

This MVP demonstrates:

1. **Anonymization**: Students appear as S1, S2, S3
2. **Random per teacher**: Different teachers see different orders
3. **Quality flags**: Low-quality submissions are marked
4. **Flexible grading**: Decimal marks (0.5, 1.5, 2.5)
5. **Progress tracking**: Real-time grading status

---

## 📧 Need Help?

Check the full README.md for:
- Detailed API documentation
- Customization guide
- Production deployment steps
- Advanced features roadmap

---

**Enjoy testing unbiased grading! 🚀**
