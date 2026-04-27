"""
Reports routes (admin + teacher)
GET /api/reports        - attendance log with filters
GET /api/reports/export - CSV download
GET /api/reports/classes - distinct branch/class/section combos
"""

from flask import Blueprint, request, jsonify, Response, session
from database import get_db
import csv, io

reports_bp = Blueprint("reports", __name__)


def _can_access():
    role = session.get("user_role")
    if role not in ("admin", "teacher"):
        return jsonify({"error": "Login required"}), 403
    return None


@reports_bp.route("", methods=["GET"])
def get_reports():
    err = _can_access()
    if err: return err

    date_filter    = request.args.get("date")
    branch_filter  = request.args.get("branch", "").strip().upper()
    class_filter   = request.args.get("class_name", "").strip()
    section_filter = request.args.get("section", "").strip().upper()
    status_filter  = request.args.get("status")
    student_filter = request.args.get("student_id")

    query  = """
        SELECT a.id, s.name, s.roll_no, s.branch, s.class_name, s.section,
               a.date, a.time_in, a.status, a.method
        FROM attendance a JOIN students s ON s.id=a.student_id
        WHERE 1=1
    """
    params = []

    if date_filter:
        query += " AND a.date=?"; params.append(date_filter)
    if branch_filter:
        query += " AND s.branch=?"; params.append(branch_filter)
    if class_filter:
        query += " AND s.class_name=?"; params.append(class_filter)
    if section_filter:
        query += " AND s.section=?"; params.append(section_filter)
    if status_filter:
        query += " AND a.status=?"; params.append(status_filter)
    if student_filter:
        query += " AND a.student_id=?"; params.append(student_filter)

    # Teacher: restrict to their assigned classes
    if session.get("user_role") == "teacher":
        tid = session["user_id"]
        conn = get_db()
        assignments = conn.execute(
            "SELECT branch,class_name,section FROM teacher_assignments WHERE teacher_id=?", (tid,)
        ).fetchall()
        conn.close()
        if not assignments:
            return jsonify([])
        placeholders = " OR ".join(
            ["(s.branch=? AND s.class_name=? AND s.section=?)"] * len(assignments)
        )
        query += f" AND ({placeholders})"
        for a in assignments:
            params.extend([a["branch"], a["class_name"], a["section"]])

    query += " ORDER BY a.date DESC, s.branch, s.class_name, s.section, s.name"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@reports_bp.route("/export", methods=["GET"])
def export_csv():
    err = _can_access()
    if err: return err

    date_filter    = request.args.get("date")
    branch_filter  = request.args.get("branch", "").strip().upper()
    class_filter   = request.args.get("class_name", "").strip()
    section_filter = request.args.get("section", "").strip().upper()

    query  = """
        SELECT s.name, s.roll_no, s.branch, s.class_name, s.section,
               a.date, a.time_in, a.status, a.method
        FROM attendance a JOIN students s ON s.id=a.student_id
        WHERE 1=1
    """
    params = []
    if date_filter:
        query += " AND a.date=?"; params.append(date_filter)
    if branch_filter:
        query += " AND s.branch=?"; params.append(branch_filter)
    if class_filter:
        query += " AND s.class_name=?"; params.append(class_filter)
    if section_filter:
        query += " AND s.section=?"; params.append(section_filter)

    if session.get("user_role") == "teacher":
        tid = session["user_id"]
        conn = get_db()
        assignments = conn.execute(
            "SELECT branch,class_name,section FROM teacher_assignments WHERE teacher_id=?", (tid,)
        ).fetchall()
        conn.close()
        if assignments:
            placeholders = " OR ".join(
                ["(s.branch=? AND s.class_name=? AND s.section=?)"] * len(assignments)
            )
            query += f" AND ({placeholders})"
            for a in assignments:
                params.extend([a["branch"], a["class_name"], a["section"]])

    query += " ORDER BY a.date DESC, s.branch, s.class_name, s.section, s.name"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Roll No", "Branch", "Class", "Section", "Date", "Time", "Status", "Method"])
    for r in rows:
        writer.writerow([r["name"], r["roll_no"], r["branch"], r["class_name"],
                         r["section"], r["date"], r["time_in"], r["status"], r["method"]])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"}
    )


@reports_bp.route("/classes", methods=["GET"])
def distinct_classes():
    """Return distinct branch/class/section combos (for filter dropdowns)."""
    err = _can_access()
    if err: return err

    conn = get_db()
    if session.get("user_role") == "teacher":
        tid  = session["user_id"]
        rows = conn.execute("""
            SELECT DISTINCT branch, class_name, section
            FROM teacher_assignments WHERE teacher_id=?
            ORDER BY branch, class_name, section
        """, (tid,)).fetchall()
    else:
        rows = conn.execute("""
            SELECT DISTINCT branch, class_name, section FROM students
            ORDER BY branch, class_name, section
        """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])
