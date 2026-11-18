import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
import "./LandingPage.css";
import logoImg from "../Auth/logo.png";
import bgImg from "./landing_background.jpg";

export default function LandingPage({
  authData,
  teacherData,
  onStudentLogin,
  onTeacherLogin,
  onStudentLogout,
  onTeacherLogout,
  onNavigateTo,
}) {
  // Trạng thái mở khung đăng nhập: false (mở rộng giới thiệu), true (co sang trái, mở ô đăng nhập bên phải)
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Tabs: 'student_login' | 'teacher_login' | 'change_password'
  const [activeAuthTab, setActiveAuthTab] = useState("student_login");

  // Menu đóng mở trên mobile (trượt xuống dạng list)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavScroll = (e, sectionId) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleOpenAuth = (tab = "student_login") => {
    clearMessages();
    setIsMobileMenuOpen(false);
    setActiveAuthTab(tab);
    setIsAuthOpen(true);
    const heroEl = document.getElementById("hero-section");
    if (heroEl) {
      heroEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCloseAuth = () => {
    clearMessages();
    setIsAuthOpen(false);
  };

  // Đóng khung đăng nhập & menu mobile bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsAuthOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tự động đóng mobile menu khi resize lên desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Đảm bảo màu nền toàn trang luôn đồng bộ tối với ảnh nền, tránh hiện tượng vệt trắng trên iOS Safari
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0b1523";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Form states - Student Login
  const [studentCode, setStudentCode] = useState("");
  const [studentPassword, setStudentPassword] = useState("");

  // Form states - Teacher Login
  const [teacherUsername, setTeacherUsername] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  // Form states - Change Password
  const [cpUsername, setCpUsername] = useState("");
  const [cpCurrentPassword, setCpCurrentPassword] = useState("");
  const [cpNewPassword, setCpNewPassword] = useState("");
  const [cpConfirmPassword, setCpConfirmPassword] = useState("");

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const clearMessages = () => {
    setErrorMsg("");
    setSuccessMsg("");
  };

  const handleTabChange = (tab) => {
    clearMessages();
    setActiveAuthTab(tab);
  };

  // 1. Đăng nhập Học sinh
  const handleStudentLoginSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!studentCode.trim() || !studentPassword) {
      setErrorMsg("Vui lòng nhập đầy đủ Mã sinh viên và Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest("/auth/login-exam", {
        method: "POST",
        body: {
          studentCode: studentCode.trim(),
          sessionCode: studentPassword,
          password: studentPassword,
        },
      });

      if (onStudentLogin) {
        onStudentLogin(data);
      }
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

      const sCode = studentCode.trim();
      const sPass = studentPassword;
      const savedPass =
        localStorage.getItem(`sample_pwd_${sCode}`) || "123456789";

      if (
        sampleStudents[sCode] &&
        (sPass === savedPass || sPass === "123456789")
      ) {
        const student = sampleStudents[sCode];
        if (onStudentLogin) {
          onStudentLogin({
            token: `sample-jwt-token-${sCode}`,
            student: {
              id: student.id,
              username: sCode,
              full_name: student.full_name,
              email: student.email,
              role_name: "STUDENT",
            },
            session: {
              session_id: 1,
              session_code: "EXAM88",
              title: "Bài thi trắc nghiệm Giữa kỳ",
              subject_name: "An toàn và Bảo mật hệ thống thông tin",
              duration_minutes: 45,
            },
          });
        }
        return;
      }

      setErrorMsg(err.message || "Mã sinh viên hoặc mật khẩu không chính xác.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Đăng nhập Giảng viên
  const handleTeacherLoginSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!teacherUsername.trim() || !teacherPassword) {
      setErrorMsg("Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest("/auth/login-teacher", {
        method: "POST",
        body: {
          username: teacherUsername.trim(),
          password: teacherPassword,
        },
      });

      if (onTeacherLogin) {
        onTeacherLogin(data);
      }
    } catch (err) {
      const trimmedUser = teacherUsername.trim();
      const uLower = trimmedUser.toLowerCase();
      if (
        (uLower === "thsphamtheanh" ||
          uLower === "gv001" ||
          uLower === "anhpt") &&
        teacherPassword === "123456789"
      ) {
        if (onTeacherLogin) {
          onTeacherLogin({
            token: `sample-jwt-token-${trimmedUser}`,
            teacher: {
              id: 1,
              username: trimmedUser,
              full_name:
                uLower === "thsphamtheanh" || uLower === "anhpt"
                  ? "ThS. Phạm Thế Anh"
                  : "TS. Nguyễn Văn Giám Thị",
              email: `${uLower}@examguard.edu.vn`,
              role_name: "TEACHER",
            },
          });
        }
        return;
      }
      setErrorMsg(
        err.message ||
          "Đăng nhập giảng viên không thành công. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 3. Đổi mật khẩu
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!cpUsername.trim() || !cpCurrentPassword || !cpNewPassword) {
      setErrorMsg("Vui lòng điền đầy đủ thông tin mật khẩu.");
      return;
    }

    if (cpNewPassword.length < 6) {
      setErrorMsg("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }

    if (cpNewPassword !== cpConfirmPassword) {
      setErrorMsg("Xác nhận mật khẩu không trùng khớp.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest("/auth/public-change-password", {
        method: "POST",
        body: {
          username: cpUsername.trim(),
          currentPassword: cpCurrentPassword,
          newPassword: cpNewPassword,
          confirmPassword: cpConfirmPassword,
        },
      });

      localStorage.setItem(`sample_pwd_${cpUsername.trim()}`, cpNewPassword);
      setSuccessMsg(data.message || "Đổi mật khẩu thành công!");
      setCpCurrentPassword("");
      setCpNewPassword("");
      setCpConfirmPassword("");
    } catch (err) {
      setErrorMsg(
        err.message ||
          "Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-landing-root">
      {/* Layer ảnh nền cố định toàn màn hình (GPU-accelerated), loại bỏ triệt để lỗi cắt nền / vệt trắng trên iOS Safari */}
      <div
        className="eg-landing-bg-layer"
        style={{ backgroundImage: `url(${bgImg})` }}
        aria-hidden="true"
      />
      <div className="eg-landing-backdrop-overlay">
        {/* ===== 1. THANH ĐIỀU HƯỚNG TRÊN CÙNG (1 HÀNG DUY NHẤT) ===== */}
        <header className="eg-landing-header">
          <div className="eg-landing-container eg-header-inner">
            <div className="eg-brand-group">
              <div className="eg-logo-badge">
                <img
                  src={logoImg}
                  alt="ExamGuard Logo"
                  className="eg-brand-logo"
                />
              </div>
              <div className="eg-brand-meta">
                <span className="eg-brand-title">ExamGuard</span>
                <span className="eg-brand-subtitle">
                  Khảo thí trực tuyến · HaUI
                </span>
              </div>
            </div>

            <nav className="eg-header-nav" aria-label="Menu chính">
              <a
                href="#about"
                className="eg-nav-link"
                onClick={(e) => handleNavScroll(e, "about")}
              >
                Giới thiệu
              </a>
              <a
                href="#algorithms"
                className="eg-nav-link"
                onClick={(e) => handleNavScroll(e, "algorithms")}
              >
                Thuật toán
              </a>
              <a
                href="#workflow"
                className="eg-nav-link"
                onClick={(e) => handleNavScroll(e, "workflow")}
              >
                Quy trình
              </a>
              <a
                href="#team"
                className="eg-nav-link"
                onClick={(e) => handleNavScroll(e, "team")}
              >
                Nhóm tác giả
              </a>
            </nav>

            <div className="eg-header-actions">
              {authData ? (
                <div className="eg-logged-badge">
                  <span>
                    Học sinh:{" "}
                    <strong>
                      {authData.student?.full_name ||
                        authData.student?.username}
                    </strong>
                  </span>
                  <button
                    type="button"
                    className="eg-btn-header-cta"
                    onClick={() => onNavigateTo?.("/student/dashboard")}
                  >
                    Vào thi →
                  </button>
                  <button
                    type="button"
                    className="eg-btn-link"
                    onClick={onStudentLogout}
                  >
                    Thoát
                  </button>
                </div>
              ) : teacherData ? (
                <div className="eg-logged-badge">
                  <span>
                    Giảng viên:{" "}
                    <strong>
                      {teacherData.teacher?.full_name ||
                        teacherData.teacher?.username}
                    </strong>
                  </span>
                  <button
                    type="button"
                    className="eg-btn-header-cta"
                    onClick={() => onNavigateTo?.("/teacher/dashboard")}
                  >
                    Giám sát ca thi →
                  </button>
                  <button
                    type="button"
                    className="eg-btn-link"
                    onClick={onTeacherLogout}
                  >
                    Thoát
                  </button>
                </div>
              ) : (
                <div className="eg-action-btns">
                  <button
                    type="button"
                    className="eg-btn-outline"
                    onClick={() => handleOpenAuth("student_login")}
                    title="Đăng nhập Học sinh"
                  >
                    <span className="eg-btn-full">Đăng nhập Học sinh</span>
                    <span className="eg-btn-short">Học sinh</span>
                  </button>
                  <button
                    type="button"
                    className="eg-btn-primary"
                    onClick={() => handleOpenAuth("teacher_login")}
                    title="Đăng nhập Giảng viên"
                  >
                    <span className="eg-btn-full">Đăng nhập Giảng viên</span>
                    <span className="eg-btn-short">Giảng viên</span>
                  </button>
                </div>
              )}

              {/* Nút Hamburger menu trên Mobile */}
              <button
                type="button"
                className={`eg-mobile-toggle-btn ${isMobileMenuOpen ? "is-active" : ""}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Menu điều hướng"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Menu trượt dạng list xổ xuống trên mobile */}
          {isMobileMenuOpen && (
            <div className="eg-mobile-nav-drawer">
              <div className="eg-landing-container">
                <nav className="eg-mobile-nav-list" aria-label="Menu di động">
                  <a
                    href="#about"
                    className="eg-mobile-nav-item"
                    onClick={(e) => handleNavScroll(e, "about")}
                  >
                    <span className="eg-mn-icon">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </span>
                    <span className="eg-mn-text">Giới thiệu</span>
                    <span className="eg-mn-arrow">→</span>
                  </a>
                  <a
                    href="#algorithms"
                    className="eg-mobile-nav-item"
                    onClick={(e) => handleNavScroll(e, "algorithms")}
                  >
                    <span className="eg-mn-icon">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    </span>
                    <span className="eg-mn-text">Thuật toán</span>
                    <span className="eg-mn-arrow">→</span>
                  </a>
                  <a
                    href="#workflow"
                    className="eg-mobile-nav-item"
                    onClick={(e) => handleNavScroll(e, "workflow")}
                  >
                    <span className="eg-mn-icon">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </span>
                    <span className="eg-mn-text">Quy trình</span>
                    <span className="eg-mn-arrow">→</span>
                  </a>
                  <a
                    href="#team"
                    className="eg-mobile-nav-item"
                    onClick={(e) => handleNavScroll(e, "team")}
                  >
                    <span className="eg-mn-icon">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <span className="eg-mn-text">Nhóm tác giả</span>
                    <span className="eg-mn-arrow">→</span>
                  </a>
                </nav>
              </div>
            </div>
          )}
        </header>

        {/* ===== 2. HERO SECTION (HẠN CHẾ CHỮ, NỀN ẢNH TỰ NHIÊN) ===== */}
        <section className="eg-hero-section" id="hero-section">
          <div
            className={`eg-landing-container eg-hero-grid ${isAuthOpen ? "is-auth-open" : "is-auth-closed"}`}
          >
            {/* Cột trái: Giới thiệu cô đọng đề tài và thuật toán */}
            <div className="eg-hero-content">
              <div className="eg-institution-badge">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2L2 7h20L12 2z" />
                </svg>
                <span>
                  Khoa CNTT - Đại học Công nghiệp Hà Nội · Nhóm 12 TTCSN
                </span>
              </div>

              <h1 className="eg-hero-title">
                Hệ thống Khảo thí Trực tuyến &amp; Giám sát Phòng thi Thông minh
              </h1>

              {/* Thông số kỹ thuật cô đọng */}
              <div className="eg-hero-stats">
                <div className="eg-stat-card">
                  <span className="eg-stat-num">MediaPipe</span>
                  <span className="eg-stat-lbl">Face Mesh &amp; Head Pose</span>
                </div>
                <div className="eg-stat-card">
                  <span className="eg-stat-num">128-D</span>
                  <span className="eg-stat-lbl">Vector Face Recognition</span>
                </div>
                <div className="eg-stat-card">
                  <span className="eg-stat-num">WebSocket</span>
                  <span className="eg-stat-lbl">Giám sát thời gian thực</span>
                </div>
              </div>

              <div className="eg-hero-features-list">
                <div className="eg-hf-item">
                  <span className="eg-hf-check">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span>
                    Ước lượng hướng nhìn &amp; tư thế đầu (Head Pose) bằng MediaPipe
                  </span>
                </div>
                <div className="eg-hf-item">
                  <span className="eg-hf-check">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span>
                    Đối soát khuôn mặt thí sinh với ảnh check-in chống thi hộ
                  </span>
                </div>
                <div className="eg-hf-item">
                  <span className="eg-hf-check">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span>
                    Phát hiện chuyển tab, rời khỏi khung hình và cảnh báo tức thời
                  </span>
                </div>
              </div>

              <div className="eg-hero-cta-row">
                <button
                  type="button"
                  className={`eg-btn-cta-student ${isAuthOpen && activeAuthTab === "student_login" ? "is-active-focus" : ""}`}
                  onClick={() => handleOpenAuth("student_login")}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Đăng nhập Học sinh vào thi →</span>
                </button>
                <button
                  type="button"
                  className={`eg-btn-cta-teacher ${isAuthOpen && activeAuthTab === "teacher_login" ? "is-active-focus" : ""}`}
                  onClick={() => handleOpenAuth("teacher_login")}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
                    <path d="M8.5 12l2.5 2.5 4.5-5" />
                  </svg>
                  <span>Đăng nhập Giảng viên giám sát</span>
                </button>
              </div>
            </div>

            {/* Cột phải: Khung đăng nhập hiển thị bên phải khi nhấn đăng nhập */}
            {isAuthOpen && (
              <div className="eg-hero-auth-box">
                <div className="eg-auth-portal-card">
                  <button
                    type="button"
                    className="eg-auth-card-close"
                    onClick={handleCloseAuth}
                    title="Đóng khung đăng nhập (Esc)"
                    aria-label="Đóng khung đăng nhập"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>

                  <div className="eg-portal-header">
                    <span className="eg-portal-badge">Cổng truy cập</span>
                    <h2 className="eg-portal-title">Đăng nhập tài khoản</h2>
                  </div>

                  {/* 3 Tabs: Học sinh | Giảng viên | Đổi mật khẩu */}
                  <div className="eg-portal-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      className={`eg-portal-tab ${activeAuthTab === "student_login" ? "is-active" : ""}`}
                      onClick={() => handleTabChange("student_login")}
                    >
                      Học sinh
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`eg-portal-tab ${activeAuthTab === "teacher_login" ? "is-active" : ""}`}
                      onClick={() => handleTabChange("teacher_login")}
                    >
                      Giảng viên
                    </button>
                  </div>

                  {/* Thông báo lỗi & thành công */}
                  {errorMsg && (
                    <div className="eg-alert is-error" role="alert">
                      <span className="eg-alert-icon">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </span>
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="eg-alert is-success" role="alert">
                      <span className="eg-alert-icon">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* 1. Form Học sinh */}
                  {activeAuthTab === "student_login" && (
                    <form
                      onSubmit={handleStudentLoginSubmit}
                      className="eg-form-wrap"
                    >
                      <div className="eg-field">
                        <label htmlFor="p-student-code">
                          Mã sinh viên / Tên đăng nhập
                        </label>
                        <input
                          id="p-student-code"
                          type="text"
                          className="eg-input"
                          placeholder="VD: 2024603201"
                          value={studentCode}
                          onChange={(e) => setStudentCode(e.target.value)}
                          required
                        />
                      </div>

                      <div className="eg-field">
                        <label htmlFor="p-student-pwd">Mật khẩu</label>
                        <input
                          id="p-student-pwd"
                          type="password"
                          className="eg-input"
                          placeholder="Nhập mật khẩu"
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="eg-btn-submit"
                        disabled={loading}
                      >
                        {loading ? "Đang xác thực..." : "Đăng nhập Học sinh →"}
                      </button>

                      <div className="eg-auth-hint-box">
                        <span className="eg-auth-hint-text">
                          Tài khoản sinh viên mẫu: <strong>2024603201</strong> ·
                          Mật khẩu: <strong>123456789</strong>
                        </span>
                      </div>
                    </form>
                  )}

                  {/* 2. Form Giảng viên */}
                  {activeAuthTab === "teacher_login" && (
                    <form
                      onSubmit={handleTeacherLoginSubmit}
                      className="eg-form-wrap"
                    >
                      <div className="eg-field">
                        <label htmlFor="p-teacher-username">
                          Tên đăng nhập Giảng viên
                        </label>
                        <input
                          id="p-teacher-username"
                          type="text"
                          className="eg-input"
                          placeholder="VD: ThsPhamTheAnh hoặc GV001"
                          value={teacherUsername}
                          onChange={(e) => setTeacherUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div className="eg-field">
                        <label htmlFor="p-teacher-pwd">Mật khẩu</label>
                        <input
                          id="p-teacher-pwd"
                          type="password"
                          className="eg-input"
                          placeholder="Nhập mật khẩu giảng viên"
                          value={teacherPassword}
                          onChange={(e) => setTeacherPassword(e.target.value)}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="eg-btn-submit is-teacher"
                        disabled={loading}
                      >
                        {loading ? "Đang truy cập..." : "Đăng nhập Giám thị →"}
                      </button>

                      <div className="eg-auth-hint-box">
                        <span className="eg-auth-hint-text">
                          Tài khoản giám thị duyệt thi:{" "}
                          <strong>ThsPhamTheAnh</strong> hoặc{" "}
                          <strong>GV001</strong> (Mật khẩu:{" "}
                          <strong>123456789</strong>)
                        </span>
                      </div>
                    </form>
                  )}

                  {/* 3. Form Đổi mật khẩu */}
                  {activeAuthTab === "change_password" && (
                    <form
                      onSubmit={handleChangePasswordSubmit}
                      className="eg-form-wrap"
                    >
                      <div className="eg-field">
                        <label htmlFor="p-cp-username">
                          Tên đăng nhập / MSSV
                        </label>
                        <input
                          id="p-cp-username"
                          type="text"
                          className="eg-input"
                          placeholder="Nhập tài khoản"
                          value={cpUsername}
                          onChange={(e) => setCpUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div className="eg-field">
                        <label htmlFor="p-cp-curpwd">Mật khẩu hiện tại</label>
                        <input
                          id="p-cp-curpwd"
                          type="password"
                          className="eg-input"
                          placeholder="Mật khẩu hiện tại"
                          value={cpCurrentPassword}
                          onChange={(e) => setCpCurrentPassword(e.target.value)}
                          required
                        />
                      </div>

                      <div className="eg-field-row">
                        <div className="eg-field">
                          <label htmlFor="p-cp-newpwd">Mật khẩu mới</label>
                          <input
                            id="p-cp-newpwd"
                            type="password"
                            className="eg-input"
                            placeholder="Tối thiểu 6 ký tự"
                            value={cpNewPassword}
                            onChange={(e) => setCpNewPassword(e.target.value)}
                            required
                          />
                        </div>
                        <div className="eg-field">
                          <label htmlFor="p-cp-confirm">
                            Nhập lại mật khẩu
                          </label>
                          <input
                            id="p-cp-confirm"
                            type="password"
                            className="eg-input"
                            placeholder="Xác nhận mật khẩu"
                            value={cpConfirmPassword}
                            onChange={(e) =>
                              setCpConfirmPassword(e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="eg-btn-submit"
                        disabled={loading}
                      >
                        {loading
                          ? "Đang cập nhật..."
                          : "Xác nhận đổi mật khẩu →"}
                      </button>

                      <div className="eg-auth-action-row">
                        <button
                          type="button"
                          className="eg-btn-link"
                          onClick={() => handleTabChange("student_login")}
                        >
                          ← Quay lại Đăng nhập học sinh
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ===== 3. SECTION: GIỚI THIỆU HỆ THỐNG (#about) ===== */}
        <section className="eg-section" id="about">
          <div className="eg-landing-container">
            <div className="eg-section-header">
              <span className="eg-eyebrow">GIẢI PHÁP KHẢO THÍ SỐ</span>
              <h2 className="eg-section-title">
                Nền tảng Khảo thí Trực tuyến An toàn &amp; Minh bạch
              </h2>
              <p className="eg-section-desc">
                Hệ thống do Nhóm 12 nghiên cứu nhằm giải quyết bài toán chống
                thi hộ và giám sát phòng thi trung thực.
              </p>
            </div>

            <div className="eg-pillars-grid">
              <div className="eg-pillar-card">
                <div className="eg-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                </div>
                <h3>Trực tiếp trên trình duyệt Web</h3>
                <p>
                  Thí sinh làm bài trực tiếp trên Chrome, Edge, Safari qua HTML5
                  và WebRTC, không cần cài phần mềm ngoài.
                </p>
              </div>

              <div className="eg-pillar-card">
                <div className="eg-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3>Giám sát hành vi thông minh</h3>
                <p>
                  Tự động phát hiện quay mặt khỏi màn hình, cúi đầu tra tài liệu
                  hoặc có thêm người xuất hiện trong phòng thi.
                </p>
              </div>

              <div className="eg-pillar-card">
                <div className="eg-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3>Bảo vệ môi trường thi</h3>
                <p>
                  Chặn chuyển tab, ngăn sao chép đề bài và gửi tín hiệu cảnh báo
                  ngay khi thí sinh rời giao diện bài thi.
                </p>
              </div>

              <div className="eg-pillar-card">
                <div className="eg-pillar-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <h3>Bằng chứng minh bạch</h3>
                <p>
                  Mỗi cảnh báo vi phạm đều lưu lại ảnh chụp bằng chứng và thời
                  gian để Giám thị xem xét và xử lý công tâm.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 4. SECTION: THUẬT TOÁN ÁP DỤNG (#algorithms) ===== */}
        <section className="eg-section" id="algorithms">
          <div className="eg-landing-container">
            <div className="eg-section-header">
              <span className="eg-eyebrow">THUẬT TOÁN CỐT LÕI</span>
              <h2 className="eg-section-title">
                Thị giác Máy tính &amp; Sinh trắc học
              </h2>
              <p className="eg-section-desc">
                Sự kết hợp giữa xử lý video luồng nhẹ và mô hình đối soát sinh
                trắc học khuôn mặt độ chính xác cao.
              </p>
            </div>

            <div className="eg-tech-showcase-grid">
              <div className="eg-tech-detail-card">
                <div className="eg-tech-badge">THUẬT TOÁN 1</div>
                <h3>MediaPipe &amp; OpenCV (Vision Engine)</h3>
                <ul className="eg-tech-list">
                  <li>
                    <strong>Face Mesh:</strong> Theo dõi 468 điểm tọa độ 3D
                    khuôn mặt thời gian thực ngay trên camera.
                  </li>
                  <li>
                    <strong>Head Pose Estimation:</strong> Đo góc nghiêng
                    (Pitch, Yaw, Roll) để phát hiện cúi đầu hoặc nhìn nghiêng.
                  </li>
                  <li>
                    <strong>Kiểm soát số người:</strong> Cảnh báo tức thì khi
                    phát hiện nhiều người cùng xuất hiện (`MULTIPLE_FACES`).
                  </li>
                  <li>
                    <strong>Phát hiện vắng mặt:</strong> Cảnh báo khi thí sinh
                    rời khỏi khung hình camera (`NO_FACE`).
                  </li>
                </ul>
              </div>

              <div className="eg-tech-detail-card">
                <div className="eg-tech-badge">THUẬT TOÁN 2</div>
                <h3>Face Recognition (Biometric Embedding)</h3>
                <ul className="eg-tech-list">
                  <li>
                    <strong>Vector 128 chiều:</strong> Trích xuất đặc trưng
                    khuôn mặt thành vector 128 chiều chuẩn hóa.
                  </li>
                  <li>
                    <strong>Khoảng cách Euclidean:</strong> So sánh độ sai lệch
                    khuôn mặt lúc thi với ảnh check-in ban đầu.
                  </li>
                  <li>
                    <strong>Chống thi hộ:</strong> Phát hiện và cảnh báo sai
                    lệch danh tính (`FACE_MISMATCH`) khi có người thi thay.
                  </li>
                  <li>
                    <strong>Bảo vệ dữ liệu:</strong> Chỉ xử lý vector số học
                    trong ca thi, bảo mật hình ảnh cá nhân của học sinh.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 5. SECTION: QUY TRÌNH 4 BƯỚC (#workflow) ===== */}
        <section className="eg-section" id="workflow">
          <div className="eg-landing-container">
            <div className="eg-section-header">
              <span className="eg-eyebrow">QUY TRÌNH HOẠT ĐỘNG</span>
              <h2 className="eg-section-title">4 Bước Khảo thí Chuẩn mực</h2>
              <p className="eg-section-desc">
                Quy trình tinh gọn, hỗ trợ học sinh thao tác nhanh chóng và Giám
                thị theo dõi tập trung.
              </p>
            </div>

            <div className="eg-steps-grid">
              <div className="eg-step-card">
                <div className="eg-step-number">01</div>
                <h4>Đăng nhập tài khoản</h4>
                <p>
                  Học sinh đăng nhập để xem danh sách ca thi được chỉ định trên
                  Dashboard.
                </p>
              </div>

              <div className="eg-step-card">
                <div className="eg-step-number">02</div>
                <h4>Check-in thiết bị</h4>
                <p>
                  Kiểm tra camera, chụp ảnh chân dung xác thực ban đầu để Giám
                  thị duyệt vào phòng thi.
                </p>
              </div>

              <div className="eg-step-card">
                <div className="eg-step-number">03</div>
                <h4>Làm bài thi an toàn</h4>
                <p>
                  Hệ thống tự động theo dõi khuôn mặt và bắt sự kiện chuyển tab
                  trong lúc thi.
                </p>
              </div>

              <div className="eg-step-card">
                <div className="eg-step-number">04</div>
                <h4>Nộp bài &amp; Lưu điểm</h4>
                <p>
                  Tự động chấm điểm trắc nghiệm tức thời và lưu trữ kết quả cùng
                  nhật ký vi phạm.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 6. SECTION: ĐỘI NGŨ THỰC HIỆN (#team) ===== */}
        <section className="eg-section" id="team">
          <div className="eg-landing-container">
            <div className="eg-section-header">
              <span className="eg-eyebrow">NHÓM TÁC GIẢ</span>
              <h2 className="eg-section-title">
                Đề tài Thực tập Cơ sở ngành - Nhóm 12
              </h2>
              <p className="eg-section-desc">
                Khoa Công nghệ Thông tin - Trường Đại học Công nghiệp Hà Nội
                (HaUI).
              </p>
            </div>

            <div className="eg-team-layout">
              <div className="eg-mentor-card">
                <div className="eg-mentor-icon-wrap">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                  </svg>
                </div>
                <span className="eg-mentor-role">Giảng viên hướng dẫn</span>
                <h3 className="eg-mentor-name">ThS. Phạm Thế Anh</h3>
                <p className="eg-mentor-dept">
                  Khoa Công nghệ Thông tin · Đại học Công nghiệp Hà Nội
                </p>
                <div className="eg-mentor-note">
                  Định hướng mô hình thị giác máy tính và chuẩn hóa quy trình
                  nghiệp vụ khảo thí.
                </div>
              </div>

              <div className="eg-students-roster-card">
                <h3 className="eg-roster-title">Thành viên Nhóm 12 - TTCSN</h3>
                <div className="eg-roster-grid">
                  <div className="eg-roster-item">
                    <span className="eg-roster-index">01</span>
                    <div>
                      <strong>Bùi Minh Nhật</strong>
                      <span className="eg-roster-mssv">MSSV: 2024603201</span>
                    </div>
                  </div>
                  <div className="eg-roster-item">
                    <span className="eg-roster-index">02</span>
                    <div>
                      <strong>Trần Văn Trung</strong>
                      <span className="eg-roster-mssv">MSSV: 2024604243</span>
                    </div>
                  </div>
                  <div className="eg-roster-item">
                    <span className="eg-roster-index">03</span>
                    <div>
                      <strong>Trần Hoàng Nam</strong>
                      <span className="eg-roster-mssv">MSSV: 2024604304</span>
                    </div>
                  </div>
                  <div className="eg-roster-item">
                    <span className="eg-roster-index">04</span>
                    <div>
                      <strong>Trịnh Đình Mạnh</strong>
                      <span className="eg-roster-mssv">MSSV: 2024603775</span>
                    </div>
                  </div>
                  <div className="eg-roster-item">
                    <span className="eg-roster-index">05</span>
                    <div>
                      <strong>Nhữ Quốc Trường</strong>
                      <span className="eg-roster-mssv">MSSV: 2024603200</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 7. FOOTER ===== */}
        <footer className="eg-landing-footer">
          <div className="eg-landing-container eg-footer-inner">
            <div className="eg-footer-brand">
              <div className="eg-brand-group">
                <div className="eg-logo-badge">
                  <img
                    src={logoImg}
                    alt="ExamGuard Logo"
                    className="eg-brand-logo"
                  />
                </div>
                <span className="eg-brand-title">EXAMGUARD</span>
              </div>
              <p className="eg-footer-desc">
                Hệ thống Khảo thí Trắc nghiệm Trực tuyến &amp; Hỗ trợ Giám sát
                Phòng thi Thông minh.
                <br />
                Đại học Công nghiệp Hà Nội (HaUI).
              </p>
            </div>

            <div className="eg-footer-links">
              <div className="eg-fl-col">
                <h4>Truy cập</h4>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("student_login")}
                >
                  Đăng nhập Học sinh
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("teacher_login")}
                >
                  Đăng nhập Giảng viên
                </button>
              </div>
              <div className="eg-fl-col">
                <h4>Thuật toán</h4>
                <a href="#algorithms">MediaPipe Face Mesh</a>
                <a href="#algorithms">Face Recognition 128-D</a>
                <a href="#about">Môi trường thi an toàn</a>
              </div>
              <div className="eg-fl-col">
                <h4>Liên hệ</h4>
                <a href="#team">Nhóm 12 - TTCSN</a>
                <a href="#team">Giảng viên hướng dẫn</a>
              </div>
            </div>
          </div>

          <div className="eg-footer-bottom">
            <div className="eg-landing-container eg-fb-inner">
              <span>
                © 2026 ExamGuard · Nhóm 12 TTCSN · Khoa CNTT - Đại học Công
                nghiệp Hà Nội.
              </span>
              <span>Hệ thống Khảo thí Trực tuyến Thông minh</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
