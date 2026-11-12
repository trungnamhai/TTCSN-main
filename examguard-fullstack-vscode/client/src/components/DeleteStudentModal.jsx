import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import './DeleteStudentModal.css';

export default function DeleteStudentModal({
  isOpen,
  onClose,
  token,
  student,
  onStudentDeleted
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !student) return null;

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/teacher/students/${student.id}`, {
        method: 'DELETE',
        token
      });

      // Dọn dẹp localStorage dự phòng nếu có
      try {
        const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
        delete extra[student.student_code];
        localStorage.setItem('sample_extra_students', JSON.stringify(extra));
        localStorage.removeItem(`sample_pwd_${student.student_code}`);
      } catch (storageErr) {
        console.warn('Lỗi localStorage:', storageErr);
      }

      if (onStudentDeleted) {
        onStudentDeleted(student.id);
      }
      onClose();
    } catch (err) {
      if (err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('HTML thay vì JSON')) {
        // Fallback offline
        try {
          const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
          delete extra[student.student_code];
          localStorage.setItem('sample_extra_students', JSON.stringify(extra));
          localStorage.removeItem(`sample_pwd_${student.student_code}`);
        } catch {}

        if (onStudentDeleted) {
          onStudentDeleted(student.id);
        }
        onClose();
        return;
      }
      setError(err.message || 'Không thể xóa tài khoản học sinh lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dsm-overlay" onClick={onClose}>
      <div
        className="dsm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dsm-title"
      >
        <div className="dsm-icon-wrap">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <h2 id="dsm-title" className="dsm-title">
          Xác nhận xóa tài khoản?
        </h2>

        <p className="dsm-desc">
          Bạn có chắc chắn muốn xóa tài khoản của sinh viên{' '}
          <strong>{student.full_name}</strong> (Mã SV:{' '}
          <code>{student.student_code}</code>)?
        </p>

        <p className="dsm-warning">
          ⚠️ Lưu ý: Hành động này sẽ xóa vĩnh viễn tài khoản và các dữ liệu lượt thi, lịch sử làm bài liên quan của sinh viên này.
        </p>

        {error && (
          <div className="dsm-alert dsm-alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="dsm-actions">
          <button
            type="button"
            className="dsm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="dsm-btn-delete"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
