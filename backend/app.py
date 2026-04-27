"""
FaceAttend College Edition — Flask Backend
"""

from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.auth import auth_bp
from routes.teachers import teachers_bp
from routes.students import students_bp
from routes.attendance import attendance_bp
from routes.reports import reports_bp
from routes.structure import structure_bp
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, "../frontend"),
    static_url_path="/"
)
app.secret_key = os.environ.get("SECRET_KEY", "faceattend-college-secret-2026")
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True

CORS(app, supports_credentials=True)

app.register_blueprint(auth_bp,        url_prefix="/api/auth")
app.register_blueprint(teachers_bp,    url_prefix="/api/teachers")
app.register_blueprint(students_bp,    url_prefix="/api/students")
app.register_blueprint(attendance_bp,  url_prefix="/api/attendance")
app.register_blueprint(reports_bp,     url_prefix="/api/reports")
app.register_blueprint(structure_bp,   url_prefix="/api/structure")

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    return app.send_static_file("index.html")

if __name__ == "__main__":
    init_db()
    print("\n✅  FaceAttend College Edition running at http://localhost:5000\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
