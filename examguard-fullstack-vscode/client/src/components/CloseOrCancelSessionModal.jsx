import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import './CloseOrCancelSessionModal.css';

export default function CloseOrCancelSessionModal({
  isOpen,
  session,
  onClose,
  token,
  onStatusChanged,
  onSessionDeleted
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !session) return null;

  const isOpenStatus = session.status === 'OPEN';
  const isCancelled = session.status === 'CANCELLED';
  const isClosed = session.status === 'CLOSED' || session.status === 'COMPLETED';

  const handleUpdateStatus = async (newStatus) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiRequest(`/teacher/sessions/${session.id || session.session_id}/status`, {
        method: 'PATCH',
        token,
        body: { status: newStatus }
      });
      onStatusChanged(session.id || session.session_id, newStatus, res.session);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể cập nhật trạng thái ca thi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await apiRequest(`/teacher/sessions/${session.id || session.session_id}`, {
        method: 'DELETE',
        token
      });
      onSessionDeleted(session.id || session.session_id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể xóa ca thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-container eg-close-session-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div className="eg-session-alert-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className="eg-modal-title">Quản trị trạng thái Phòng thi / Ca thi</h3>
            <p className="eg-modal-subtitle">
              Đóng phòng thi, hủy bỏ hoặc điều chỉnh quyền truy cập của thí sinh.
            </p>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && <div className="eg-modal-alert-error" role="alert">{errorMsg}</div>}

        <div className="eg-close-session-body">
          <div className="eg-session-target-card">
            <div className="eg-target-row">
              <span className="eg-session-code-tag">{session.session_code}</span>
              <span className={`eg-status-tag ${
                isOpenStatus ? 'is-open' : isCancelled ? 'is-completed' : 'is-upcoming'
              }`}>
                {session.status_label || session.status}
              </span>
            </div>
            <strong className="eg-target-title">{session.title}</strong>
            <div className="eg-target-subtext">
              Phòng: {session.room || 'Phòng trực tuyến'} · Môn: {session.subject_name || 'Khảo thí'}
            </div>
          </div>

          <div className="eg-status-action-options">
            {isOpenStatus ? (
              <>
                <div className="eg-action-card">
                  <div className="eg-action-card-info">
                    <strong>Đóng phòng thi (`CLOSED`)</strong>
                    <p>Khóa quyền vào thi của các thí sinh mới. Thí sinh đang làm bài sẽ được yêu cầu nộp bài.</p>
                  </div>
                  <button
                    type="button"
                    className="eg-btn-warning-action"
                    onClick={() => handleUpdateStatus('CLOSED')}
                    disabled={loading}
                  >
                    Đóng phòng thi
                  </button>
                </div>

                <div className="eg-action-card">
                  <div className="eg-action-card-info">
                    <strong>Hủy bỏ ca thi (`CANCELLED`)</strong>
                    <p>Hủy ca thi này, vô hiệu hóa mã truy cập và lưu vết hủy bỏ vào nhật ký quản trị.</p>
                  </div>
                  <button
                    type="button"
                    className="eg-btn-danger-action"
                    onClick={() => handleUpdateStatus('CANCELLED')}
                    disabled={loading}
                  >
                    Hủy ca thi
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="eg-action-card">
                  <div className="eg-action-card-info">
                    <strong>Mở lại phòng thi (`OPEN`)</strong>
                    <p>Kích hoạt lại ca thi để thí sinh có thể tiếp tục đăng nhập và làm bài.</p>
                  </div>
                  <button
                    type="button"
                    className="eg-btn-success-action"
                    onClick={() => handleUpdateStatus('OPEN')}
                    disabled={loading}
                  >
                    Mở lại phòng thi
                  </button>
                </div>

                <div className="eg-action-card">
                  <div className="eg-action-card-info">
                    <strong>Xóa vĩnh viễn ca thi khỏi hệ thống</strong>
                    <p>Gỡ bỏ hoàn toàn bản ghi ca thi khỏi CSDL (chỉ nên áp dụng khi ca thi tạo nhầm).</p>
                  </div>
                  <button
                    type="button"
                    className="eg-btn-danger-action"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    Xóa vĩnh viễn
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="eg-modal-actions">
          <button type="button" className="eg-btn-cancel" onClick={onClose} disabled={loading}>
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}
