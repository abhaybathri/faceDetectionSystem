"""
Student management (admin only)
GET    /api/students                    - list students (filter by branch/class/section)
POST   /api/students/send-verify-otp   - send OTP to verify student email
POST   /api/students                   - create student (requires OTP)
PUT    /api/students/<id>              - update student
DELETE /api/students/<id>              - delete student
POST   /api/students/<id>/enroll       - enroll face (8 images)
GET    /api/students/<id>/images       - get enrolled face images
GET    /api/students/by-class          - get students for a specific branch/class/section
"""

import re
from flask import Blueprint, request, jsonify, session
from database import get_db, store_otp, verify_otp
from face_engine import encode_face, encoding_to_str, FR_AVAILABLE
from email_utils import send_otp_email

students_bp = Blueprint("students", __name__)

GMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@gmail\.com$')


def _admin():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


def _valid_gmail(email):
    return bool(GMAIL_RE.match(email.strip().lower()))


def _can_access():
    """Admin or teacher can access student data."""
    role = session.get("user_role")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    return None


@students_bp.route("/send-verify-otp", methods=["POST"])
def send_verify_otp():
    err = _admin()
    if err: return err

    data  = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not _valid_gmail(email):
        return jsonify({"error": "Only Gmail addresses (@gmail.com) are accepted"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM students WHERE email=?", (email,)).fetchone()
    conn.close()
    if existing:
        return jsonify({"error": "This email is already registered as a student"}), 409

    otp = store_otp(email, "verify_student")
    ok  = send_otp_email(email, otp, "verify_student")
    if not ok:
        return jsonify({"error": "Failed to send OTP. Check SMTP configuration."}), 500
    return jsonify({"message": f"OTP sent to {email}"})


@students_bp.route("", methods=["GET"])
def list_students():
    err = _can_access()
    if err: return err

    branch     = request.args.get("branch", "").strip().upper()
    class_name = request.args.get("class_name", "").strip()
    section    = request.args.get("section", "").strip().upper()

    query  = """
        SELECT s.id, s.roll_no, s.name, s.email, s.branch, s.class_name, s.section,
               s.created_at,
               COUNT(DISTINCT fe.id) as sample_count,
               COUNT(DISTINCT fi.id) as image_count
        FROM students s
        LEFT JOIN face_encodings fe ON fe.student_id = s.id
        LEFT JOIN face_images fi    ON fi.student_id  = s.id
        WHERE 1=1
    """
    params = []
    if branch:
        query += " AND s.branch=?"; params.append(branch)
    if class_name:
        query += " AND s.class_name=?"; params.append(class_name)
    if section:
        query += " AND s.section=?"; params.append(section)

    # If teacher, restrict to their assigned classes
    if session.get("user_role") == "teacher":
        tid = session["user_id"]
        conn = get_db()
        assignments = conn.execute(
            "SELECT branch,class_name,section FROM teacher_assignments WHERE teacher_id=?", (tid,)
        ).fetchall()
        conn.close()
        if not assignments:
            return jsonify([])
        # Build filter for teacher's classes
        placeholders = " OR ".join(
            ["(s.branch=? AND s.class_name=? AND s.section=?)"] * len(assignments)
        )
        query += f" AND ({placeholders})"
        for a in assignments:
            params.extend([a["branch"], a["class_name"], a["section"]])

    query += " GROUP BY s.id ORDER BY s.branch, s.class_name, s.section, s.name"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@students_bp.route("/by-class", methods=["GET"])
def by_class():
    """Get students for a specific branch/class/section (teacher or admin)."""
    err = _can_access()
    if err: return err

    branch     = request.args.get("branch", "").strip().upper()
    class_name = request.args.get("class_name", "").strip()
    section    = request.args.get("section", "").strip().upper()

    if not branch or not class_name or not section:
        return jsonify({"error": "branch, class_name, and section are required"}), 400

    # If teacher, verify they are assigned to this class
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

    conn = get_db()
    rows = conn.execute("""
        SELECT s.id, s.roll_no, s.name, s.email, s.branch, s.class_name, s.section,
               COUNT(DISTINCT fe.id) as sample_count
        FROM students s
        LEFT JOIN face_encodings fe ON fe.student_id = s.id
        WHERE s.branch=? AND s.class_name=? AND s.section=?
        GROUP BY s.id ORDER BY s.name
    """, (branch, class_name, section)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@students_bp.route("", methods=["POST"])
def create_student():
    err = _admin()
    if err: return err

    data       = request.get_json() or {}
    roll_no    = (data.get("roll_no") or "").strip()
    name       = (data.get("name") or "").strip()
    email      = (data.get("email") or "").strip().lower()
    branch     = (data.get("branch") or "").strip().upper()
    class_name = (data.get("class_name") or "").strip()
    section    = (data.get("section") or "").strip().upper()
    otp        = (data.get("otp") or "").strip()

    for field, val in [("roll_no", roll_no), ("name", name), ("email", email),
                       ("branch", branch), ("class_name", class_name),
                       ("section", section), ("otp", otp)]:
        if not val:
            return jsonify({"error": f"{field} is required"}), 400

    if not _valid_gmail(email):
        return jsonify({"error": "Only Gmail addresses (@gmail.com) are accepted"}), 400

    if not verify_otp(email, otp, "verify_student"):
        return jsonify({"error": "Invalid or expired OTP. Please send OTP again."}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO students (roll_no,name,email,branch,class_name,section) VALUES (?,?,?,?,?,?)",
            (roll_no, name, email, branch, class_name, section)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409
    conn.close()
    return jsonify({"message": "Student created successfully"}), 201


@students_bp.route("/<int:sid>", methods=["PUT"])
def update_student(sid):
    err = _admin()
    if err: return err
    data = request.get_json() or {}
    conn = get_db()
    fields, vals = [], []
    for col in ["name", "email", "branch", "class_name", "section", "roll_no"]:
        if col in data:
            fields.append(f"{col}=?")
            vals.append(data[col])
    if not fields:
        conn.close()
        return jsonify({"error": "Nothing to update"}), 400
    vals.append(sid)
    conn.execute(f"UPDATE students SET {', '.join(fields)} WHERE id=?", vals)
    conn.commit()
    conn.close()
    return jsonify({"message": "Student updated"})


@students_bp.route("/<int:sid>", methods=["DELETE"])
def delete_student(sid):
    err = _admin()
    if err: return err
    conn = get_db()
    conn.execute("DELETE FROM students WHERE id=?", (sid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Student deleted"})


@students_bp.route("/<int:sid>/enroll", methods=["POST"])
def enroll_face(sid):
    err = _admin()
    if err: return err
    if not FR_AVAILABLE:
        return jsonify({"error": "Face recognition not available"}), 503

    data   = request.get_json() or {}
    images = data.get("images") or []
    if data.get("image"):
        images.append(data["image"])
    if not images:
        return jsonify({"error": "No images provided"}), 400

    good_encodings, good_images = [], []
    for b64 in images:
        enc = encode_face(b64)
        if enc is not None:
            good_encodings.append(enc)
            good_images.append(b64)

    if not good_encodings:
        return jsonify({
            "error": "No face detected in any image. Ensure good lighting and look directly at the camera."
        }), 422

    conn = get_db()
    conn.execute("DELETE FROM face_encodings WHERE student_id=?", (sid,))
    conn.execute("DELETE FROM face_images    WHERE student_id=?", (sid,))
    for enc, img in zip(good_encodings, good_images):
        conn.execute("INSERT INTO face_encodings (student_id,encoding) VALUES (?,?)",
                     (sid, encoding_to_str(enc)))
        conn.execute("INSERT INTO face_images (student_id,image_b64) VALUES (?,?)",
                     (sid, img))
    conn.commit()
    conn.close()
    return jsonify({"message": f"Enrolled {len(good_encodings)} face samples successfully!"})


@students_bp.route("/<int:sid>/images", methods=["GET"])
def get_face_images(sid):
    err = _can_access()
    if err: return err
    conn = get_db()
    rows = conn.execute(
        "SELECT id, image_b64, created_at FROM face_images WHERE student_id=? ORDER BY id",
        (sid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
