"""
User management (admin only)
GET    /api/users                  - list users
POST   /api/users                  - create user
PUT    /api/users/<id>             - update user
DELETE /api/users/<id>             - delete user
POST   /api/users/<id>/enroll      - enroll face (8 images + embeddings)
GET    /api/users/<id>/images      - get all enrolled face images
"""

from flask import Blueprint, request, jsonify, session
from database import get_db
from face_engine import encode_face, encoding_to_str, FR_AVAILABLE

users_bp = Blueprint("users", __name__)


def _admin():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin access required"}), 403


@users_bp.route("", methods=["GET"])
def list_users():
    if _admin(): return _admin()
    conn = get_db()
    rows = conn.execute("""
        SELECT u.id, u.user_code, u.name, u.email, u.role, u.created_at,
               COUNT(DISTINCT fe.id) as sample_count,
               COUNT(DISTINCT fi.id) as image_count
        FROM users u
        LEFT JOIN face_encodings fe ON fe.user_id = u.id
        LEFT JOIN face_images fi    ON fi.user_id  = u.id
        GROUP BY u.id ORDER BY u.name
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@users_bp.route("", methods=["POST"])
def create_user():
    if _admin(): return _admin()
    data = request.get_json()
    for f in ["user_code", "name", "email"]:
        if not data.get(f):
            return jsonify({"error": f"{f} is required"}), 400
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (user_code, name, email, role) VALUES (?,?,?,?)",
            (data["user_code"].strip(), data["name"].strip(),
             data["email"].strip().lower(), data.get("role", "student"))
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 409
    conn.close()
    return jsonify({"message": "User created"}), 201


@users_bp.route("/<int:uid>", methods=["PUT"])
def update_user(uid):
    if _admin(): return _admin()
    data = request.get_json()
    conn = get_db()
    fields, vals = [], []
    for col in ["name", "email", "role", "user_code"]:
        if col in data:
            fields.append(f"{col} = ?")
            vals.append(data[col])
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
    if _admin(): return _admin()
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})


@users_bp.route("/<int:uid>/enroll", methods=["POST"])
def enroll_face(uid):
    """
    Receive list of base64 images.
    For each image: extract Facenet embedding + store raw image for viewing.
    """
    if _admin(): return _admin()
    if not FR_AVAILABLE:
        return jsonify({"error": "face_recognition not available"}), 503

    data   = request.get_json()
    images = data.get("images") or []
    if data.get("image"):
        images.append(data["image"])
    if not images:
        return jsonify({"error": "No images provided"}), 400

    good_encodings = []
    good_images    = []

    for b64 in images:
        enc = encode_face(b64)
        if enc is not None:
            good_encodings.append(enc)
            good_images.append(b64)

    if not good_encodings:
        return jsonify({
            "error": "No face detected in any image. "
                     "Ensure good lighting and look directly at the camera."
        }), 422

    conn = get_db()
    # Clear old data for this user
    conn.execute("DELETE FROM face_encodings WHERE user_id = ?", (uid,))
    conn.execute("DELETE FROM face_images    WHERE user_id = ?", (uid,))

    for enc, img in zip(good_encodings, good_images):
        conn.execute(
            "INSERT INTO face_encodings (user_id, encoding) VALUES (?,?)",
            (uid, encoding_to_str(enc))
        )
        conn.execute(
            "INSERT INTO face_images (user_id, image_b64) VALUES (?,?)",
            (uid, img)
        )

    conn.commit()
    conn.close()
    return jsonify({
        "message": f"Enrolled {len(good_encodings)} face samples successfully!"
    })


@users_bp.route("/<int:uid>/images", methods=["GET"])
def get_face_images(uid):
    """Return all stored face images for a user."""
    if _admin(): return _admin()
    conn = get_db()
    rows = conn.execute(
        "SELECT id, image_b64, created_at FROM face_images WHERE user_id = ? ORDER BY id",
        (uid,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
