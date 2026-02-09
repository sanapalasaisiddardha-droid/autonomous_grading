#!/bin/bash

echo "🎓 Unbiased Grading System - Quick Setup"
echo "========================================"
echo ""

# Backend setup
echo "📦 Setting up Backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Running migrations..."
python manage.py makemigrations
python manage.py migrate

echo ""
echo "📝 Creating superuser..."
echo "Please enter admin credentials:"
python manage.py createsuperuser

echo ""
echo "📊 Loading sample data..."
python manage.py shell < create_sample_data.py

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To start backend server, run:"
echo "  cd backend && source venv/bin/activate && python manage.py runserver"
echo ""

# Frontend setup
cd ../frontend
echo "📦 Setting up Frontend..."
echo "Installing dependencies..."
npm install

echo ""
echo "✅ Frontend setup complete!"
echo ""
echo "To start frontend server, run:"
echo "  cd frontend && npm start"
echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open 2 terminal windows"
echo "2. Terminal 1: cd backend && source venv/bin/activate && python manage.py runserver"
echo "3. Terminal 2: cd frontend && npm start"
echo "4. Open http://localhost:3000 in your browser"
echo ""
