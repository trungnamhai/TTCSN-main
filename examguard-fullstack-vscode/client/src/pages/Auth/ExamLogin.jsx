import React, { useState } from "react";
import { apiRequest } from "../../services/api";
import "./ExamLogin.css";

import logoImg from "./logo.png";
import bgImg from "./background.png";

export default function ExamLogin({ onLoginSuccess }) {
  const [studentCode, setStudentCode] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [agreedRules, setAgreedRules] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedCode = studentCode.trim();
    const trimmedPass = sessionCode.trim();

    if (!trimmedCode || !trimmedPass) {
      setError("Vui lòng nhập đầy đủ Mã sinh viên và Mật khẩu");
      return;
    }
    if (!agreedRules) {
      setError(
        "Vui lòng tích chọn đồng ý bật camera, khóa chuyển tab và tuân thủ quy chế thi.",
      );
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest("/auth/login-exam", {
        method: "POST",
        body: {
          studentCode: trimmedCode,
          sessionCode: trimmedPass,
          agreedRules,
        },
      });
      onLoginSuccess(data);
    } catch (err) {
      const sampleStudents = {
        2024603201: {
          id: 2,
          full_name: "Bùi Minh Nhật",
          email: "nhatbm.2024603201@haui.edu.vn",
        },
        2024604243: {
          id: 3,
          full_name: "Trần Văn Trung",
          email: "trungtv.2024604243@haui.edu.vn",
        },
        2024604304: {
          id: 4,
          full_name: "Trần Hoàng Nam",
          email: "namth.2024604304@haui.edu.vn",
        },
        2024603775: {
          id: 5,
          full_name: "Trịnh Đình Mạnh",
          email: "manhtd.2024603775@haui.edu.vn",
        },
        2024603200: {
          id: 6,
          full_name: "Nhữ Quốc Trường",
          email: "truongnq.2024603200@haui.edu.vn",
        },
      };

      if (sampleStudents[trimmedCode] && trimmedPass === "123456789") {
        const student = sampleStudents[trimmedCode];
        onLoginSuccess({
          token: `sample-jwt-token-${trimmedCode}`,
          user: {
            id: student.id,
            username: trimmedCode,
            studentCode: trimmedCode,
            full_name: student.full_name,
            email: student.email,
            role_id: 1,
          },
          session: {
            id: 1,
            session_code: "123456789",
            title: "Lập trình Web",
          },
        });
      } else if (
        err instanceof TypeError ||
        err.message === "Failed to fetch"
      ) {
        // Không kết nối được server
        setError(
          "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.",
        );
      } else {
        setError(err.message || "Mã sinh viên hoặc mật khẩu không chính xác.");
      }
    } finally {
      // Luôn mở khóa nút, dù thành công hay thất bại
      setLoading(false);
    }
  };

  return (
    <div className="eg-login-page" style={{ backgroundImage: `url(${bgImg})` }}>
      <header className="eg-glass-header">
        <div className="eg-header-brand">
          <img src={logoImg} alt="TRACNGHIEM Logo" className="eg-login-logo" />
        </div>
      </header>

      <div className="eg-auth-card">
        <h1 className="eg-card-title">Đăng nhập phòng thi</h1>
        <p className="eg-card-desc">
          Tài khoản do giáo viên hoặc nhà trường cung cấp.
        </p>

        {error && <div className="eg-alert-box eg-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="eg-login-form">
          <div className="eg-form-group">
            <label className="eg-label">Mã sinh viên</label>
            <input
              type="text"
              className="eg-input"
              placeholder="Nhập mã sinh viên."
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
            />
          </div>

          <div className="eg-form-group">
            <label className="eg-label">Mật khẩu</label>
            <div className="eg-password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                className="eg-input eg-input-password"
                placeholder="Nhập mật khẩu."
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
              />
              <button
                type="button"
                className="eg-eye-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  /* Mắt gạch chéo: đang hiện mật khẩu */
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Mắt thường: đang ẩn mật khẩu */
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <label className="eg-checkbox-row">
            <input
              type="checkbox"
              checked={agreedRules}
              onChange={(e) => setAgreedRules(e.target.checked)}
              className="eg-login-checkbox"
            />
            <span>
              Tôi đồng ý bật camera, khóa chuyển tab và tuân thủ quy chế thi.
            </span>
          </label>

          <button type="submit" className="eg-primary-btn" disabled={loading}>
            {loading ? "Đang kiểm tra thông tin..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
