#!/bin/bash
echo "============================================"
echo " FaceAttend - Setup Script (Linux/Mac)"
echo "============================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 not found. Install with: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

echo "[OK] Python3 found: $(python3 --version)"

# System deps for dlib (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Installing system dependencies..."
    sudo apt-get update -qq
    sudo apt-get install -y cmake build-essential libopenblas-dev liblapack-dev \
        libx11-dev libgtk-3-dev python3-dev
fi

# Virtual environment
python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install flask flask-cors Pillow numpy gunicorn
pip install cmake dlib face-recognition

echo ""
echo "============================================"
echo " Setup complete! Run: source venv/bin/activate && cd backend && python app.py"
echo "============================================"
