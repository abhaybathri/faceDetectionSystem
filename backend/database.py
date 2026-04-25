"""
SQLite database setup and helpers.
Tables: users, face_encodings, attendance, admins
"""

import sqlite3
import os
import hashlib

DB_PATH = os.path.join(os.path.dirname(__file__), "faceattend.db")


def get_db():
    """Return a new DB connection with row_factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create all tables and seed default admin."""
    conn = get_db()
    c = conn.cursor()

    # Users table
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_code   TEXT    UNIQUE NOT NULL,
            name        TEXT    NOT NULL,
            email       TEXT    UNIQUE NOT NULL,
            role        TEXT    NOT NULL DEFAULT 'student',
            password    TEXT    NOT NULL,
            avatar_path TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Face encodings (128-d vector stored as comma-separated floats)
    c.execute("""
        CREATE TABLE IF NOT EXISTS face_encodings (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            encoding    TEXT    NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Attendance records
    c.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date        TEXT    NOT NULL,
            time_in     TEXT    NOT NULL,
            status      TEXT    NOT NULL DEFAULT 'Present',
            method      TEXT    DEFAULT 'face',
            UNIQUE(user_id, date)
        )
    """)

    # Admins table
    c.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name     TEXT NOT NULL
        )
    """)

    # Seed default admin (admin@demo.com / admin123)
    admin_pw = _hash_password("admin123")
    c.execute("""
        INSERT OR IGNORE INTO admins (username, password, name)
        VALUES (?, ?, ?)
    """, ("admin@demo.com", admin_pw, "Administrator"))

    # Seed demo student
    student_pw = _hash_password("password123")
    c.execute("""
        INSERT OR IGNORE INTO users (user_code, name, email, role, password)
        VALUES (?, ?, ?, ?, ?)
    """, ("STU001", "Alice Johnson", "user@demo.com", "student", student_pw))

    conn.commit()
    conn.close()
    print("✅  Database initialised:", DB_PATH)


def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return _hash_password(plain) == hashed


def hash_password(pw: str) -> str:
    return _hash_password(pw)
