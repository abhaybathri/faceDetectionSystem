"""
Auth routes
POST /api/auth/login          - admin or teacher login
POST /api/auth/logout         - logout
GET  /api/auth/me             - current session info
POST /api/auth/send-otp       - send OTP for password reset
POST /api/auth/reset-password - reset teacher password with OTP
"""

import re
from flask import Blueprint, request, jsonify, session
from database import get_db, verify_password, hash_password, store_otp, verify_otp
from email_utils import send_otp_email

auth_bp = Blueprint("auth", __name__)

GMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@gmail\.com$')


def _valid_gmail(email: str) -> bool:
    return bool(GMAIL_RE.match(email.strip().lower()))


@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role     = data.get("role") or "teacher"   # 'admin' | 'teacher'

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    # ── Gmail pattern check ──────────────────────────────────────────────────
    if not _valid_gmail(email):
        return jsonify({
            "error": "Please enter a valid Gmail address (must end with @gmail.com)"
        }), 400

    conn = get_db()

    if role == "admin":
        row = conn.execute(
            "SELECT * FROM admins WHERE username = ?", (email,)
        ).fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Email is not registered in the database"}), 401
        if not verify_password(password, row["password"]):
            return jsonify({"error": "Wrong password. Please try again"}), 401
        session["user_id"]   = f"admin_{row['id']}"
        session["user_role"] = "admin"
        session["user_name"] = row["name"]
        return jsonify({
            "id":    f"admin_{row['id']}",
            "name":  row["name"],
            "role":  "admin",
            "email": email
        })

    else:  # teacher
        row = conn.execute(
            "SELECT * FROM teachers WHERE email = ?", (email,)
        ).fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Email is not registered in the database"}), 401
        if not verify_password(password, row["password"]):
            return jsonify({"error": "Wrong password. Please try again"}), 401
        session["user_id"]   = row["id"]
        session["user_role"] = "teacher"
        session["user_name"] = row["name"]
        session["user_email"] = row["email"]
        return jsonify({
            "id":    row["id"],
            "name":  row["name"],
            "email": row["email"],
            "role":  "teacher"
        })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@auth_bp.route("/me", methods=["GET"])
def me():
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({
        "id":    session["user_id"],
        "name":  session["user_name"],
        "role":  session["user_role"],
        "email": session.get("user_email", "")
    })


@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    """Send OTP to teacher email for password reset."""
    data  = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not _valid_gmail(email):
        return jsonify({"error": "Please enter a valid Gmail address (@gmail.com only)"}), 400

    conn = get_db()
    row  = conn.execute("SELECT id FROM teachers WHERE email=?", (email,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Email is not registered in the database"}), 404

    otp = store_otp(email, "reset_password")
    ok  = send_otp_email(email, otp, "reset_password")
    if not ok:
        return jsonify({"error": "Failed to send OTP email. Check server SMTP config."}), 500
    return jsonify({"message": f"OTP sent to {email}"})


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Verify OTP and set new password for teacher."""
    data     = request.get_json() or {}
    email    = (data.get("email") or "").strip().lower()
    otp      = (data.get("otp") or "").strip()
    new_pass = data.get("new_password") or ""

    if not email or not otp or not new_pass:
        return jsonify({"error": "Email, OTP, and new password are required"}), 400
    if not _valid_gmail(email):
        return jsonify({"error": "Invalid Gmail address"}), 400
    if len(new_pass) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if not verify_otp(email, otp, "reset_password"):
        return jsonify({"error": "Invalid or expired OTP. Please request a new one"}), 400

    conn = get_db()
    conn.execute("UPDATE teachers SET password=? WHERE email=?",
                 (hash_password(new_pass), email))
    conn.commit()
    conn.close()
    return jsonify({"message": "Password reset successfully. You can now login."})


@auth_bp.route("/verify-email-otp", methods=["POST"])
def verify_email_otp():
    """Verify OTP for email validation (teacher/student registration)."""
    data    = request.get_json() or {}
    email   = (data.get("email") or "").strip().lower()
    otp     = (data.get("otp") or "").strip()
    purpose = data.get("purpose") or "verify_teacher"

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    if verify_otp(email, otp, purpose):
        return jsonify({"message": "Email verified successfully"})
    return jsonify({"error": "Invalid or expired OTP"}), 400
