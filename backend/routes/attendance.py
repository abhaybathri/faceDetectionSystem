"""
Attendance routes
POST /api/attendance/recognize  - kiosk: detect face from ALL enrolled users, mark attendance
POST /api/attendance/manual     - admin manual mark
GET  /api/attendance/today      - today's records
GET  /api/attendance/stats      - dashboard stats
GET  /api/attendance/user/<id>  - records for one user
"""

from flask import Blueprint, request, jsonify, session
from database import get_db
from face_engine import recognize_face, str_to_encoding, FR_AVAILABLE
from datetime import date, datetime

attendance_bp = Blueprint("attendance", __name__)


@attendance_bp.route("/recognize", methods=["POST"])
def recognize():
    """
    Kiosk endpoint — no login required.
    Receives a webcam frame, compares against ALL enrolled users,
    marks attendance for whoever matches.
    """
    if not FR_AVAILABLE:
        return jsonify({"error": "Face recognition not available"}), 503

    data = request.get_json()
    b64  = data.get("image")
    if not b64:
        return jsonify({"error": "image required"}), 400

    conn = get_db()

    # Load ALL enrolled face samples from every user
    rows = conn.execute("""
        SELECT fe.user_id, fe.encoding, u.name, u.user_code
        FROM face_encodings fe
        JOIN users u ON u.id = fe.user_id
    """).fetchall()

    if not rows:
        conn.close()
        return jsonify({"error": "No enrolled faces found. Admin must enroll users first."}), 404

    known = [
        {"user_id": r["user_id"], "encoding": str_to_encoding(r["encoding"])}
        for r in rows
    ]

    user_id, confidence = recognize_face(b64, known)

    if user_id is None:
        conn.close()
        return jsonify({
            "error": "Face not recognised. Please look directly at the camera in good lighting.",
            "confidence": 0
        }), 404

    # Get user info
    u = conn.execute(
        "SELECT name, user_code FROM users WHERE id = ?", (user_id,)
    ).fetchone()

    today    = date.today().isoformat()
    time_now = datetime.now().strftime("%I:%M %p")

    existing = conn.execute(
        "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
        (user_id, today)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({
            "message":    f"Already marked today",
            "already":    True,
            "name":       u["name"],
            "user_code":  u["user_code"],
            "confidence": confidence
        })

    conn.execute(
        "INSERT INTO attendance (user_id, date, time_in, status, method) VALUES (?,?,?,'Present','face')",
        (user_id, today, time_now)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message":    "Attendance marked successfully",
        "already":    False,
        "name":       u["name"],
        "user_code":  u["user_code"],
        "time":       time_now,
        "confidence": confidence
    })


@attendance_bp.route("/manual", methods=["POST"])
def manual_mark():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin only"}), 403
    data   = request.get_json()
    uid    = data.get("user_id")
    status = data.get("status", "Present")
    day    = data.get("date", date.today().isoformat())
    t      = data.get("time", datetime.now().strftime("%I:%M %p"))
    conn   = get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO attendance (user_id,date,time_in,status,method) VALUES (?,?,?,?,'manual')",
            (uid, day, t, status)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify({"message": "Attendance recorded"})


@attendance_bp.route("/today", methods=["GET"])
def today_records():
    today = date.today().isoformat()
    conn  = get_db()
    rows  = conn.execute("""
        SELECT a.id, u.name, u.user_code, a.date, a.time_in, a.status, a.method
        FROM attendance a JOIN users u ON u.id = a.user_id
        WHERE a.date = ? ORDER BY a.time_in
    """, (today,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@attendance_bp.route("/stats", methods=["GET"])
def stats():
    today = date.today().isoformat()
    conn  = get_db()
    total   = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    present = conn.execute(
        "SELECT COUNT(*) FROM attendance WHERE date=? AND status='Present'", (today,)
    ).fetchone()[0]
    conn.close()
    return jsonify({
        "total_users": total, "present_today": present,
        "absent_today": total - present, "date": today
    })


@attendance_bp.route("/user/<int:uid>", methods=["GET"])
def user_attendance(uid):
    conn = get_db()
    rows = conn.execute(
        "SELECT date, time_in, status FROM attendance WHERE user_id=? ORDER BY date DESC LIMIT 30",
        (uid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
