# ============================================
# FaceAttend — Docker deployment
# ============================================
FROM python:3.11-slim

# System deps for dlib / OpenCV
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy frontend (Flask serves it as static)
COPY frontend/ ./frontend/

WORKDIR /app/backend

EXPOSE 5000

ENV FLASK_ENV=production
ENV SECRET_KEY=change-me-in-production

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
