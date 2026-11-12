import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import './DeleteSubjectModal.css';

export default function DeleteSubjectModal({ isOpen, subject, onClose, token, onSubjectDeleted }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !subject) return null;

  const handleDelete = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await apiRequest(`/teacher/subjects/${subject.id}`, {
        method: 'DELETE',
        token
      });
      onSubjectDeleted(subject.id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể xóa môn học / chủ đề này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-container eg-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header eg-delete-header">
          <div className="eg-delete-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="eg-modal-title">Xác nhận xóa môn học / chủ đề</h3>
            <p className="eg-modal-subtitle">Thao tác này sẽ gỡ bỏ môn học khỏi danh mục hệ thống.</p>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose}>✕</button>
        </div>

        {errorMsg && <div className="eg-modal-alert-error" role="alert">{errorMsg}</div>}

        <div className="eg-delete-body">
          <p>
            Bạn có chắc chắn muốn xóa môn học <strong>{subject.subject_name}</strong> (Mã: <code>{subject.subject_code}</code>)?
          </p>
          <div className="eg-delete-warning-box">
            Lưu ý: Các câu hỏi và bộ đề thi thuộc môn học này có thể bị ảnh hưởng nếu đã được liên kết trong ca thi đang diễn ra.
          </div>
        </div>

        <div className="eg-modal-actions">
          <button type="button" className="eg-btn-cancel" onClick={onClose} disabled={loading}>
            Hủy bỏ
          </button>
          <button type="button" className="eg-btn-confirm-delete" onClick={handleDelete} disabled={loading}>
            {loading ? 'Đang xóa...' : 'Xóa môn học'}
          </button>
        </div>
      </div>
    </div>
  );
}
