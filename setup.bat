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

echo Installing Flask + core packages...
pip install flask flask-cors Pillow numpy gunicorn --quiet

echo Installing face recognition (dlib pre-built for Windows)...
pip install cmake --quiet
pip install dlib-bin --quiet
pip install face-recognition face-recognition-models --no-deps --quiet

echo.
echo ============================================
echo  Done! Run start.bat to launch.
echo ============================================
pause
