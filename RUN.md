# FaceAttend College Edition — How to Run

## Step 1 — Install Python 3.11+
Download from https://www.python.org/downloads/
Check "Add Python to PATH" during install.

## Step 2 — Run Setup (one time only)
```bat
setup.bat
```
This installs all dependencies including TensorFlow/DeepFace (~5-10 min).

## Step 3 — Configure Email (Optional)
For OTP emails to actually send, set these before starting:
```bat
set SMTP_EMAIL=youremail@gmail.com
set SMTP_PASSWORD=your_app_password
```
Without this, OTPs are printed to the console (dev mode — fine for testing).

## Step 4 — Start Server
```bat
start.bat
```
Open http://localhost:5000

---

## Default Login
| Role  | Email            | Password |
|-------|------------------|----------|
| Admin | admin@gmail.com  | admin123 |

---

## How to Use

### Admin Workflow
1. Login as admin
2. Go to **Manage Teachers** → fill name + Gmail → click **Send OTP** → enter OTP → **Create Account**
   - Teacher receives login credentials by email (or check console in dev mode)
3. Click **Assign** next to a teacher → enter Branch/Class/Section → **Assign**
4. Go to **Manage Students** → fill details + Gmail → **Send OTP** → enter OTP → **Add Student**
5. Click **Enroll** next to a student → allow camera → **Start Capture**
6. View reports in **Reports** tab, filter by branch/class/section, export CSV

### Teacher Workflow
1. Login with admin-assigned Gmail + temp password
2. Go to **Reset Password** to change your password (OTP sent to your Gmail)
3. Click **Take Attendance** → select your assigned class → **Confirm Class**
4. Click **Start Camera** → **Capture & Mark Attendance**
5. View your class reports in **Reports**

---

## Notes
- Only @gmail.com addresses are accepted
- OTP is valid for 10 minutes
- Face enrollment requires 8 samples (system guides you through angles)
- First attendance capture after server start takes 10-15s (AI model loading)
