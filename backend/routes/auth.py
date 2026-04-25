"""
Auth routes: /api/auth/login, /api/auth/logout, /api/auth/me
"""

from flask import Blueprint, request, jsonify, session
from database import get_db, verify_password

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role     = data.get("role") or "user"   # 'user' | 'admin'

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = get_db()

    if role == "admin":
        row = conn.execute(
            "SELECT * FROM admins WHERE username = ?", (email,)
        ).fetchone()
        conn.close()
        if not row or not verify_password(password, row["password"]):
            return jsonify({"error": "Invalid admin credentials"}), 401
        session["user_id"]   = f"admin_{row['id']}"
        session["user_role"] = "admin"
        session["user_name"] = row["name"]
        return jsonify({
            "id":   f"admin_{row['id']}",
            "name": row["name"],
            "role": "admin",
            "email": email
        })
    else:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        conn.close()
        if not row or not verify_password(password, row["password"]):
            return jsonify({"error": "Invalid credentials"}), 401
        session["user_id"]   = row["id"]
        session["user_role"] = row["role"]
        session["user_name"] = row["name"]
        return jsonify({
            "id":        row["id"],
            "user_code": row["user_code"],
            "name":      row["name"],
            "email":     row["email"],
            "role":      row["role"]
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
        "id":   session["user_id"],
        "name": session["user_name"],
        "role": session["user_role"]
    })
