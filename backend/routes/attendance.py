"""
Attendance routes
POST /api/attendance/recognize          - kiosk: detect face, mark attendance
POST /api/attendance/manual             - admin/teacher manual mark
GET  /api/attendance/today              - today's records (admin: all, teacher: their class)
GET  /api/attendance/stats              - dashboard stats
GET  /api/attendance/student/<id>       - records for one student
GET  /api/attendance/class              - attendance for a branch/class/section
"""

from flask import Blueprint, request, jsonify, session
from database import get_db
from face_engine import recognize_face, str_to_encoding, FR_AVAILABLE
from datetime import date, datetime

attendance_bp = Blueprint("attendance", __name__)


def _can_access():
    role = session.get("user_role")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    return None


@attendance_bp.route("/recognize", methods=["POST"])
def recognize():
    """
    Kiosk endpoint — teacher must be logged in and select a class.
    Receives webcam frame + branch/class/section context.
    Marks attendance only for students in that class.
    """
    if not FR_AVAILABLE:
        return jsonify({"error": "Face recognition not available"}), 503

    data       = request.get_json() or {}
    b64        = data.get("image")
    branch     = (data.get("branch") or "").strip().upper()
    class_name = (data.get("class_name") or "").strip()
    section    = (data.get("section") or "").strip().upper()

    if not b64:
        return jsonify({"error": "image required"}), 400
    if not branch or not class_name or not section:
        return jsonify({"error": "branch, class_name, and section are required"}), 400

    conn = get_db()

    # Load face encodings only for students in this class
    rows = conn.execute("""
        SELECT fe.student_id, fe.encoding, s.name, s.roll_no, s.branch, s.class_name, s.section
        FROM face_encodings fe
        JOIN students s ON s.id = fe.student_id
        WHERE s.branch=? AND s.class_name=? AND s.section=?
    """, (branch, class_name, section)).fetchall()

    if not rows:
        conn.close()
        return jsonify({
            "error": "No enrolled faces found for this class. Admin must enroll students first."
        }), 404

    known = [
        {"user_id": r["student_id"], "encoding": str_to_encoding(r["encoding"])}
        for r in rows
    ]

    student_id, confidence = recognize_face(b64, known)

    if student_id is None:
        conn.close()
        return jsonify({
            "error": "Face not recognised. Please look directly at the camera in good lighting.",
            "confidence": 0
        }), 404

    # Get student info
    s = conn.execute(
        "SELECT name, roll_no, branch, class_name, section FROM students WHERE id=?",
        (student_id,)
    ).fetchone()

    today    = date.today().isoformat()
    time_now = datetime.now().strftime("%I:%M %p")
    day_str  = datetime.now().strftime("%A, %d %B %Y")

    existing = conn.execute(
        "SELECT * FROM attendance WHERE student_id=? AND date=?",
        (student_id, today)
    ).fetchone()

    teacher_id = session.get("user_id") if session.get("user_role") == "teacher" else None

    if existing:
        conn.close()
        return jsonify({
            "message": f"Attendance already marked today for {s['name']}",
            "already":    True,
            "name":       s["name"],
            "roll_no":    s["roll_no"],
            "branch":     s["branch"],
            "class_name": s["class_name"],
            "section":    s["section"],
            "confidence": confidence
        })

    conn.execute(
        "INSERT INTO attendance (student_id,date,time_in,status,method,marked_by) VALUES (?,?,?,'Present','face',?)",
        (student_id, today, time_now, teacher_id)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "message": (
            f"Attendance marked successfully!\n"
            f"Student: {s['name']} ({s['roll_no']})\n"
            f"Class: {s['branch']} — {s['class_name']} — Section {s['section']}\n"
            f"Date: {day_str}\n"
            f"Time: {time_now}"
        ),
        "already":    False,
        "name":       s["name"],
        "roll_no":    s["roll_no"],
        "branch":     s["branch"],
        "class_name": s["class_name"],
        "section":    s["section"],
        "time":       time_now,
        "date":       today,
        "day":        day_str,
        "confidence": confidence
    })


@attendance_bp.route("/manual", methods=["POST"])
def manual_mark():
    err = _can_access()
    if err: return err

    data       = request.get_json() or {}
    student_id = data.get("student_id")
    status     = data.get("status", "Present")
    day        = data.get("date", date.today().isoformat())
    t          = data.get("time", datetime.now().strftime("%I:%M %p"))

    if not student_id:
        return jsonify({"error": "student_id required"}), 400

    teacher_id = session.get("user_id") if session.get("user_role") == "teacher" else None

    conn = get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO attendance (student_id,date,time_in,status,method,marked_by) VALUES (?,?,?,?,'manual',?)",
            (student_id, day, t, status, teacher_id)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify({"message": "Attendance recorded"})


