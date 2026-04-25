# 🚀 How to Run This Project — Step by Step
`
Make sure you are in the project folder. You should see something like:
C:\Users\abhay\OneDrive\Desktop\faceDetection>


now run this command- .\venv\Scripts\python.exe backend/app.py

Wait for this message to appear: ✅  FaceAttend backend running at http://localhost:5000

 Open Chrome and go to:http://localhost:5000
 `
 


> No programming experience needed. Just follow each step one by one.  
> This guide works on **Windows**, **Mac**, and **Linux**.

---

## 📋 What is This Project?

This is a **Face Detection Attendance System** — a web app that uses your webcam to detect faces and automatically mark attendance. It runs locally on your computer and opens in your browser (like Chrome or Edge).

---

## 🧰 What You Need to Install First (One Time Only)

### Step 1 — Install Git

Git lets you download (clone) this project from GitHub.

- **Windows**: Download from https://git-scm.com/download/win → Install with all default options
- **Mac**: Open Terminal and type `git --version` — if not installed, it will prompt you automatically
- **Linux**: Open Terminal and run `sudo apt install git`

✅ To check it worked, open a terminal and type:
```
git --version
```
You should see something like `git version 2.x.x`

---

### Step 2 — Install Python 3.11

Python is the programming language this project runs on.

- **Windows**: Download from https://www.python.org/downloads/  
  ⚠️ **IMPORTANT**: On the first install screen, check the box that says **"Add Python to PATH"** before clicking Install

- **Mac**: Download from https://www.python.org/downloads/  
  Or if you have Homebrew: `brew install python@3.11`

- **Linux**:
  ```
  sudo apt update && sudo apt install python3.11 python3.11-venv python3-pip
  ```

✅ To check it worked, open a terminal and type:
```
python --version
```
You should see `Python 3.11.x`

---

### Step 3 — Install VS Code (Optional but Recommended)

VS Code is a free code editor that makes everything easier.

Download from: https://code.visualstudio.com/download

---

## 📥 Download (Clone) the Project

### Option A — Using VS Code (Easiest)

1. Open VS Code
2. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on Mac)
3. Type `Git: Clone` and press Enter
4. Paste the GitHub repo URL and press Enter
5. Choose a folder on your computer to save it
6. Click **"Open"** when VS Code asks

### Option B — Using Terminal

Open a terminal (Command Prompt on Windows, Terminal on Mac/Linux) and run:

```bash
git clone https://github.com/YOUR-USERNAME/face-attendance-system.git
cd face-attendance-system
```

> Replace `YOUR-USERNAME/face-attendance-system` with the actual GitHub link.

---

## ▶️ Running the Project

### On Windows

**Double-click `setup.bat`** — this installs everything automatically.

Then **double-click `start.bat`** — this starts the server.

That's it! A terminal window will open and show:
```
✅  FaceAttend backend running at http://localhost:5000
```

---

### On Mac / Linux

Open a terminal inside the project folder and run:

```bash
# Step 1: Give permission to the setup script
chmod +x setup.sh

# Step 2: Run setup (installs everything)
./setup.sh

# Step 3: Start the server
source venv/bin/activate
cd backend
python app.py
```

---

## 🌐 Open in Browser

Once the server is running, open your browser (Chrome, Edge, Firefox) and go to:

```
http://localhost:5000
```

The app will load automatically. 🎉

---

## 🔑 Login Details

Use these to log in and explore the app:

| Who   | Email              | Password     |
|-------|--------------------|--------------|
| Admin | admin@demo.com     | admin123     |
| User  | user@demo.com      | password123  |

---

## 📸 How to Use the App

### As Admin:
1. Login with admin credentials
2. Go to **Manage Users** → Add a new user (name, ID, email)
3. Click the **"Enroll"** button next to a user → allow camera → capture their face
4. That user's face is now saved in the system

### As User:
1. Login with user credentials
2. Click **"Mark Attendance"**
3. Click **"Start Camera"** → allow camera access
4. Click **"Capture & Mark Attendance"**
5. The system recognizes your face and marks you present ✅

### Reports:
- Admin can view all attendance records under **Reports**
- Filter by date, user, or status
- Download as CSV with one click

---

## 🛑 How to Stop the Server

- If you used `start.bat` — just close the terminal window
- If you used the terminal — press `Ctrl + C`

---

## 🔁 How to Run Again Next Time

You only need to run setup once. From next time:

**Windows** → double-click `start.bat`

**Mac/Linux**:
```bash
source venv/bin/activate
cd backend
python app.py
```

Then open http://localhost:5000 again.

---

## ❓ Common Problems & Fixes

### "Python was not found"
→ You forgot to check **"Add Python to PATH"** during install.  
→ Uninstall Python and reinstall it, this time checking that box.

### "Permission denied" on Mac/Linux
→ Run `chmod +x setup.sh` before running it.

### Camera not working
→ Make sure you clicked **"Allow"** when the browser asked for camera permission.  
→ Try Chrome or Edge — they work best with webcam features.

### Port already in use
→ Something else is using port 5000. Change the port in `backend/app.py`:
```python
app.run(debug=True, host="0.0.0.0", port=5001)
```
Then open http://localhost:5001

### Page shows "Not authenticated"
→ Just go to http://localhost:5000 and login again.

---

## 🐳 Running with Docker (Advanced)

If you have Docker installed, you can run the whole thing with one command:

```bash
docker-compose up --build
```

Then open http://localhost:5000

---

## 📁 Project Structure (Just So You Know)

```
face-attendance-system/
│
├── frontend/          ← The website (HTML, CSS, JavaScript)
├── backend/           ← The server (Python + Flask)
│   ├── app.py         ← Main server file
│   ├── database.py    ← SQLite database setup
│   ├── face_engine.py ← Face recognition AI model
│   └── routes/        ← API endpoints
│
├── setup.bat          ← Windows setup script
├── start.bat          ← Windows start script
├── setup.sh           ← Mac/Linux setup script
└── RUN.md             ← This file 👋
```

---

## 💬 Still Stuck?

Open an issue on the GitHub repository and describe your problem. Include:
- Your operating system (Windows 10/11, Mac, Ubuntu...)
- What error message you see
- Which step you got stuck on

We're happy to help! 😊
