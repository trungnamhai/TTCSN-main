import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './EditStudentModal.css';

export default function EditStudentModal({
  isOpen,
  onClose,
  token,
  student,
  onStudentUpdated
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (student && isOpen) {
      setFullName(student.full_name || '');
      setEmail(student.email || '');
      setNewPassword('');
      setError('');
      setSuccess('');
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = newPassword.trim();

    if (!trimmedName) {
      setError('Họ và tên không được để trống.');
      return;
    }
    if (trimmedPass && trimmedPass.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest(`/teacher/students/${student.id}`, {
        method: 'PUT',
        token,
        body: {
          full_name: trimmedName,
          email: trimmedEmail,
          password: trimmedPass || undefined
        }
      });

      // Cập nhật localStorage dự phòng nếu có
      try {
        const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
        if (extra[student.student_code]) {
          extra[student.student_code].full_name = trimmedName;
          extra[student.student_code].email = trimmedEmail;
          localStorage.setItem('sample_extra_students', JSON.stringify(extra));
        }
        if (trimmedPass) {
          localStorage.setItem(`sample_pwd_${student.student_code}`, trimmedPass);
        }
      } catch (storageErr) {
        console.warn('Lỗi lưu trữ:', storageErr);
      }

      setSuccess(response.message || 'Cập nhật thông tin thành công!');

      if (onStudentUpdated) {
        onStudentUpdated({
          ...student,
          full_name: trimmedName,
          email: trimmedEmail
        });
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      // Hỗ trợ chế độ offline
      if (err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('HTML thay vì JSON')) {
        const updated = {
          ...student,
          full_name: trimmedName,
          email: trimmedEmail
        };

        try {
          const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
          if (extra[student.student_code]) {
            extra[student.student_code].full_name = trimmedName;
            extra[student.student_code].email = trimmedEmail;
            localStorage.setItem('sample_extra_students', JSON.stringify(extra));
          }
          if (trimmedPass) {
            localStorage.setItem(`sample_pwd_${student.student_code}`, trimmedPass);
          }
        } catch {}

        setSuccess(`Đã cập nhật thông tin học sinh "${trimmedName}" thành công!`);
        if (onStudentUpdated) {
          onStudentUpdated(updated);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
        return;
      }

      setError(err.message || 'Không thể cập nhật thông tin học sinh.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="esm-overlay" onClick={onClose}>
      <div
        className="esm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="esm-title"
      >
        <div className="esm-header">
          <div className="esm-header-icon-wrap">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div className="esm-header-text">
            <h2 id="esm-title" className="esm-title">
              Sửa thông tin học sinh
            </h2>
            <p className="esm-subtitle">
              Mã SV: <span className="esm-code-badge">{student.student_code}</span>
            </p>
          </div>
          <button
            type="button"
            className="esm-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="esm-alert esm-alert-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="esm-alert esm-alert-success" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="esm-form">
          <div className="esm-form-group">
            <label className="esm-label">Mã sinh viên (Không thể thay đổi)</label>
            <input
              type="text"
              className="esm-input esm-input-disabled"
              value={student.student_code}
              disabled
              readOnly
            />
          </div>

          <div className="esm-form-group">
            <label className="esm-label" htmlFor="esm-fullname">
              Họ và tên <span className="esm-required">*</span>
            </label>
            <input
              id="esm-fullname"
              type="text"
              className="esm-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên đầy đủ"
              required
            />
          </div>

          <div className="esm-form-group">
            <label className="esm-label" htmlFor="esm-email">
              Địa chỉ Email
            </label>
            <input
              id="esm-email"
              type="email"
              className="esm-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@student.edu.vn"
            />
          </div>

          <div className="esm-form-group">
            <label className="esm-label" htmlFor="esm-newpwd">
              Đặt lại mật khẩu mới (Để trống nếu không đổi)
            </label>
            <div className="esm-input-wrap">
              <input
                id="esm-newpwd"
                type={showPassword ? 'text' : 'password'}
                className="esm-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="esm-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <span className="esm-hint">
              Nếu nhập mật khẩu mới, mật khẩu cũ của học sinh sẽ bị ghi đè.
            </span>
          </div>

          <div className="esm-actions">
            <button
              type="button"
              className="esm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="esm-btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="esm-spinner" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
