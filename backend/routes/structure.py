"""
College Structure routes (admin only)
GET    /api/structure          - get all branch/class/section combos
POST   /api/structure          - add a combo
DELETE /api/structure/<id>     - remove a combo
GET    /api/structure/branches - distinct branches
GET    /api/structure/classes  - classes for a branch (?branch=BTECH)
GET    /api/structure/sections - sections for branch+class (?branch=BTECH&class_name=2nd+Year)
"""

from flask import Blueprint, request, jsonify, session
from database import get_db

structure_bp = Blueprint("structure", __name__)


def _admin():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


@structure_bp.route("", methods=["GET"])
def get_all():
    err = _admin()
    if err: return err
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM college_structure ORDER BY branch, class_name, section"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@structure_bp.route("", methods=["POST"])
def add_entry():
    err = _admin()
    if err: return err
    data       = request.get_json() or {}
    branch     = (data.get("branch") or "").strip().upper()
    class_name = (data.get("class_name") or "").strip()
    section    = (data.get("section") or "").strip().upper()

    if not branch or not class_name or not section:
        return jsonify({"error": "branch, class_name, and section are required"}), 400

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO college_structure (branch, class_name, section) VALUES (?,?,?)",
            (branch, class_name, section)
        )
        conn.commit()
    except Exception:
        conn.close()
        return jsonify({"error": "This combination already exists"}), 409
    conn.close()
    return jsonify({"message": f"Added {branch} — {class_name} — Section {section}"}), 201


@structure_bp.route("/<int:sid>", methods=["DELETE"])
def delete_entry(sid):
    err = _admin()
    if err: return err
    conn = get_db()
    conn.execute("DELETE FROM college_structure WHERE id=?", (sid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Removed"})


@structure_bp.route("/branches", methods=["GET"])
def branches():
    # accessible to admin and teacher (for dropdowns)
    if session.get("user_role") not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT branch FROM college_structure ORDER BY branch"
    ).fetchall()
    conn.close()
    return jsonify([r["branch"] for r in rows])


@structure_bp.route("/classes", methods=["GET"])
def classes():
    if session.get("user_role") not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    branch = request.args.get("branch", "").strip().upper()
    if not branch:
        return jsonify({"error": "branch required"}), 400
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT class_name FROM college_structure WHERE branch=? ORDER BY class_name",
        (branch,)
    ).fetchall()
    conn.close()
    return jsonify([r["class_name"] for r in rows])


@structure_bp.route("/sections", methods=["GET"])
def sections():
    if session.get("user_role") not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    branch     = request.args.get("branch", "").strip().upper()
    class_name = request.args.get("class_name", "").strip()
    if not branch or not class_name:
        return jsonify({"error": "branch and class_name required"}), 400
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT section FROM college_structure WHERE branch=? AND class_name=? ORDER BY section",
        (branch, class_name)
    ).fetchall()
    conn.close()
    return jsonify([r["section"] for r in rows])
