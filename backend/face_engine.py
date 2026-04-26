"""
Face Recognition Engine — DeepFace + Facenet Neural Network
============================================================
Uses DeepFace library with Facenet model.
Facenet generates a 128-dimensional embedding vector per face.
Two faces are the same person if their cosine distance is below threshold.

Why this works where LBPH failed:
  - LBPH compares raw pixel patterns (affected by lighting, angle, distance)
  - Facenet is a neural network trained on millions of faces — it learns
    actual facial geometry (eye spacing, nose shape, jaw line etc.)
  - Completely different people have cosine distance > 0.4
  - Same person under different conditions stays < 0.3
"""

import cv2
import numpy as np
import base64
import json
import io
import os
from PIL import Image

FR_AVAILABLE = True

# Cosine distance threshold:
#   < SAME_PERSON_THRESHOLD  → same person
#   > SAME_PERSON_THRESHOLD  → different person
# Facenet typical values: same person ~0.1-0.25, different ~0.4-1.0
SAME_PERSON_THRESHOLD = 0.35

# Minimum fraction of enrolled samples that must agree
VOTE_RATIO = 0.5   # at least half the samples must match


def decode_image(b64_string: str) -> np.ndarray:
    """Decode base64 image → RGB numpy array (DeepFace expects RGB)."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def _get_embedding(img_rgb: np.ndarray):
    """
    Extract 128-d Facenet embedding from an RGB image.
    Returns numpy array or None if no face found.
    DeepFace handles face detection internally.
    """
    from deepface import DeepFace
    try:
        result = DeepFace.represent(
            img_path      = img_rgb,
            model_name    = "Facenet",
            detector_backend = "opencv",
            enforce_detection = True,
            align          = True
        )
        # result is a list of dicts; take the first (largest) face
        return np.array(result[0]["embedding"])
    except Exception as e:
        print(f"[FaceEngine] embedding failed: {e}")
        return None


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine distance between two vectors. 0 = identical, 1 = opposite."""
    a = a / (np.linalg.norm(a) + 1e-10)
    b = b / (np.linalg.norm(b) + 1e-10)
    return float(1 - np.dot(a, b))


def encode_face(b64_image: str):
    """
    Detect face and return its 128-d Facenet embedding as a list.
    Returns None if no face detected.
    """
    img_rgb = decode_image(b64_image)
    emb     = _get_embedding(img_rgb)
    if emb is None:
        return None
    return emb.tolist()


def recognize_face(b64_image: str, known_encodings: list, tolerance=None):
    """
    Compare face against all enrolled samples using majority voting.

    known_encodings: list of {user_id, encoding (128-float list)}
    Returns (user_id, confidence_pct) or (None, 0.0)

    Logic:
      1. Get embedding of unknown face
      2. For each stored sample, compute cosine distance
      3. Sample "votes yes" if distance < SAME_PERSON_THRESHOLD
      4. Accept if votes / total_samples >= VOTE_RATIO
    """
    if not known_encodings:
        return None, 0.0

    img_rgb      = decode_image(b64_image)
    unknown_emb  = _get_embedding(img_rgb)
    if unknown_emb is None:
        return None, 0.0

    from collections import defaultdict
    user_votes    = defaultdict(int)
    user_total    = defaultdict(int)
    user_best_dist = defaultdict(lambda: float("inf"))

    for item in known_encodings:
        uid       = item["user_id"]
        known_emb = np.array(item["encoding"])
        dist      = _cosine_distance(unknown_emb, known_emb)
        user_total[uid] += 1
        if dist < SAME_PERSON_THRESHOLD:
            user_votes[uid] += 1
        if dist < user_best_dist[uid]:
            user_best_dist[uid] = dist
        print(f"[FaceEngine] user={uid} dist={dist:.4f} threshold={SAME_PERSON_THRESHOLD}")

    # Find best matching user
    best_uid   = None
    best_ratio = 0.0

    for uid in user_total:
        ratio = user_votes[uid] / user_total[uid]
        print(f"[FaceEngine] user={uid} votes={user_votes[uid]}/{user_total[uid]} ratio={ratio:.2f}")
        if ratio >= VOTE_RATIO and ratio > best_ratio:
            best_uid   = uid
            best_ratio = ratio

    if best_uid is None:
        return None, 0.0

    confidence = round(best_ratio * 100, 1)
    return best_uid, confidence


def encoding_to_str(enc: list) -> str:
    return json.dumps(enc)


def str_to_encoding(s: str) -> list:
    return json.loads(s)
