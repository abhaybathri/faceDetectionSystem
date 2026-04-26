"""
User management routes (admin only):
GET    /api/users          - list all users
POST   /api/users          - create user
PUT    /api/users/<id>     - update user
DELETE /api/users/<id>     - delete user
POST   /api/users/<id>/enroll  - enroll face (save encoding)
"""

from flask import Blueprint, request, jsonify, session
from database import get_db, hash_password
from face_engine import encode_face, encoding_to_str, FR_AVAILABLE

users_bp = Blueprint("users", __name__)


def _require_admin():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


@users_bp.route("", methods=["GET"])
def list_users():
    err = _require_admin()
    if err: return err
    conn = get_db()
    rows = conn.execute("""
        SELECT u.id, u.user_code, u.name, u.email, u.role, u.created_at,
               COUNT(fe.id) as has_face
        FROM users u
        LEFT JOIN face_encodings fe ON fe.user_id = u.id
        GROUP BY u.id
        ORDER BY u.name
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@users_bp.route("", methods=["POST"])
def create_user():
    err = _require_admin()
    if err: return err
    data = request.get_json()
    required = ["user_code", "name", "email", "password"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required"}), 400

    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO users (user_code, name, email, role, password)
            VALUES (?, ?, ?, ?, ?)
        """, (
            data["user_code"].strip(),
            data["name"].strip(),
            data["email"].strip().lower(),
            data.get("role", "student"),
            hash_password(data["password"])
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409
    conn.close()
    return jsonify({"message": "User created"}), 201


@users_bp.route("/<int:uid>", methods=["PUT"])
def update_user(uid):
    err = _require_admin()
    if err: return err
    data = request.get_json()
    conn = get_db()
    fields, vals = [], []
    for col in ["name", "email", "role", "user_code"]:
        if col in data:
            fields.append(f"{col} = ?")
            vals.append(data[col])
    if "password" in data and data["password"]:
        fields.append("password = ?")
        vals.append(hash_password(data["password"]))
    if not fields:
        conn.close()
        return jsonify({"error": "Nothing to update"}), 400
    vals.append(uid)
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", vals)
    conn.commit()
    conn.close()
    return jsonify({"message": "User updated"})


@users_bp.route("/<int:uid>", methods=["DELETE"])
def delete_user(uid):
    err = _require_admin()
    if err: return err
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})


@users_bp.route("/<int:uid>/enroll", methods=["POST"])
def enroll_face(uid):
    """
    Receive multiple base64 images (5 samples), extract face from each,
    store all samples in DB. More samples = much better accuracy.
    """
    err = _require_admin()
    if err: return err

    if not FR_AVAILABLE:
        return jsonify({"error": "OpenCV not available"}), 503

    data = request.get_json()

    # Accept either a single image or a list of images
    images = data.get("images") or []
    if data.get("image"):
        images.append(data["image"])

    if not images:
        return jsonify({"error": "At least one image required"}), 400

    encodings = []
    for b64_image in images:
        enc = encode_face(b64_image)
        if enc is not None:
            encodings.append(enc)

    if not encodings:
        return jsonify({"error": "No face detected in any image. Ensure good lighting and face the camera directly."}), 422

    conn = get_db()
    # Remove old encodings for this user
    conn.execute("DELETE FROM face_encodings WHERE user_id = ?", (uid,))
    # Store all samples
    for enc in encodings:
        conn.execute(
            "INSERT INTO face_encodings (user_id, encoding) VALUES (?, ?)",
            (uid, encoding_to_str(enc))
        )
    conn.commit()
    conn.close()
    return jsonify({"message": f"Face enrolled with {len(encodings)} sample(s). Accuracy improved!"})
