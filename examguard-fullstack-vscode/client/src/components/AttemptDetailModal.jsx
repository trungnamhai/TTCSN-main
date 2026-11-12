import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import './AttemptDetailModal.css';

export default function AttemptDetailModal({ isOpen, onClose, attemptId, token }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !attemptId) {
      setData(null);
      setError('');
      return;
    }

    async function fetchDetail() {
      setLoading(true);
      setError('');
      try {
        const res = await apiRequest(`/exam/attempts/${attemptId}`, { token });
        setData(res);
      } catch (err) {
        setError(err.message || 'Không thể tải chi tiết bài thi');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [isOpen, attemptId, token]);

  if (!isOpen) return null;

  const attempt = data?.attempt;
  const details = data?.details || [];
  const logs = data?.logs || [];
  const score = attempt?.total_score != null ? Number(attempt.total_score) : null;
  const isPassed = score != null && score >= 5.0;

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-card eg-modal-attempt-card" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div>
            <span className="eg-modal-eyebrow">CHI TIẾT KẾT QUẢ KHẢO THÍ</span>
            <h2 className="eg-modal-title">
              {attempt?.exam_title || `Lượt thi #${attemptId}`}
            </h2>
            <div className="eg-modal-subtext">
              Mã ca thi: <strong>{attempt?.session_code}</strong> · Môn học: <strong>{attempt?.subject_name}</strong>
            </div>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="eg-modal-body">
          {loading && <div className="eg-modal-loading">Đang tải dữ liệu bài thi...</div>}
          {error && <div className="eg-modal-alert-error">{error}</div>}

          {attempt && !loading && (
            <>
              {/* Thẻ tóm tắt kết quả */}
              <div className="eg-attempt-summary-strip">
                <div className="eg-attempt-sum-item">
                  <span className="eg-sum-label">Điểm số</span>
                  <strong className={`eg-sum-score ${isPassed ? 'is-pass' : 'is-fail'}`}>
                    {score != null ? `${score}đ` : 'Chưa chấm'}
                  </strong>
                </div>
                <div className="eg-attempt-sum-item">
                  <span className="eg-sum-label">Xếp loại</span>
                  <span className={`eg-mini-badge ${isPassed ? 'is-easy' : 'is-hard'}`}>
                    {isPassed ? '✓ ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
                  </span>
                </div>
                <div className="eg-attempt-sum-item">
                  <span className="eg-sum-label">Số câu đúng</span>
                  <strong>{attempt.correct_count ?? details.filter(d => d.is_correct).length} / {attempt.total_questions || details.length}</strong>
                </div>
                <div className="eg-attempt-sum-item">
                  <span className="eg-sum-label">Cảnh báo giám thị</span>
                  <strong style={{ color: logs.length > 0 ? '#b42318' : '#0b6b3a' }}>
                    {logs.length} lần vi phạm
                  </strong>
                </div>
                <div className="eg-attempt-sum-item">
                  <span className="eg-sum-label">Thời gian nộp</span>
                  <span>{attempt.submit_time ? new Date(attempt.submit_time).toLocaleString('vi-VN') : '—'}</span>
                </div>
              </div>

              {/* Nhật ký giám thị nếu có vi phạm */}
              {logs.length > 0 && (
                <div className="eg-attempt-violations-box">
                  <h3 className="eg-attempt-box-title">Nhật ký giám sát AI ghi nhận:</h3>
                  <div className="eg-attempt-logs-list">
                    {logs.map((log) => (
                      <div key={log.id} className="eg-attempt-log-item">
                        <span className="eg-log-time">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '—'}</span>
                        <span className="eg-log-type">[{log.violation_type}]</span>
                        <span className="eg-log-msg">
                          {log.violation_type === 'MULTIPLE_FACES' ? 'Phát hiện nhiều người trong khung hình' :
                           log.violation_type === 'TAB_SWITCH' ? 'Chuyển tab hoặc rời cửa sổ thi' :
                           log.violation_type === 'NO_FACE' ? 'Không phát hiện khuôn mặt' : 'Vi phạm quy chế'}
                        </span>
                        {log.euclidean_distance && (
                          <span className="eg-log-dist">Euclidean: {log.euclidean_distance}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách câu hỏi và câu trả lời */}
              <div className="eg-attempt-questions-section">
                <h3 className="eg-attempt-box-title">Danh sách câu hỏi & Phương án đã chọn:</h3>
                <div className="eg-attempt-questions-list">
                  {details.map((q, idx) => {
                    const ok = q.is_correct;
                    return (
                      <div key={q.question_id || idx} className={`eg-attempt-q-card ${ok ? 'is-correct' : 'is-wrong'}`}>
                        <div className="eg-attempt-q-head">
                          <span className="eg-q-badge">Câu {idx + 1} ({q.question_code || `Q${idx + 1}`})</span>
                          <span className={`eg-status-tag ${ok ? 'is-open' : 'is-closed'}`}>
                            {ok ? '✓ Trả lời đúng' : '✕ Chưa đúng'}
                          </span>
                        </div>
                        <p className="eg-attempt-q-text">{q.content}</p>
                        <div className="eg-attempt-ans-block">
                          <div className="eg-ans-row">
                            <span className="eg-ans-lbl">Phương án bạn chọn:</span>
                            <span className={`eg-ans-val ${ok ? 'ok-val' : 'wrong-val'}`}>
                              {q.selected_text || 'Chưa trả lời'}
                            </span>
                          </div>
                          {!ok && q.correct_text && (
                            <div className="eg-ans-row">
                              <span className="eg-ans-lbl">Đáp án chính xác:</span>
                              <span className="eg-ans-val correct-val">{q.correct_text}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="eg-modal-footer">
          <button type="button" className="eg-primary-btn" onClick={onClose}>
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
