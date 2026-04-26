# 🚀 Face Detection Attendance System — How to Run

> No programming experience needed. Follow each step one by one.
> This guide is for **Windows** users.

---

## 📋 What is This Project?

A web app that uses your webcam and AI (Facenet neural network) to detect faces and automatically mark attendance. It runs on your computer and opens in Chrome or Edge.

---

## 🧰 Step 1 — Install These Three Things (One Time Only)

### 1A — Install Python 3.11

Download from: https://www.python.org/downloads/

> ⚠️ VERY IMPORTANT: On the install screen, check the box **"Add Python to PATH"** before clicking Install. If you miss this, Python won't work.

After installing, open Command Prompt and check:
```
python --version
```
You should see: `Python 3.11.x`

---

### 1B — Install Git

Download from: https://git-scm.com/download/win

Install with all default options. After installing, check:
```
git --version
```
You should see: `git version 2.x.x`

---

### 1C — Install VS Code

Download from: https://code.visualstudio.com/download

Install with all default options.

---

## 📥 Step 2 — Download the Project

Open VS Code, then:

1. Press `Ctrl + Shift + P`
2. Type `Git: Clone` and press Enter
3. Paste the GitHub repo link and press Enter
4. Choose a folder to save it (e.g. Desktop)
5. Click **Open** when VS Code asks

---

## ⚡ Step 3 — Simple Setup (Run These Commands)

Open the terminal in VS Code by pressing `` Ctrl + ` ``

You should see the project folder path in the terminal like:
```
C:\Users\YourName\Desktop\faceDetection>
```

Now run these commands **one by one**, waiting for each to finish before typing the next.

---

### Command 1 — Create virtual environment
```
python -m venv venv
```
> Wait for it to finish. This creates a `venv` folder. Like `node_modules` in MERN.

---

### Command 2 — Activate virtual environment
```
venv\Scripts\activate
```
> You will see `(venv)` appear at the start of the line. That means it worked.

---

### Command 3 — Install core packages
```
pip install flask flask-cors opencv-contrib-python Pillow numpy scipy gunicorn
```
> Wait 2-3 minutes. You will see packages downloading.

---

### Command 4 — Install AI face recognition packages
```
pip install deepface tf-keras
```
> ⏳ This takes 5-10 minutes — it downloads TensorFlow and the Facenet neural network model. This is the AI brain of the project. Wait for it to fully finish.

---

### Command 5 — Go into the backend folder
```
cd backend
```

---

### Command 6 — Start the server
```
python app.py
```

> You will see:
> ```
> ✅  Database initialised
> ✅  FaceAttend backend running at http://localhost:5000
> ```
> **Keep this terminal open. Do not close it.**

---

## 🌐 Step 4 — Open in Browser

Open **Chrome** or **Edge** and go to:

```
http://localhost:5000
```

The app loads. You're done! 🎉

---

## 🔑 Login Details

| Role  | Email           | Password    |
|-------|-----------------|-------------|
| Admin | admin@demo.com  | admin123    |
| User  | user@demo.com   | password123 |

---

## 📸 Step 5 — How to Use the App

### As Admin (first time setup):
1. Login with `admin@demo.com` / `admin123`
2. Go to **Manage Users** → click **Add User** → fill in name, ID, email
3. Click **Enroll** next to the user → allow camera access
4. The system captures **8 face samples** automatically (it will guide you through angles)
5. Face is now saved in the AI model ✅

### As User (marking attendance):
1. Login with your user credentials
2. Click **Mark Attendance**
3. Click **Start Camera** → allow camera access
4. Click **Capture & Mark Attendance**
5. The AI checks your face → marks you Present ✅

> Note: First time you mark attendance after server starts, it takes 10-15 seconds to load the AI model. After that it's fast.

---

## 🔁 How to Run Again Next Time

Setup is done only once. From next time, just open VS Code terminal and run:

```
venv\Scripts\activate
cd backend
python app.py
```

Then open `http://localhost:5000` in Chrome.

---

## 🛑 How to Stop the Server

Press `Ctrl + C` in the terminal.

---

## ❓ Common Problems & Fixes

### "python is not recognized"
→ You forgot to check **"Add Python to PATH"** during install.
→ Uninstall Python, reinstall it, and this time check that box.

### "venv\Scripts\activate is not recognized"
→ Make sure you are in the project folder in the terminal.
→ The terminal should show the faceDetection folder path, not some other folder.

### Camera not working
→ Click **Allow** when Chrome asks for camera permission.
→ Only one app can use the camera at a time — close other apps using it.

### "No module named flask" or "No module named deepface"
→ You forgot to activate venv. Run `venv\Scripts\activate` first, then try again.

### First attendance capture is very slow (10-15 seconds)
→ This is normal. The AI model (Facenet) loads into memory on first use. After that it's fast.

### Face not recognised even though it's the correct person
→ Re-enroll the user. Go to Admin → Manage Users → Enroll.
→ Make sure the room has good lighting when enrolling.
→ Look directly at the camera during enrollment.

### Port 5000 already in use
→ Change port in `backend/app.py`: `port=5001`
→ Then open `http://localhost:5001`

---

## 📁 Project Structure

```
faceDetection/
│
├── frontend/            ← Website (HTML, CSS, JavaScript)
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── backend/             ← Server (Python + Flask)
│   ├── app.py           ← Main server — run this to start
│   ├── database.py      ← SQLite database (auto-created)
│   ├── face_engine.py   ← AI face recognition (Facenet)
│   ├── faceattend.db    ← Database file (auto-created)
│   └── routes/
│       ├── auth.py      ← Login / logout
│       ├── users.py     ← Add / edit / delete users + face enroll
│       ├── attendance.py← Mark attendance via face
│       └── reports.py   ← View and export reports
│
├── venv/                ← Python packages (created by you in setup)
├── setup.bat            ← Auto setup script
├── start.bat            ← Quick start script
└── RUN.md               ← This file 👋
```

---

## 💬 Still Stuck?

Open an issue on GitHub and include:
- What error message you see (copy paste it exactly)
- Which step you got stuck on
- Your Windows version (10 or 11)
