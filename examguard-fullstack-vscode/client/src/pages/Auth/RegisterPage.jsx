import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import './ExamLogin.css';
import logoImg from './logo.png';
import bgImg from './background.png';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !studentCode.trim() || !password) {
      setError('Vui lòng điền đầy đủ Họ và tên, Mã sinh viên và Mật khẩu.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: {
          full_name: fullName.trim(),
          username: studentCode.trim(),
          email: email.trim(),
          password,
          confirmPassword
        }
      });

      setSuccess(data.message || 'Đăng ký tài khoản thành công! Đang chuyển đến trang đăng nhập...');
      setTimeout(() => {
        navigate('/student/login');
      }, 1500);
    } catch (err) {
      setError(err.message || 'Không thể đăng ký tài khoản. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-login-page" style={{ backgroundImage: `url(${bgImg})` }}>
      <header className="eg-glass-header">
        <div className="eg-header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={logoImg} alt="ExamGuard Logo" className="eg-login-logo" />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="eg-header-btn"
            onClick={() => navigate('/')}
          >
            Trang chủ
          </button>
          <button
            type="button"
            className="eg-header-btn"
            onClick={() => navigate('/student/login')}
          >
            Đăng nhập Học sinh
          </button>
          <button
            type="button"
            className="eg-header-btn"
            onClick={() => navigate('/teacher/login')}
          >
            Đăng nhập Giảng viên
          </button>
        </div>
      </header>

      <main className="eg-auth-card" style={{ maxWidth: '520px', marginTop: '20px' }}>
        <h1 className="eg-card-title">Đăng ký tài khoản Thí sinh</h1>
        <p className="eg-card-desc">
          Tạo tài khoản để tham gia các ca thi trắc nghiệm trực tuyến
        </p>

        {error && <div className="eg-alert-box eg-alert-error" role="alert">{error}</div>}
        {success && (
          <div className="eg-alert-box" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }} role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="eg-login-form">
          <div className="eg-form-group">
            <label className="eg-label" htmlFor="reg-fullname">Họ và tên thí sinh</label>
            <input
              id="reg-fullname"
              type="text"
              className="eg-input"
              placeholder="VD: Nguyễn Văn An"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="eg-form-group">
              <label className="eg-label" htmlFor="reg-code">Mã sinh viên</label>
              <input
                id="reg-code"
                type="text"
                className="eg-input"
                placeholder="VD: 2024601234"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                required
              />
            </div>
            <div className="eg-form-group">
              <label className="eg-label" htmlFor="reg-email">Email (tùy chọn)</label>
              <input
                id="reg-email"
                type="email"
                className="eg-input"
                placeholder="sv@haui.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="eg-form-group">
              <label className="eg-label" htmlFor="reg-pwd">Mật khẩu</label>
              <div className="eg-password-wrap">
                <input
                  id="reg-pwd"
                  type={showPassword ? 'text' : 'password'}
                  className="eg-input eg-input-password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="eg-form-group">
              <label className="eg-label" htmlFor="reg-confirm">Xác nhận mật khẩu</label>
              <div className="eg-password-wrap">
                <input
                  id="reg-confirm"
                  type={showPassword ? 'text' : 'password'}
                  className="eg-input eg-input-password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
            <input
              type="checkbox"
              id="show-pw-check"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="show-pw-check" style={{ cursor: 'pointer' }}>Hiển thị mật khẩu</label>
          </div>

          <button type="submit" className="eg-primary-btn" disabled={loading} style={{ marginTop: '6px' }}>
            {loading ? 'Đang đăng ký tài khoản...' : 'Hoàn tất đăng ký tài khoản'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
            Đã có tài khoản?{' '}
            <button
              type="button"
              onClick={() => navigate('/student/login')}
              style={{ background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Đăng nhập ngay
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
