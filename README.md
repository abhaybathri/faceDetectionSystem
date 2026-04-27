# FaceAttend — College Attendance System

AI-powered face recognition attendance system for colleges. Supports Admin and Teacher roles with branch/class/section management.

## Stack
- **Frontend**: HTML + CSS + Vanilla JS (served by Flask)
- **Backend**: Python Flask REST API
- **Database**: SQLite (auto-created on first run)
- **ML Model**: DeepFace + Facenet (128-d face embeddings)

## Quick Start (Windows)

```bat
setup.bat
start.bat
```

Open http://localhost:5000

## Quick Start (Linux / Mac)
```bash
chmod +x setup.sh && ./setup.sh
source venv/bin/activate
cd backend && python app.py
```

## Default Admin Credentials
| Email              | Password  |
|--------------------|-----------|
| admin@gmail.com    | admin123  |

> Note: Only @gmail.com addresses are accepted throughout the system.

## Roles

### Admin
- Login with email/password
- Create teacher accounts (OTP email verification required)
- Add students with branch/class/section assignment (OTP verification required)
- Assign teachers to specific branch/class/section combos
- View attendance reports filtered by branch/class/section
- Export CSV reports

### Teacher
- Login with admin-assigned Gmail credentials
- See only their assigned classes
- Take attendance via face recognition (camera kiosk)
- View and export reports for their classes only
- Reset password via OTP email verification

## Email / OTP Setup (Optional but Recommended)

Set these environment variables before starting:
```
SMTP_EMAIL=youremail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
```

Get an App Password: Google Account → Security → 2-Step Verification → App passwords

Without SMTP config, OTPs are printed to the server console (dev mode).

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Admin or teacher login |
| POST | /api/auth/logout | Logout |
| POST | /api/auth/send-otp | Send password reset OTP |
| POST | /api/auth/reset-password | Reset teacher password |
| GET  | /api/teachers | List teachers (admin) |
| POST | /api/teachers | Create teacher (admin) |
| POST | /api/teachers/send-verify-otp | Verify teacher email |
| POST | /api/teachers/:id/assignments | Assign class to teacher |
| GET  | /api/students | List students |
| POST | /api/students | Create student (admin) |
| POST | /api/students/send-verify-otp | Verify student email |
| POST | /api/students/:id/enroll | Enroll face |
| POST | /api/attendance/recognize | Recognize face + mark attendance |
| GET  | /api/attendance/today | Today's records |
| GET  | /api/attendance/stats | Dashboard stats |
| GET  | /api/reports | Attendance reports with filters |
| GET  | /api/reports/export | Download CSV |
