# Face Detection Attendance System

Full-stack attendance system with real facial recognition.

## Stack
- **Frontend**: HTML + CSS + Vanilla JS (served by Flask)
- **Backend**: Python Flask REST API
- **Database**: SQLite (auto-created on first run)
- **ML Model**: `face_recognition` library (dlib HOG + 128-d face embeddings)

## Quick Start (Windows)

### 1. Install Python
Download Python 3.10+ from https://www.python.org/downloads/  
✅ Check **"Add Python to PATH"** during install.

### 2. Install Visual C++ Build Tools (required for dlib)
Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/  
Select **"Desktop development with C++"**

### 3. Run Setup
```bat
setup.bat
```

### 4. Start Server
```bat
start.bat
```

Open http://localhost:5000

---

## Quick Start (Linux / Mac)
```bash
chmod +x setup.sh && ./setup.sh
source venv/bin/activate
cd backend && python app.py
```

---

## Docker Deployment
```bash
docker-compose up --build
```

---

## Default Credentials
| Role  | Email             | Password    |
|-------|-------------------|-------------|
| Admin | admin@demo.com    | admin123    |
| User  | user@demo.com     | password123 |

---

## How Face Recognition Works
1. Admin enrolls a user by capturing their face via webcam → stored as 128-d embedding in SQLite
2. On attendance page, webcam frame is sent to `/api/attendance/recognize`
3. Server compares against all stored embeddings using Euclidean distance (tolerance 0.5)
4. Match found → attendance marked with timestamp

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/users | List users (admin) |
| POST | /api/users | Create user (admin) |
| POST | /api/users/:id/enroll | Enroll face (admin) |
| POST | /api/attendance/recognize | Recognize + mark attendance |
| GET | /api/attendance/today | Today's records |
| GET | /api/attendance/stats | Dashboard stats |
| GET | /api/reports | Full report with filters |
| GET | /api/reports/export | Download CSV |
