"""
SQLite database — FaceAttend
Tables: admins, users, face_encodings, face_images, attendance
"""

import sqlite3, os, hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "faceattend.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name     TEXT NOT NULL
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_code  TEXT UNIQUE NOT NULL,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            role       TEXT NOT NULL DEFAULT 'student',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Stores Facenet 128-d embedding per sample
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_encodings (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            encoding   TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Stores the actual captured face image (base64 JPEG) for viewing
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_images (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            image_b64  TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date     TEXT NOT NULL,
            time_in  TEXT NOT NULL,
            status   TEXT NOT NULL DEFAULT 'Present',
            method   TEXT DEFAULT 'face',
            UNIQUE(user_id, date)
        )
    """)

    # Default admin
    c.execute("INSERT OR IGNORE INTO admins (username, password, name) VALUES (?,?,?)",
              ("admin@demo.com", _hash("admin123"), "Administrator"))

    conn.commit()
    conn.close()
    print("OK Database initialised:", DB_PATH)


def _hash(pw): return hashlib.sha256(pw.encode()).hexdigest()
def hash_password(pw): return _hash(pw)
def verify_password(plain, hashed): return _hash(plain) == hashed
