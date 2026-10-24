import base64
import numpy as np
import cv2

def decode_base64_image(base64_string: str):
    """Giải mã chuỗi ảnh Base64 từ Frontend/Backend thành khung hình OpenCV (BGR)."""
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        img_bytes = base64.b64decode(base64_string)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None

def compute_face_signature(face_roi) -> list:
    """
    Tính vector đặc trưng 8 chiều chuẩn hóa từ vùng ảnh khuôn mặt (ROI)
    để so khớp khoảng cách Euclidean khi không có GPU.
    """
    resized = cv2.resize(face_roi, (64, 64))
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [8], [0, 256]).flatten()
    norm = np.linalg.norm(hist)
    if norm > 0:
        hist = hist / norm
    return [round(float(x), 4) for x in hist]

def euclidean_distance(vec1: list, vec2: list) -> float:
    a = np.array(vec1, dtype=np.float32)
    b = np.array(vec2, dtype=np.float32)
    if a.shape != b.shape:
        min_len = min(len(a), len(b))
        a = a[:min_len]
        b = b[:min_len]
    return float(np.linalg.norm(a - b))
