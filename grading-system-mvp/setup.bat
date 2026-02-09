@echo off
echo 🎓 Unbiased Grading System - Quick Setup
echo ========================================
echo.

REM Backend setup
echo 📦 Setting up Backend...
cd backend

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo Running migrations...
python manage.py makemigrations
python manage.py migrate

echo.
echo 📝 Creating superuser...
echo Please enter admin credentials:
python manage.py createsuperuser

echo.
echo 📊 Loading sample data...
python manage.py shell < create_sample_data.py

echo.
echo ✅ Backend setup complete!
echo.
echo To start backend server, run:
echo   cd backend
echo   venv\Scripts\activate
echo   python manage.py runserver
echo.

REM Frontend setup
cd ..\frontend
echo 📦 Setting up Frontend...
echo Installing dependencies...
call npm install

echo.
echo ✅ Frontend setup complete!
echo.
echo To start frontend server, run:
echo   cd frontend
echo   npm start
echo.
echo ========================================
echo ✅ Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Open 2 command prompts
echo 2. Prompt 1: cd backend ^&^& venv\Scripts\activate ^&^& python manage.py runserver
echo 3. Prompt 2: cd frontend ^&^& npm start
echo 4. Open http://localhost:3000 in your browser
echo.
pause
