@echo off
echo Starting FaceAttend College Edition...
call venv\Scripts\activate

REM ── Configure your Gmail for OTP emails ──────────────────────────────────
REM Replace these with your actual Gmail and App Password
REM Get App Password: https://myaccount.google.com/apppasswords
set SMTP_EMAIL=your gmail id
set SMTP_PASSWORD= 16 digit password

REM ─────────────────────────────────────────────────────────────────────────
cd backend
python app.py
pause
