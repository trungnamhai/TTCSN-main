import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './AddStudentModal.css';

export default function AddStudentModal({
  isOpen,
  onClose,
  token,
  onStudentCreated
}) {
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('123456789');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStudentCode('');
      setFullName('');
      setEmail('');
      setPassword('123456789');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedCode = studentCode.trim();
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim() || '123456789';

    if (!trimmedCode) {
      setError('Vui lòng nhập Mã sinh viên.');
      return;
    }
    if (!trimmedName) {
      setError('Vui lòng nhập Họ và tên sinh viên.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/teacher/students', {
        method: 'POST',
        token,
        body: {
          student_code: trimmedCode,
          full_name: trimmedName,
          email: trimmedEmail,
          password: trimmedPass
        }
      });

      // Lưu trữ dự phòng cho tài khoản mẫu để sinh viên mới đăng nhập được ngay
      try {
        const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
        extra[trimmedCode] = {
          id: response.student?.id || Date.now(),
          full_name: trimmedName,
          email: trimmedEmail || `${trimmedCode.toLowerCase()}@student.edu.vn`
        };
        localStorage.setItem('sample_extra_students', JSON.stringify(extra));
        localStorage.setItem(`sample_pwd_${trimmedCode}`, trimmedPass);
      } catch (storageErr) {
        console.warn('Không thể ghi localStorage:', storageErr);
      }

      setSuccess(response.message || `Đã thêm học sinh ${trimmedName} thành công!`);

      if (onStudentCreated && response.student) {
        onStudentCreated(response.student);
      }

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      // Hỗ trợ chế độ ngoại tuyến / khi server ngắt kết nối
      if (err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('HTML thay vì JSON')) {
        const fallbackStudent = {
          id: Date.now(),
          student_code: trimmedCode,
          username: trimmedCode,
          full_name: trimmedName,
          email: trimmedEmail || `${trimmedCode.toLowerCase()}@student.edu.vn`,
          is_online: false,
          exam_status: 'Chưa thi',
          start_time: null,
          total_score: null,
          session_code: 'EXAM88'
        };

        const extra = JSON.parse(localStorage.getItem('sample_extra_students') || '{}');
        extra[trimmedCode] = {
          id: fallbackStudent.id,
          full_name: trimmedName,
          email: fallbackStudent.email
        };
        localStorage.setItem('sample_extra_students', JSON.stringify(extra));
        localStorage.setItem(`sample_pwd_${trimmedCode}`, trimmedPass);

        setSuccess(`Đã thêm học sinh ${trimmedName} (${trimmedCode}) thành công!`);
        if (onStudentCreated) {
          onStudentCreated(fallbackStudent);
        }
        setTimeout(() => {
          onClose();
        }, 1600);
        return;
      }

      setError(err.message || 'Không thể tạo tài khoản học sinh lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="asm-overlay" onClick={onClose}>
      <div
        className="asm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asm-title"
      >
        {/* Header modal */}
        <div className="asm-header">
          <div className="asm-header-icon-wrap">
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div className="asm-header-text">
            <h2 id="asm-title" className="asm-title">
              Thêm tài khoản học sinh
            </h2>
            <p className="asm-subtitle">
              Cấp tài khoản mới để học sinh có thể đăng nhập vào phòng thi
            </p>
          </div>
          <button
            type="button"
            className="asm-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {error && (
          <div className="asm-alert asm-alert-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="asm-alert asm-alert-success" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Form thêm tài khoản */}
        <form onSubmit={handleSubmit} className="asm-form">
          <div className="asm-form-row">
            {/* Mã sinh viên */}
            <div className="asm-form-group">
              <label className="asm-label" htmlFor="asm-code">
                Mã sinh viên <span className="asm-required">*</span>
              </label>
              <input
                id="asm-code"
                type="text"
                className="asm-input"
                placeholder="VD: 2024605001 hoặc SV2026002"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            {/* Họ và tên */}
            <div className="asm-form-group">
              <label className="asm-label" htmlFor="asm-name">
                Họ và tên <span className="asm-required">*</span>
              </label>
              <input
                id="asm-name"
                type="text"
                className="asm-input"
                placeholder="VD: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="asm-form-group">
            <label className="asm-label" htmlFor="asm-email">
              Địa chỉ Email
            </label>
            <input
              id="asm-email"
              type="email"
              className="asm-input"
              placeholder={studentCode.trim() ? `${studentCode.trim().toLowerCase()}@student.edu.vn (mặc định)` : "Để trống sẽ tự tạo theo mã sinh viên"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Mật khẩu khởi tạo */}
          <div className="asm-form-group">
            <label className="asm-label" htmlFor="asm-pwd">
              Mật khẩu ban đầu
            </label>
            <div className="asm-input-wrap">
              <input
                id="asm-pwd"
                type={showPassword ? 'text' : 'password'}
                className="asm-input"
                placeholder="Mặc định: 123456789"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="asm-eye-btn"
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
            <span className="asm-hint">
              Học sinh có thể đổi lại mật khẩu này sau khi đăng nhập vào hệ thống.
            </span>
          </div>

          {/* Action buttons */}
          <div className="asm-actions">
            <button
              type="button"
              className="asm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="asm-btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="asm-spinner" />
                  Đang khởi tạo...
                </>
              ) : (
                '+ Thêm học sinh'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
