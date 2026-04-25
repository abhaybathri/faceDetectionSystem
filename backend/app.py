"""
Face Detection Attendance System — Flask Backend
Main application entry point
"""

from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.auth import auth_bp
from routes.users import users_bp
from routes.attendance import attendance_bp
from routes.reports import reports_bp
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=os.path.join(BASE_DIR, "../frontend"), static_url_path="/")
app.secret_key = os.environ.get("SECRET_KEY", "faceattend-secret-2026")

# Allow frontend (any origin in dev; restrict in prod)
CORS(app, supports_credentials=True)

# Register blueprints
app.register_blueprint(auth_bp,        url_prefix="/api/auth")
app.register_blueprint(users_bp,       url_prefix="/api/users")
app.register_blueprint(attendance_bp,  url_prefix="/api/attendance")
app.register_blueprint(reports_bp,     url_prefix="/api/reports")

# Serve frontend SPA
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    return app.send_static_file("index.html")

if __name__ == "__main__":
    init_db()
    print("\n✅  FaceAttend backend running at http://localhost:5000\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
