@echo off
echo ============================================
echo  FaceAttend - Setup Script (Windows)
echo ============================================

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found!
    echo Install Python 3.11 from https://www.python.org/downloads/
    echo Check "Add Python to PATH" during install.
    pause & exit /b 1
)
echo [OK] Python found

python -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet

echo Installing packages (this takes 3-5 minutes)...
pip install flask flask-cors Pillow numpy gunicorn opencv-contrib-python
pip install deepface tf-keras

echo.
echo ============================================
echo  Done! Run: venv\Scripts\activate then cd backend then python app.py
echo ============================================
pause
