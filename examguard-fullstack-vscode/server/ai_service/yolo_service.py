import sys
import os
import json
import base64
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import numpy as np
import cv2

print("==========================================================")
print("   EXAMGUARD AI PROCTORING SERVICE (YOLOv8 DEEP LEARNING)  ")
print("==========================================================")

# Khởi tạo mô hình YOLOv8
try:
    from ultralytics import YOLO
    print("[1/2] Đang tải mô hình YOLOv8 Nano...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(current_dir))
    candidates = [
        os.path.join(root_dir, 'yolov8n.pt'),
        os.path.join(current_dir, 'yolov8n.pt'),
        'yolov8n.pt'
    ]
    weights_path = 'yolov8n.pt'
    for c in candidates:
        if os.path.exists(c):
            weights_path = c
            break
    print(f"-> Sử dụng trọng số YOLOv8: {weights_path}")
    model = YOLO(weights_path)
    print("✓ Tải mô hình YOLOv8 thành công! Đang kích hoạt chế độ giám sát phòng thi.")
except Exception as e:
    print(f"✕ Lỗi tải mô hình YOLOv8: {e}")
    model = None

# Danh mục vật thể quan tâm trong quy chế phòng thi:
# COCO classes: 0: person (thí sinh), 67: cell phone (điện thoại), 73: book (sách/tài liệu)
CLASS_NAMES = {
    0: 'person',
    67: 'cell phone',
    73: 'book',
    63: 'laptop',
    76: 'scissors'
}

def analyze_frame_yolo(img_bytes):
    if model is None:
        return {
            "status": "OK",
            "message": "Model YOLOv8 chưa sẵn sàng",
            "personCount": 1,
            "hasPhone": False
        }
    
    # Giải mã ảnh từ buffer
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "ERROR", "message": "Không thể giải mã khung hình ảnh"}

    h, w = frame.shape[:2]

    # Suy luận AI YOLOv8
    results = model(frame, conf=0.38, verbose=False)
    boxes_data = []
    
    person_count = 0
    phone_detected = False
    book_detected = False
    max_phone_conf = 0.0

    if len(results) > 0 and results[0].boxes is not None:
        for box in results[0].boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            xyxy = box.xyxy[0].tolist()

            if cls_id == 0:  # person
                # Lọc người: Người phải có diện tích tối thiểu trong khung hình webcam
                bw = xyxy[2] - xyxy[0]
                bh = xyxy[3] - xyxy[1]
                if (bw * bh) >= (w * h * 0.04):
                    person_count += 1
                    boxes_data.append({
                        "class": "person",
                        "conf": round(conf, 2),
                        "box": [round(v) for v in xyxy]
                    })
            elif cls_id == 67:  # cell phone
                phone_detected = True
                max_phone_conf = max(max_phone_conf, conf)
                boxes_data.append({
                    "class": "cell phone",
                    "conf": round(conf, 2),
                    "box": [round(v) for v in xyxy]
                })
            elif cls_id == 73:  # book / material
                book_detected = True
                boxes_data.append({
                    "class": "book",
                    "conf": round(conf, 2),
                    "box": [round(v) for v in xyxy]
                })

    # Ra quyết định vi phạm quy chế
    if phone_detected:
        return {
            "status": "VIOLATION",
            "violationType": "PHONE_DETECTED",
            "message": f"Cảnh báo vi phạm: Phát hiện sử dụng điện thoại di động trong phòng thi (Độ tin cậy: {round(max_phone_conf * 100)}%)!",
            "personCount": person_count,
            "hasPhone": True,
            "hasBook": book_detected,
            "boxes": boxes_data
        }
    
    if person_count >= 2:
        return {
            "status": "VIOLATION",
            "violationType": "MULTIPLE_FACES",
            "message": f"Cảnh báo vi phạm: Phát hiện {person_count} người trong khung hình camera! Quy chế chỉ cho phép 1 thí sinh duy nhất.",
            "personCount": person_count,
            "hasPhone": False,
            "hasBook": book_detected,
            "boxes": boxes_data
        }

    if person_count == 0:
        return {
            "status": "VIOLATION",
            "violationType": "NO_FACE",
            "message": "Không phát hiện thí sinh trong khung hình camera! Vui lòng ngồi ngay ngắn trước webcam.",
            "personCount": 0,
            "hasPhone": False,
            "hasBook": book_detected,
            "boxes": boxes_data
        }

    if book_detected:
        return {
            "status": "VIOLATION",
            "violationType": "MATERIAL_DETECTED",
            "message": "Cảnh báo vi phạm: Phát hiện tài liệu / sách nghi vấn trong phòng thi!",
            "personCount": person_count,
            "hasPhone": False,
            "hasBook": True,
            "boxes": boxes_data
        }

    return {
        "status": "OK",
        "violationType": None,
        "message": "✓ Giám sát YOLOv8: 1 thí sinh hợp lệ, không có thiết bị lạ.",
        "personCount": 1,
        "hasPhone": False,
        "hasBook": False,
        "boxes": boxes_data
    }

class AIRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "OK", "model": "YOLOv8 Nano"}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/analyze':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
                img_b64 = data.get('image', '')
                if ',' in img_b64:
                    img_b64 = img_b64.split(',', 1)[1]
                img_bytes = base64.b64decode(img_b64)
                
                result = analyze_frame_yolo(img_bytes)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as ex:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "ERROR", "error": str(ex)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Giảm thiểu in log để tăng tối đa tốc độ xử lý
        return

def run_server(port=5001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, AIRequestHandler)
    print(f"[2/2] ✓ Dịch vụ AI YOLOv8 đã sẵn sàng tại http://localhost:{port}")
    print("----------------------------------------------------------")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng AI Server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server(5001)
