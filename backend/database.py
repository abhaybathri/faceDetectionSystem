"""
SQLite database — FaceAttend College Edition
Tables: admins, teachers, students, branches, classes, sections,
        teacher_assignments, face_encodings, face_images, attendance, otp_tokens
"""

import sqlite3, os, hashlib, secrets, datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "faceattend.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    # ── Admins ──────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name     TEXT NOT NULL
        )
    """)

    # ── Teachers ─────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS teachers (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Students ─────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_no    TEXT UNIQUE NOT NULL,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            branch     TEXT NOT NULL,
            class_name TEXT NOT NULL,
            section    TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Teacher → Class assignments ──────────────────────────────────────────
    # A teacher can be assigned multiple branch/class/section combos
    c.execute("""
        CREATE TABLE IF NOT EXISTS teacher_assignments (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
            branch     TEXT NOT NULL,
            class_name TEXT NOT NULL,
            section    TEXT NOT NULL,
            UNIQUE(teacher_id, branch, class_name, section)
        )
    """)

    # ── Face encodings (Facenet 128-d) ───────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_encodings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            encoding   TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Face images (base64 JPEG for preview) ────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_images (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            image_b64  TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Attendance ────────────────────────────────────────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            date       TEXT NOT NULL,
            time_in    TEXT NOT NULL,
            status     TEXT NOT NULL DEFAULT 'Present',
            method     TEXT DEFAULT 'face',
            marked_by  INTEGER REFERENCES teachers(id),
            UNIQUE(student_id, date)
        )
    """)

    # ── College Structure (Branch → Year → Section) ─────────────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS college_structure (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            branch     TEXT NOT NULL,
            class_name TEXT NOT NULL,
            section    TEXT NOT NULL,
            UNIQUE(branch, class_name, section)
        )
    """)

    # ── OTP tokens (for email verification & password reset) ─────────────────
    c.execute("""
        CREATE TABLE IF NOT EXISTS otp_tokens (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL,
            otp        TEXT NOT NULL,
            purpose    TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            used       INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── Default admin ─────────────────────────────────────────────────────────
    c.execute("INSERT OR IGNORE INTO admins (username, password, name) VALUES (?,?,?)",
              ("admin@gmail.com", _hash("admin123"), "Administrator"))

    conn.commit()
    conn.close()
    print("OK Database initialised:", DB_PATH)


def _hash(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def hash_password(pw):
    return _hash(pw)

def verify_password(plain, hashed):
    return _hash(plain) == hashed

def generate_otp():
    """Generate a 6-digit OTP."""
    return str(secrets.randbelow(900000) + 100000)

def store_otp(email, purpose, minutes=10):
    """Store OTP in DB and return the OTP string."""
    otp = generate_otp()
    expires = (datetime.datetime.utcnow() + datetime.timedelta(minutes=minutes)).isoformat()
    conn = get_db()
    # Invalidate old OTPs for same email+purpose
    conn.execute("UPDATE otp_tokens SET used=1 WHERE email=? AND purpose=? AND used=0",
                 (email.lower(), purpose))
    conn.execute(
        "INSERT INTO otp_tokens (email, otp, purpose, expires_at) VALUES (?,?,?,?)",
        (email.lower(), otp, purpose, expires)
    )
    conn.commit()
    conn.close()
    return otp

def verify_otp(email, otp, purpose):
    """Returns True if OTP is valid and not expired. Marks it used."""
    conn = get_db()
    row = conn.execute("""
        SELECT id, expires_at FROM otp_tokens
        WHERE email=? AND otp=? AND purpose=? AND used=0
        ORDER BY id DESC LIMIT 1
    """, (email.lower(), otp, purpose)).fetchone()
    if not row:
        conn.close()
        return False
    if datetime.datetime.utcnow().isoformat() > row["expires_at"]:
        conn.close()
        return False
    conn.execute("UPDATE otp_tokens SET used=1 WHERE id=?", (row["id"],))
    conn.commit()
    conn.close()
    return True