@attendance_bp.route("/today", methods=["GET"])
def today_records():
    err = _can_access()
    if err: return err

    today = date.today().isoformat()
    conn  = get_db()

    if session.get("user_role") == "teacher":
        tid = session["user_id"]
        rows = conn.execute("""
            SELECT a.id, s.name, s.roll_no, s.branch, s.class_name, s.section,
                   a.date, a.time_in, a.status, a.method
            FROM attendance a
            JOIN students s ON s.id = a.student_id
            JOIN teacher_assignments ta ON (
                ta.teacher_id=? AND ta.branch=s.branch
                AND ta.class_name=s.class_name AND ta.section=s.section
            )
            WHERE a.date=?
            ORDER BY s.class_name, s.section, s.name
        """, (tid, today)).fetchall()
    else:
        rows = conn.execute("""
            SELECT a.id, s.name, s.roll_no, s.branch, s.class_name, s.section,
                   a.date, a.time_in, a.status, a.method
            FROM attendance a JOIN students s ON s.id = a.student_id
            WHERE a.date=? ORDER BY s.branch, s.class_name, s.section, s.name
        """, (today,)).fetchall()

    conn.close()
    return jsonify([dict(r) for r in rows])


@attendance_bp.route("/stats", methods=["GET"])
def stats():
    err = _can_access()
    if err: return err

    today = date.today().isoformat()
    conn  = get_db()

    if session.get("user_role") == "teacher":
        tid = session["user_id"]
        total = conn.execute("""
            SELECT COUNT(DISTINCT s.id) FROM students s
            JOIN teacher_assignments ta ON (
                ta.teacher_id=? AND ta.branch=s.branch
                AND ta.class_name=s.class_name AND ta.section=s.section
            )
        """, (tid,)).fetchone()[0]
        present = conn.execute("""
            SELECT COUNT(DISTINCT a.student_id) FROM attendance a
            JOIN students s ON s.id=a.student_id
            JOIN teacher_assignments ta ON (
                ta.teacher_id=? AND ta.branch=s.branch
                AND ta.class_name=s.class_name AND ta.section=s.section
            )
            WHERE a.date=? AND a.status='Present'
        """, (tid, today)).fetchone()[0]
    else:
        total   = conn.execute("SELECT COUNT(*) FROM students").fetchone()[0]
        present = conn.execute(
            "SELECT COUNT(*) FROM attendance WHERE date=? AND status='Present'", (today,)
        ).fetchone()[0]

    conn.close()
    return jsonify({
        "total_students": total,
        "present_today":  present,
        "absent_today":   total - present,
        "date":           today
    })


@attendance_bp.route("/class", methods=["GET"])
def class_attendance():
    """Get attendance for a specific branch/class/section with optional date filter."""
    err = _can_access()
    if err: return err

    branch     = request.args.get("branch", "").strip().upper()
    class_name = request.args.get("class_name", "").strip()
    section    = request.args.get("section", "").strip().upper()
    att_date   = request.args.get("date", "").strip()

    if not branch or not class_name or not section:
        return jsonify({"error": "branch, class_name, and section are required"}), 400

    # Teacher access check
    if session.get("user_role") == "teacher":
        tid  = session["user_id"]
        conn = get_db()
        ok   = conn.execute("""
            SELECT id FROM teacher_assignments
            WHERE teacher_id=? AND branch=? AND class_name=? AND section=?
        """, (tid, branch, class_name, section)).fetchone()
        conn.close()
        if not ok:
            return jsonify({"error": "You are not assigned to this class"}), 403

    query  = """
        SELECT a.id, s.name, s.roll_no, s.branch, s.class_name, s.section,
               a.date, a.time_in, a.status, a.method
        FROM attendance a JOIN students s ON s.id=a.student_id
        WHERE s.branch=? AND s.class_name=? AND s.section=?
    """
    params = [branch, class_name, section]
    if att_date:
        query += " AND a.date=?"; params.append(att_date)
    query += " ORDER BY a.date DESC, s.name"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@attendance_bp.route("/student/<int:sid>", methods=["GET"])
def student_attendance(sid):
    err = _can_access()
    if err: return err
    conn = get_db()
    rows = conn.execute(
        "SELECT date, time_in, status FROM attendance WHERE student_id=? ORDER BY date DESC LIMIT 60",
        (sid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
