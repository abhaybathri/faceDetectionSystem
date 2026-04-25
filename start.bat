@echo off
echo ============================================
echo  FaceAttend - Starting Server
echo ============================================
call venv\Scripts\activate.bat
cd backend
python app.py
pause
