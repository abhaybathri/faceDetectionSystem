"""
Attendance routes:
POST /api/attendance/recognize  - identify face + mark attendance
POST /api/attendance/manual     - admin manual mark
GET  /api/attendance/today      - today's records
GET  /api/attendance/stats      - dashboard stats
"""

from flask import Blueprint, request, jsonify, session
from database import get_db
from face_engine import recognize_face, str_to_encoding, FR_AVAILABLE
from datetime import date, datetime

attendance_bp = Blueprint("attendance", __name__)


def _load_all_encodings(conn):
    """Load all face encodings from DB."""
    rows = conn.execute("""
        SELECT fe.user_id, fe.encoding, u.name, u.user_code
        FROM face_encodings fe
        JOIN users u ON u.id = fe.user_id
    """).fetchall()
    return [
        {
            "user_id":   r["user_id"],
            "name":      r["name"],
            "user_code": r["user_code"],
            "encoding":  str_to_encoding(r["encoding"])
        }
        for r in rows
    ]


@attendance_bp.route("/recognize", methods=["POST"])
def recognize():
    """
    Accepts a base64 webcam frame, runs face recognition,
    and marks attendance ONLY if:
      1. A face is detected with high confidence
      2. The detected face matches the currently logged-in user's enrolled face
    This prevents one person from marking attendance for another.
    """
    if not FR_AVAILABLE:
        return jsonify({"error": "face_recognition not installed on server"}), 503

    # Must be logged in as a real user (not admin)
    logged_in_user_id = session.get("user_id")
    logged_in_role    = session.get("user_role")

    if not logged_in_user_id:
        return jsonify({"error": "You must be logged in to mark attendance"}), 401

    if logged_in_role == "admin":
        return jsonify({"error": "Admins cannot mark attendance. Login as a user."}), 403

    data = request.get_json()
    b64_image = data.get("image")
    if not b64_image:
        return jsonify({"error": "image required"}), 400

    conn = get_db()

    # Load ALL enrolled samples for the logged-in user
    rows = conn.execute("""
        SELECT fe.encoding, u.name, u.user_code
        FROM face_encodings fe
        JOIN users u ON u.id = fe.user_id
        WHERE fe.user_id = ?
    """, (logged_in_user_id,)).fetchall()

    if not rows:
        conn.close()
        return jsonify({
            "error": "Your face is not enrolled yet. Ask admin to enroll your face first."
        }), 404

    # Build known_encodings list with all samples
    from face_engine import str_to_encoding
    known_encodings = [
        {"user_id": logged_in_user_id, "encoding": str_to_encoding(r["encoding"])}
        for r in rows
    ]
    user_name = rows[0]["name"]
    user_code = rows[0]["user_code"]

    user_id, confidence = recognize_face(b64_image, known_encodings)

    # Face did not match — majority vote failed
    if user_id is None:
        conn.close()
        return jsonify({
            "error": "Face not recognised. Ensure good lighting, look directly at the camera, "
                     "and keep your face fully visible. If this keeps happening, ask admin to re-enroll.",
            "confidence": 0
        }), 401

    # Mark attendance (unique per user per day)
    today    = date.today().isoformat()
    time_now = datetime.now().strftime("%I:%M %p")

    existing = conn.execute(
        "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
        (user_id, today)
    ).fetchone()

    if existing:
        conn.close()
        return jsonify({
            "message":    "Already marked today",
            "already":    True,
            "name":       user_name,
            "user_code":  user_code,
            "confidence": confidence
        })

    conn.execute("""
        INSERT INTO attendance (user_id, date, time_in, status, method)
        VALUES (?, ?, ?, 'Present', 'face')
    """, (user_id, today, time_now))
    conn.commit()
    conn.close()

    return jsonify({
        "message":    "Attendance marked successfully",
        "already":    False,
        "name":       user_name,
        "user_code":  user_code,
        "time":       time_now,
        "confidence": confidence
    })


@attendance_bp.route("/manual", methods=["POST"])
def manual_mark():
    """Admin can manually mark attendance for a user."""
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin only"}), 403
    data   = request.get_json()
    uid    = data.get("user_id")
    status = data.get("status", "Present")
    day    = data.get("date", date.today().isoformat())
    t      = data.get("time", datetime.now().strftime("%I:%M %p"))

    conn = get_db()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO attendance (user_id, date, time_in, status, method)
            VALUES (?, ?, ?, ?, 'manual')
        """, (uid, day, t, status))
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
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE a.date = ?
        ORDER BY a.time_in
    """, (today,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@attendance_bp.route("/stats", methods=["GET"])
def stats():
    today = date.today().isoformat()
    conn  = get_db()
    total_users   = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    present_today = conn.execute(
        "SELECT COUNT(*) FROM attendance WHERE date = ? AND status = 'Present'", (today,)
    ).fetchone()[0]
    absent_today  = total_users - present_today
    conn.close()
    return jsonify({
        "total_users":   total_users,
        "present_today": present_today,
        "absent_today":  absent_today,
        "date":          today
    })


@attendance_bp.route("/user/<int:uid>", methods=["GET"])
def user_attendance(uid):
    """Get attendance records for a specific user."""
    conn = get_db()
    rows = conn.execute("""
        SELECT date, time_in, status FROM attendance
        WHERE user_id = ?
        ORDER BY date DESC
        LIMIT 30
    """, (uid,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
