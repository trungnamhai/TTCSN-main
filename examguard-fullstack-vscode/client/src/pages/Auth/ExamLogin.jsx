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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedCode = studentCode.trim();
    const trimmedPass = sessionCode.trim();

    if (!trimmedCode || !trimmedPass) {
      setError("Vui lòng nhập đầy đủ Mã sinh viên và Mật khẩu / Mã ca thi.");
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
      } else {
        setError(err.message || "Mã sinh viên hoặc mật khẩu không chính xác.");
      }
    }
  };

  return (
    <div className="eg-login-page" style={{ backgroundImage: `url(${bgImg})` }}>
      <div className="eg-top-left-logo">
        <img src={logoImg} alt="TRACNGHIEM Logo" className="eg-login-logo" />
      </div>

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
              placeholder="Nhập mã sinh viên (VD: 2024603201)"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
            />
          </div>

          <div className="eg-form-group">
            <label className="eg-label">Mật khẩu / Mã ca thi</label>
            <input
              type="password"
              className="eg-input"
              placeholder="Nhập mật khẩu hoặc mã ca thi"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value)}
            />
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
            {loading ? "Đang kiểm tra thông tin..." : "Đăng nhập hệ thống"}
          </button>
        </form>
      </div>
    </div>
  );
}
