"""
Teacher management (admin only)
GET    /api/teachers                        - list all teachers
POST   /api/teachers                        - create teacher (sends OTP to verify email first)
PUT    /api/teachers/<id>                   - update teacher
DELETE /api/teachers/<id>                   - delete teacher
GET    /api/teachers/<id>/assignments       - get class assignments for a teacher
POST   /api/teachers/<id>/assignments       - assign branch/class/section to teacher
DELETE /api/teachers/<id>/assignments/<aid> - remove an assignment
GET    /api/teachers/my-assignments         - teacher sees their own assignments
POST   /api/teachers/send-verify-otp        - send OTP to verify teacher email before creating
"""

import re, secrets, string
from flask import Blueprint, request, jsonify, session
from database import get_db, hash_password, store_otp, verify_otp
from email_utils import send_otp_email, send_teacher_credentials

teachers_bp = Blueprint("teachers", __name__)

GMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@gmail\.com$')


def _admin():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


def _valid_gmail(email):
    return bool(GMAIL_RE.match(email.strip().lower()))


def _gen_temp_password(length=10):
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@teachers_bp.route("/send-verify-otp", methods=["POST"])
def send_verify_otp():
    """Admin sends OTP to a new teacher email to verify it's valid before creating account."""
    err = _admin()
    if err: return err

    data  = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not _valid_gmail(email):
        return jsonify({"error": "Only Gmail addresses (@gmail.com) are accepted"}), 400

    # Check not already registered
    conn = get_db()
    existing = conn.execute("SELECT id FROM teachers WHERE email=?", (email,)).fetchone()
    conn.close()
    if existing:
        return jsonify({"error": "This email is already registered as a teacher"}), 409

    otp = store_otp(email, "verify_teacher")
    ok  = send_otp_email(email, otp, "verify_teacher")
    if not ok:
        return jsonify({"error": "Failed to send OTP. Check SMTP configuration."}), 500
    return jsonify({"message": f"OTP sent to {email}"})


@teachers_bp.route("", methods=["GET"])
def list_teachers():
    err = _admin()
    if err: return err
    conn = get_db()
    rows = conn.execute("""
        SELECT t.id, t.name, t.email, t.created_at,
               COUNT(DISTINCT ta.id) as assignment_count
        FROM teachers t
        LEFT JOIN teacher_assignments ta ON ta.teacher_id = t.id
        GROUP BY t.id ORDER BY t.name
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@teachers_bp.route("", methods=["POST"])
def create_teacher():
    """Create teacher. Requires prior OTP verification of email."""
    err = _admin()
    if err: return err

    data  = request.get_json() or {}
    name  = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    otp   = (data.get("otp") or "").strip()

    if not name or not email or not otp:
        return jsonify({"error": "Name, email, and OTP are required"}), 400
    if not _valid_gmail(email):
        return jsonify({"error": "Only Gmail addresses (@gmail.com) are accepted"}), 400

    # Verify OTP
    if not verify_otp(email, otp, "verify_teacher"):
        return jsonify({"error": "Invalid or expired OTP. Please send OTP again."}), 400

    temp_pass = _gen_temp_password()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO teachers (name, email, password) VALUES (?,?,?)",
            (name, email, hash_password(temp_pass))
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409
    conn.close()

    # Send credentials email
    send_teacher_credentials(email, name, temp_pass)

    return jsonify({
        "message": f"Teacher account created. Credentials sent to {email}.",
        "temp_password": temp_pass   # also return in response for admin to note
    }), 201


@teachers_bp.route("/<int:tid>", methods=["PUT"])
def update_teacher(tid):
    err = _admin()
    if err: return err
    data = request.get_json() or {}
    conn = get_db()
    if "name" in data:
        conn.execute("UPDATE teachers SET name=? WHERE id=?", (data["name"].strip(), tid))
    conn.commit()
    conn.close()
    return jsonify({"message": "Teacher updated"})


@teachers_bp.route("/<int:tid>", methods=["DELETE"])
def delete_teacher(tid):
    err = _admin()
    if err: return err
    conn = get_db()
    conn.execute("DELETE FROM teachers WHERE id=?", (tid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Teacher deleted"})


@teachers_bp.route("/<int:tid>/assignments", methods=["GET"])
def get_assignments(tid):
    err = _admin()
    if err: return err
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM teacher_assignments WHERE teacher_id=? ORDER BY branch,class_name,section",
        (tid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@teachers_bp.route("/<int:tid>/assignments", methods=["POST"])
def add_assignment(tid):
    err = _admin()
    if err: return err
    data       = request.get_json() or {}
    branch     = (data.get("branch") or "").strip().upper()
    class_name = (data.get("class_name") or "").strip()
    section    = (data.get("section") or "").strip().upper()

    if not branch or not class_name or not section:
        return jsonify({"error": "branch, class_name, and section are required"}), 400

    conn = get_db()
    # Check teacher exists
    t = conn.execute("SELECT id FROM teachers WHERE id=?", (tid,)).fetchone()
    if not t:
        conn.close()
        return jsonify({"error": "Teacher not found"}), 404
    try:
        conn.execute(
            "INSERT INTO teacher_assignments (teacher_id,branch,class_name,section) VALUES (?,?,?,?)",
            (tid, branch, class_name, section)
        )
        conn.commit()
    except Exception:
        conn.close()
        return jsonify({"error": "This assignment already exists"}), 409
    conn.close()
    return jsonify({"message": "Assignment added"}), 201


@teachers_bp.route("/<int:tid>/assignments/<int:aid>", methods=["DELETE"])
def remove_assignment(tid, aid):
    err = _admin()
    if err: return err
    conn = get_db()
    conn.execute("DELETE FROM teacher_assignments WHERE id=? AND teacher_id=?", (aid, tid))
    conn.commit()
    conn.close()
    return jsonify({"message": "Assignment removed"})


@teachers_bp.route("/my-assignments", methods=["GET"])
def my_assignments():
    """Teacher sees their own assigned classes."""
    if session.get("user_role") != "teacher":
        return jsonify({"error": "Teacher login required"}), 403
    tid  = session["user_id"]
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM teacher_assignments WHERE teacher_id=? ORDER BY branch,class_name,section",
        (tid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
