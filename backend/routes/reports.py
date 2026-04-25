"""
Reports routes:
GET /api/reports           - full attendance log (admin)
GET /api/reports/export    - CSV download
"""

from flask import Blueprint, request, jsonify, Response, session
from database import get_db
import csv, io

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("", methods=["GET"])
def get_reports():
    date_filter   = request.args.get("date")
    user_filter   = request.args.get("user_id")
    status_filter = request.args.get("status")

    query  = """
        SELECT a.id, u.name, u.user_code, a.date, a.time_in, a.status, a.method
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        WHERE 1=1
    """
    params = []
    if date_filter:
        query += " AND a.date = ?"; params.append(date_filter)
    if user_filter:
        query += " AND a.user_id = ?"; params.append(user_filter)
    if status_filter:
        query += " AND a.status = ?"; params.append(status_filter)
    query += " ORDER BY a.date DESC, a.time_in DESC"

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@reports_bp.route("/export", methods=["GET"])
def export_csv():
    if session.get("user_role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    conn = get_db()
    rows = conn.execute("""
        SELECT u.name, u.user_code, a.date, a.time_in, a.status, a.method
        FROM attendance a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.date DESC
    """).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "User Code", "Date", "Time", "Status", "Method"])
    for r in rows:
        writer.writerow([r["name"], r["user_code"], r["date"], r["time_in"], r["status"], r["method"]])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance_report.csv"}
    )
