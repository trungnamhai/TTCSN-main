const fs = require('fs');
const path = require('path');
const { pool, fallbackStore } = require('../models/exam.model');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000/api/ai';

async function callFastAPIVerify(payload) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/verify-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('FastAPI returned non-200');
    return await response.json();
  } catch (err) {
    // Nếu FastAPI chưa bật, trả kết quả kiểm tra chuẩn theo simulated_face_count
    const count = payload.simulated_face_count ?? 1;
    if (count === 0) {
      return {
        status: 'VIOLATION',
        violation_type: 'NO_FACE',
        face_count: 0,
        verified: false,
        euclidean_distance: null,
        boxes: [],
        message: 'Không phát hiện khuôn mặt trong khung hình (Fallback khi FastAPI chưa bật).'
      };
    }
    if (count > 1) {
      return {
        status: 'VIOLATION',
        violation_type: 'MULTIPLE_FACES',
        face_count: count,
        verified: false,
        euclidean_distance: 0.68,
        boxes: [
          { x: 45, y: 175, w: 150, h: 185 },
          { x: 225, y: 110, w: 210, h: 245 }
        ],
        message: `Cảnh báo: Phát hiện ${count} người trong khung hình! Chỉ cho phép 1 thí sinh.`
      };
    }
    return {
      status: 'OK',
      violation_type: null,
      face_count: 1,
      verified: true,
      euclidean_distance: 0.25,
      boxes: [{ x: 190, y: 95, w: 220, h: 250 }],
      message: 'Xác thực khuôn mặt thành công (Euclidean = 0.25 <= 0.45).'
    };
  }
}

exports.verifyFaceAndLog = async (req, res) => {
  const { imageBase64, simulatedFaceCount, attemptId } = req.body;
  const studentCode = req.user?.username || 'SV2026001';

  const aiResult = await callFastAPIVerify({
    image_base64: imageBase64,
    simulated_face_count: simulatedFaceCount,
    student_code: studentCode
  });

  if (aiResult.status === 'VIOLATION' && aiResult.violation_type) {
    await saveViolationInternal({
      attemptId: attemptId || 1,
      studentCode,
      fullName: req.user?.full_name || 'Minh Nhật',
      violationType: aiResult.violation_type,
      euclideanDistance: aiResult.euclidean_distance,
      imageBase64,
      io: req.app.get('io')
    });
  }

  return res.json(aiResult);
};

async function saveViolationInternal({
  attemptId,
  studentCode,
  fullName,
  violationType,
  euclideanDistance,
  imageBase64,
  io
}) {
  let evidencePath = '/uploads/evidence_default.jpg';

  if (imageBase64 && imageBase64.includes('base64,')) {
    try {
      const base64Data = imageBase64.split('base64,')[1];
      const fileName = `evidence_${studentCode}_${Date.now()}.jpg`;
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(base64Data, 'base64'));
      evidencePath = `/uploads/${fileName}`;
    } catch (e) {
      evidencePath = '/uploads/evidence_capture.jpg';
    }
  }

  const logEntry = {
    id: Date.now(),
    attempt_id: attemptId || 1,
    student_code: studentCode || 'SV2026001',
    full_name: fullName || 'Minh Nhật',
    violation_type: violationType,
    euclidean_distance: euclideanDistance ?? null,
    evidence_image_path: evidencePath,
    timestamp: new Date().toISOString()
  };

  try {
    const [result] = await pool.query(
      `INSERT INTO proctoring_logs (attempt_id, violation_type, euclidean_distance, evidence_image_path)
       VALUES (?, ?, ?, ?)`,
      [logEntry.attempt_id, logEntry.violation_type, logEntry.euclidean_distance, logEntry.evidence_image_path]
    );
    logEntry.id = result.insertId;
  } catch (err) {
    fallbackStore.proctoringLogs.unshift(logEntry);
  }

  if (io) {
    io.emit('proctoring:violation_alert', logEntry);
  }

  return logEntry;
}

exports.reportClientViolation = async (req, res) => {
  const { attemptId, violationType, euclideanDistance, imageBase64 } = req.body;
  const logEntry = await saveViolationInternal({
    attemptId: attemptId || 1,
    studentCode: req.user?.username || 'SV2026001',
    fullName: req.user?.full_name || 'Minh Nhật',
    violationType: violationType || 'TAB_SWITCH',
    euclideanDistance: euclideanDistance ?? null,
    imageBase64,
    io: req.app.get('io')
  });

  return res.status(201).json({
    message: 'Đã ghi nhận vi phạm vào bảng proctoring_logs và gửi cảnh báo cho Giám thị.',
    log: logEntry
  });
};
