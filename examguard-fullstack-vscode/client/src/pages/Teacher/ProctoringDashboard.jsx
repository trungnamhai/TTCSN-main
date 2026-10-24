import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { socket } from '../../services/socket';
import './ProctoringDashboard.css';

export default function ProctoringDashboard() {
  const [dashboard, setDashboard] = useState({
    logs: [],
    attempts: [],
    questions: [],
    session: {}
  });
  const [newQuestionContent, setNewQuestionContent] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const fetchOverview = async () => {
    try {
      const data = await apiRequest('/teacher/dashboard');
      setDashboard(data);
    } catch (err) {
      // ignore
    }
  };

  useEffect(() => {
    fetchOverview();

    socket.on('proctoring:violation_alert', (newLog) => {
      setDashboard((prev) => ({
        ...prev,
        logs: [newLog, ...prev.logs]
      }));
    });

    return () => {
      socket.off('proctoring:violation_alert');
    };
  }, []);

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionContent.trim()) return;
    await apiRequest('/teacher/questions', {
      method: 'POST',
      body: {
        content: newQuestionContent,
        difficulty_level: 'MEDIUM',
        answers: [
          { answer_text: 'Phương án đúng (mẫu)', is_correct: true },
          { answer_text: 'Phương án gây nhiễu 1', is_correct: false },
          { answer_text: 'Phương án gây nhiễu 2', is_correct: false },
          { answer_text: 'Phương án gây nhiễu 3', is_correct: false }
        ]
      }
    });
    setNewQuestionContent('');
    setStatusMsg('Đã lưu câu hỏi mới vào ngân hàng đề!');
    fetchOverview();
  };

  return (
    <div className="eg-dashboard">
      <div className="eg-dashboard-header">
        <div>
          <h1 className="eg-dashboard-title">
            Proctoring Dashboard — Giám thị coi thi AI
          </h1>
          <p className="eg-dashboard-description">
            Ca thi đang mở: <strong>{dashboard.session?.session_code || 'EXAM88'}</strong> · Nhận
            cảnh báo vi phạm thời gian thực qua Socket.IO
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="eg-dashboard-refresh"
        >
          ↻ Làm mới dữ liệu
        </button>
      </div>

      <div className="eg-dashboard-grid">
        {/* Nhật ký vi phạm thời gian thực (bảng proctoring_logs) */}
        <div className="eg-panel">
          <h2 className="eg-dashboard-section-title eg-dashboard-log-title">
            Nhật ký vi phạm AI (`proctoring_logs`)
          </h2>
          {dashboard.logs.length === 0 ? (
            <p className="eg-dashboard-empty">Chưa có vi phạm nào được ghi nhận.</p>
          ) : (
            <div className="eg-dashboard-log-list">
              {dashboard.logs.map((log) => (
                <div
                  key={log.id}
                  className="eg-dashboard-log"
                >
                  <div>
                    <div className="eg-dashboard-log-student">
                      [{log.violation_type}] — {log.student_code || 'SV2026001'} ({log.full_name || 'Minh Nhật'})
                    </div>
                    <div className="eg-dashboard-log-evidence">
                      Euclidean Distance:{' '}
                      <strong>
                        {log.euclidean_distance !== null && log.euclidean_distance !== undefined
                          ? log.euclidean_distance
                          : 'N/A'}
                      </strong>{' '}
                      · Bằng chứng: <code>{log.evidence_image_path}</code>
                    </div>
                  </div>
                  <span className="eg-dashboard-log-time">
                    {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quản lý thí sinh & thêm nhanh câu hỏi */}
        <div className="eg-dashboard-sidebar">
          <div className="eg-panel">
            <h2 className="eg-dashboard-section-title">
              Thí sinh trong ca thi (`exam_attempts`)
            </h2>
            {dashboard.attempts.map((att) => (
              <div
                key={att.id}
                className="eg-dashboard-attempt"
              >
                <div>
                  <strong>{att.student_code || 'SV2026001'}</strong> — {att.full_name || 'Minh Nhật'}
                </div>
                <span className={`eg-dashboard-attempt-status ${
                  att.status === 'SUBMITTED' ? 'is-submitted' : ''
                }`}>
                  {att.status} {att.total_score !== null ? `(${att.total_score}đ)` : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="eg-panel">
            <h2 className="eg-dashboard-section-title">
              Thêm nhanh câu hỏi vào ngân hàng đề (`questions`)
            </h2>
            {statusMsg && <div className="eg-alert-box eg-alert-success">{statusMsg}</div>}
            <form onSubmit={handleAddQuestion}>
              <input
                type="text"
                className="eg-input eg-dashboard-question-input"
                placeholder="Nhập nội dung câu hỏi mới..."
                value={newQuestionContent}
                onChange={(e) => setNewQuestionContent(e.target.value)}
              />
              <button type="submit" className="eg-primary-btn">
                + Lưu câu hỏi vào hệ thống
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
