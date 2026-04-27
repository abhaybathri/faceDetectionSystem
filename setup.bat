@echo off
echo ============================================
echo  FaceAttend College Edition — Setup
echo ============================================
echo.

echo [1/4] Creating virtual environment...
python -m venv venv
if errorlevel 1 ( echo ERROR: Python not found. Install Python 3.11+ and add to PATH. & pause & exit /b 1 )

echo [2/4] Activating virtual environment...
call venv\Scripts\activate

echo [3/4] Installing core packages...
pip install flask flask-cors opencv-contrib-python Pillow numpy scipy gunicorn

echo [4/4] Installing AI face recognition packages (this takes 5-10 minutes)...
pip install deepface tf-keras

echo.
echo ============================================
echo  Setup complete!
echo  Run start.bat to launch the server.
echo ============================================
pause
