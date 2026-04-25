"""
Face Recognition Engine — OpenCV based (no dlib required)
Uses:
  - Haar Cascade for face detection
  - LBPH (Local Binary Pattern Histogram) for face recognition
  - Stores face histograms as JSON in SQLite
Works on any Windows machine without C++ build tools.
"""

import cv2
import numpy as np
import base64
import json
import io
from PIL import Image

FR_AVAILABLE = True   # OpenCV is always available


def decode_image(b64_string: str) -> np.ndarray:
    """Decode base64 image string to BGR numpy array (OpenCV format)."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _get_face_cascade():
    return cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def _extract_face_region(bgr_img: np.ndarray):
    """Detect and return the largest face region as a 100x100 grayscale crop."""
    cascade = _get_face_cascade()
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    # Pick the largest face
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_roi = gray[y:y+h, x:x+w]
    face_roi = cv2.resize(face_roi, (100, 100))
    return face_roi


def _compute_lbph_histogram(face_gray: np.ndarray) -> list:
    """Compute a normalised LBP histogram for a grayscale face image."""
    radius, n_points = 1, 8
    h, w = face_gray.shape
    lbp = np.zeros_like(face_gray, dtype=np.uint8)
    for i in range(radius, h - radius):
        for j in range(radius, w - radius):
            center = face_gray[i, j]
            code = 0
            for k, (di, dj) in enumerate([
                (-1,-1),(-1,0),(-1,1),(0,1),(1,1),(1,0),(1,-1),(0,-1)
            ]):
                code |= (1 << k) if face_gray[i+di, j+dj] >= center else 0
            lbp[i, j] = code
    hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
    hist = hist.astype(float)
    hist /= (hist.sum() + 1e-7)   # normalise
    return hist.tolist()


def encode_face(b64_image: str):
    """
    Detect face in image and return its LBPH histogram (256 floats).
    Returns None if no face found.
    """
    bgr = decode_image(b64_image)
    face = _extract_face_region(bgr)
    if face is None:
        return None
    return _compute_lbph_histogram(face)


def recognize_face(b64_image: str, known_encodings: list, tolerance: float = 0.35):
    """
    Compare face in image against stored histograms.
    known_encodings: list of {user_id, encoding (list of 256 floats)}
    Returns (matched_user_id, confidence_percent) or (None, 0.0)
    """
    bgr = decode_image(b64_image)
    face = _extract_face_region(bgr)
    if face is None:
        return None, 0.0

    unknown_hist = np.array(_compute_lbph_histogram(face))
    best_id   = None
    best_dist = float("inf")

    for item in known_encodings:
        known_hist = np.array(item["encoding"])
        # Chi-squared distance between histograms
        diff = unknown_hist - known_hist
        denom = unknown_hist + known_hist + 1e-10
        dist = float(np.sum((diff ** 2) / denom))
        if dist < best_dist:
            best_dist = dist
            best_id   = item["user_id"]

    if best_dist > tolerance:
        return None, 0.0

    confidence = round(max(0, (1 - best_dist / tolerance)) * 100, 1)
    return best_id, confidence


def encoding_to_str(enc: list) -> str:
    return json.dumps(enc)


def str_to_encoding(s: str) -> list:
    return json.loads(s)
