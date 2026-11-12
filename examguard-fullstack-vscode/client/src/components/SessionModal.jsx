import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './SessionModal.css';

export default function SessionModal({ isOpen, session, exams = [], onClose, token, onSessionSaved }) {
  const isEditing = Boolean(session && session.id);

  const [sessionCode, setSessionCode] = useState('');
  const [title, setTitle] = useState('');
  const [examId, setExamId] = useState('');
  const [room, setRoom] = useState('Phòng thi Trực tuyến 01');
  const [examDate, setExamDate] = useState('');
  const [timeRange, setTimeRange] = useState('08:00 - 09:30');
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Security & Anti-Cheat Configuration
  const [requireFaceCheck, setRequireFaceCheck] = useState(true);
  const [maxFaceDistance, setMaxFaceDistance] = useState(0.60);
  const [detectMultipleFaces, setDetectMultipleFaces] = useState(true);
  const [detectTabSwitch, setDetectTabSwitch] = useState(true);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [preventCopyPaste, setPreventCopyPaste] = useState(true);
  const [maxViolations, setMaxViolations] = useState(3);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (session) {
        setSessionCode(session.session_code || '');
        setTitle(session.title || '');
        setExamId(session.exam_id || (exams[0]?.id || ''));
        setRoom(session.room || 'Phòng thi Trực tuyến 01');
        setExamDate(session.exam_date || new Date().toLocaleDateString('vi-VN'));
        setTimeRange(session.time_range || '08:00 - 09:30');
        setDurationMinutes(session.duration_minutes || 60);

        const sec = session.security_config || {};
        setRequireFaceCheck(sec.require_face_check !== false);
        setMaxFaceDistance(sec.max_face_distance !== undefined ? sec.max_face_distance : 0.60);
        setDetectMultipleFaces(sec.detect_multiple_faces !== false);
        setDetectTabSwitch(sec.detect_tab_switch !== false);
        setRequireFullscreen(sec.require_fullscreen !== false);
        setPreventCopyPaste(sec.prevent_copy_paste !== false);
        setMaxViolations(sec.max_violations !== undefined ? sec.max_violations : 3);
      } else {
        const randomCode = `EXAM${Math.floor(10 + Math.random() * 90)}`;
        setSessionCode(randomCode);
        setTitle('');
        setExamId(exams[0]?.id || '');
        setRoom('Phòng thi Trực tuyến 01');
        setExamDate(new Date().toLocaleDateString('vi-VN'));
        setTimeRange('08:00 - 09:30');
        setDurationMinutes(exams[0]?.duration_minutes || 60);

        setRequireFaceCheck(true);
        setMaxFaceDistance(0.60);
        setDetectMultipleFaces(true);
        setDetectTabSwitch(true);
        setRequireFullscreen(true);
        setPreventCopyPaste(true);
        setMaxViolations(3);
      }
      setErrorMsg('');
    }
  }, [isOpen, session, exams]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sessionCode.trim()) {
      setErrorMsg('Vui lòng nhập mã phòng thi / ca thi.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề ca thi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        session_code: sessionCode.trim().toUpperCase(),
        title: title.trim(),
        exam_id: examId || (exams[0]?.id || 1),
        room: room.trim() || 'Phòng thi Trực tuyến',
        exam_date: examDate,
        time_range: timeRange,
        duration_minutes: Number(durationMinutes),
        security_config: {
          require_face_check: requireFaceCheck,
          max_face_distance: Number(maxFaceDistance),
          detect_multiple_faces: detectMultipleFaces,
          detect_tab_switch: detectTabSwitch,
          require_fullscreen: requireFullscreen,
          prevent_copy_paste: preventCopyPaste,
          max_violations: Number(maxViolations)
        }
      };

      let response;
      if (isEditing) {
        response = await apiRequest(`/teacher/sessions/${session.id || session.session_id}`, {
          method: 'PUT',
          token,
          body: payload
        });
      } else {
        response = await apiRequest('/teacher/sessions', {
          method: 'POST',
          token,
          body: payload
        });
      }

      const saved = response.session || {
        id: session?.id || Date.now(),
        ...payload
      };

      onSessionSaved(saved);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu phòng thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-container eg-session-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div>
            <h3 className="eg-modal-title">
              {isEditing ? 'Sửa thông tin phòng thi & Cấu hình bảo mật' : 'Tạo phòng thi / Ca thi trực tuyến mới'}
            </h3>
            <p className="eg-modal-subtitle">
              Thiết lập phòng thi, liên kết bộ đề và cấu hình các biện pháp chống gian lận AI.
            </p>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose} title="Đóng">✕</button>
        </div>

        {errorMsg && <div className="eg-modal-alert-error" role="alert">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="eg-modal-form">
          {/* Section 1: Thông tin phòng thi */}
          <div className="eg-form-section-title">1. Thông tin phòng thi & Đề thi liên kết</div>

          <div className="eg-modal-grid-2">
            <div className="eg-form-group">
              <label className="eg-form-label">
                Mã ca thi / phòng thi <span className="eg-required">*</span>
              </label>
              <input
                type="text"
                className="eg-input eg-monospace-input"
                placeholder="VD: EXAM88, IT_WEB_01"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">
                Bộ đề thi gốc liên kết <span className="eg-required">*</span>
              </label>
              <select
                className="eg-select"
                value={examId}
                onChange={(e) => {
                  setExamId(e.target.value);
                  const sel = exams.find((ex) => String(ex.id) === String(e.target.value));
                  if (sel) {
                    if (!title) setTitle(`Ca thi: ${sel.title}`);
                    if (sel.duration_minutes) setDurationMinutes(sel.duration_minutes);
                  }
                }}
              >
                {exams.length === 0 ? (
                  <option value={1}>Đề thi mẫu mặc định (IT4010)</option>
                ) : (
                  exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      [{ex.exam_code}] {ex.title} ({ex.duration_minutes || 60}p - {ex.total_questions || 20} câu)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="eg-form-group">
            <label className="eg-form-label">
              Tên / Tiêu đề ca thi <span className="eg-required">*</span>
            </label>
            <input
              type="text"
              className="eg-input"
              placeholder="VD: Kiểm tra Giữa kỳ: An toàn thông tin & Khảo thí AI..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="eg-modal-grid-3">
            <div className="eg-form-group">
              <label className="eg-form-label">Phòng máy / Địa điểm</label>
              <input
                type="text"
                className="eg-input"
                placeholder="VD: Phòng Máy 302 - Tòa A"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">Ngày thi</label>
              <input
                type="text"
                className="eg-input"
                placeholder="VD: 15/11/2026"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">Khung giờ & Thời lượng</label>
              <div className="eg-inline-inputs">
                <input
                  type="text"
                  className="eg-input"
                  style={{ width: '65%' }}
                  placeholder="08:00 - 09:30"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                />
                <input
                  type="number"
                  min="5"
                  max="360"
                  className="eg-input"
                  style={{ width: '35%' }}
                  title="Thời lượng làm bài (phút)"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Cấu hình bảo mật ca thi & Giám sát AI */}
          <div className="eg-form-section-title">
            <span>2. Cấu hình bảo mật ca thi & Giám sát AI (Anti-Cheat)</span>
            <span className="eg-badge-proctor-active">ExamGuard AI Ready</span>
          </div>

          <div className="eg-security-settings-box">
            <div className="eg-sec-grid">
              <label className="eg-sec-item">
                <input
                  type="checkbox"
                  checked={requireFaceCheck}
                  onChange={(e) => setRequireFaceCheck(e.target.checked)}
                />
                <div className="eg-sec-text">
                  <strong>Giám sát khuôn mặt AI định kỳ (`require_face_check`)</strong>
                  <span>Tự động chụp và so khớp vector khuôn mặt (Face Embedding) thời gian thực.</span>
                </div>
              </label>

              <label className="eg-sec-item">
                <input
                  type="checkbox"
                  checked={detectMultipleFaces}
                  onChange={(e) => setDetectMultipleFaces(e.target.checked)}
                />
                <div className="eg-sec-text">
                  <strong>Phát hiện nhiều người trong camera (`MULTIPLE_FACES`)</strong>
                  <span>Gửi cảnh báo tức thì tới giám thị khi phát hiện người thứ hai trong khung hình.</span>
                </div>
              </label>

              <label className="eg-sec-item">
                <input
                  type="checkbox"
                  checked={detectTabSwitch}
                  onChange={(e) => setDetectTabSwitch(e.target.checked)}
                />
                <div className="eg-sec-text">
                  <strong>Bắt sự kiện chuyển tab / ứng dụng ngoài (`TAB_SWITCH`)</strong>
                  <span>Ghi nhận cảnh báo khi thí sinh blur tab, thu nhỏ cửa sổ hoặc mở trình duyệt khác.</span>
                </div>
              </label>

              <label className="eg-sec-item">
                <input
                  type="checkbox"
                  checked={requireFullscreen}
                  onChange={(e) => setRequireFullscreen(e.target.checked)}
                />
                <div className="eg-sec-text">
                  <strong>Bắt buộc chế độ toàn màn hình (`FULLSCREEN_LOCK`)</strong>
                  <span>Yêu cầu bật Fullscreen trước khi bắt đầu bài thi và khóa thoát tự do.</span>
                </div>
              </label>

              <label className="eg-sec-item">
                <input
                  type="checkbox"
                  checked={preventCopyPaste}
                  onChange={(e) => setPreventCopyPaste(e.target.checked)}
                />
                <div className="eg-sec-text">
                  <strong>Chống sao chép và kiểm tra mã (`NO_COPY_PASTE`)</strong>
                  <span>Khóa chuột phải, vô hiệu hóa phím tắt Ctrl+C, Ctrl+V, F12 (Inspect DevTools).</span>
                </div>
              </label>
            </div>

            <div className="eg-sec-thresholds">
              <div className="eg-threshold-item">
                <label className="eg-form-label">
                  Ngưỡng sai số khuôn mặt (Euclidean Distance): <strong>{maxFaceDistance}</strong>
                </label>
                <div className="eg-slider-wrap">
                  <input
                    type="range"
                    min="0.40"
                    max="0.75"
                    step="0.05"
                    value={maxFaceDistance}
                    onChange={(e) => setMaxFaceDistance(e.target.value)}
                    className="eg-range-slider"
                  />
                  <span className="eg-range-hint">0.40 (Nghiêm ngặt) — 0.60 (Khuyên dùng) — 0.75 (Linh hoạt)</span>
                </div>
              </div>

              <div className="eg-threshold-item">
                <label className="eg-form-label">Số lần vi phạm tối đa trước khi khóa bài:</label>
                <select
                  className="eg-select"
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(e.target.value)}
                >
                  <option value={1}>1 lần (Khóa ngay khi vi phạm)</option>
                  <option value={2}>2 lần</option>
                  <option value={3}>3 lần (Chuẩn khảo thí)</option>
                  <option value={5}>5 lần (Linh hoạt)</option>
                  <option value={999}>Không giới hạn (Chỉ cảnh báo ghi log)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="eg-modal-actions">
            <button type="button" className="eg-btn-cancel" onClick={onClose} disabled={loading}>
              Hủy bỏ
            </button>
            <button type="submit" className="eg-btn-submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEditing ? 'Cập nhật phòng thi & Bảo mật' : '+ Khởi tạo phòng thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
