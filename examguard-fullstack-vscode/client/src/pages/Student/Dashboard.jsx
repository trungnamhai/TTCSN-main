import React, { useState, useEffect, useMemo } from "react";
import "./Dashboard.css";
// Sử dụng lại logo từ thư mục Auth của bạn
import logoImg from "../Auth/logo.png";

export default function StudentDashboard({ authData, onStartExam, onLogout }) {
  const [activeNav, setActiveNav] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 1. Dữ liệu thông tin sinh viên (lấy động từ dữ liệu đăng nhập hoặc CSDL bảng users)
  const studentInfo = useMemo(() => {
    const user = authData?.user || authData?.student || {};
    return {
      id: user.id || 1,
      username: user.username || user.studentCode || "2024603201",
      full_name: user.full_name || user.fullName || "Trần Văn Trung",
      role_name: "Sinh viên",
      profile_image_url: user.profile_image_url || null,
    };
  }, [authData]);

  // 2. Danh sách các kỳ thi sắp tới (khớp với bảng exams, exam_sessions, subjects)
  const [upcomingExams, setUpcomingExams] = useState(
    authData?.upcomingExams || [
      {
        session_id: 101,
        session_code: "123456789",
        title: "Lập trình Web",
        subject_name: "Công nghệ Web",
        subject_code: "IT6012",
        exam_date: "25/10/2026",
        time_range: "08:00 - 09:30",
        duration_minutes: 90,
        icon_type: "code",
        is_active: true,
      },
      {
        session_id: 102,
        session_code: "123456789",
        title: "Toán rời rạc",
        subject_name: "Cơ sở dữ liệu",
        subject_code: "IT6025",
        exam_date: "28/10/2026",
        time_range: "13:30 - 15:00",
        duration_minutes: 90,
        icon_type: "math",
        is_active: true,
      },
      {
        session_id: 103,
        session_code: "123456789",
        title: "Tiếng Anh chuyên ngành",
        subject_name: "Tiếng Anh",
        subject_code: "FL6008",
        exam_date: "02/11/2026",
        time_range: "08:00 - 09:30",
        duration_minutes: 90,
        icon_type: "lang",
        is_active: true,
      },
    ],
  );

  // 3. Kết quả học tập gần đây (khớp với bảng exam_attempts, exams, subjects)
  const [recentAttempts, setRecentAttempts] = useState(
    authData?.recentAttempts || [
      {
        attempt_id: 1,
        exam_title: "Lập trình Python cơ bản",
        subject_name: "Lập trình",
        submit_time: "15/10/2026 09:12",
        total_score: 9.0,
        status: "SUBMITTED",
        status_label: "Đã chấm",
      },
      {
        attempt_id: 2,
        exam_title: "Cấu trúc dữ liệu và giải thuật",
        subject_name: "CNTT",
        submit_time: "10/10/2026 14:20",
        total_score: 8.5,
        status: "SUBMITTED",
        status_label: "Đã chấm",
      },
      {
        attempt_id: 3,
        exam_title: "Kinh tế vi mô",
        subject_name: "Kinh tế",
        submit_time: "05/10/2026 10:05",
        total_score: 7.5,
        status: "SUBMITTED",
        status_label: "Đã chấm",
      },
      {
        attempt_id: 4,
        exam_title: "Toán rời rạc",
        subject_name: "Toán",
        submit_time: "28/09/2026 16:30",
        total_score: 9.4,
        status: "SUBMITTED",
        status_label: "Đã chấm",
      },
    ],
  );

  // 4. Tính toán động 4 ô thống kê từ dữ liệu hoặc lấy từ state/API
  const stats = useMemo(() => {
    const completedCount = recentAttempts.filter(
      (item) => item.status === "SUBMITTED",
    ).length;
    const ongoingCount = authData?.stats?.ongoingExams ?? 1;
    const totalParticipated =
      authData?.stats?.totalParticipated ?? completedCount + ongoingCount;

    const avgScore =
      authData?.stats?.averageScore ??
      (completedCount > 0
        ? (
            recentAttempts.reduce(
              (sum, item) => sum + Number(item.total_score || 0),
              0,
            ) / completedCount
          ).toFixed(1)
        : "0.0");

    return {
      totalParticipated,
      completedCount,
      ongoingCount,
      averageScore: avgScore,
    };
  }, [recentAttempts, authData]);

  // Hàm xử lý khi nhấn nút "Vào thi" ở từng môn
  const handleEnterExam = (examItem) => {
    if (onStartExam) {
      onStartExam(examItem);
    }
  };

  return (
    <div className="sd-layout">
      {/* SIDEBAR BÊN TRÁI */}
      <aside
        className={`sd-sidebar ${sidebarOpen ? "" : "sd-sidebar-collapsed"}`}
      >
        <div className="sd-brand">
          <img src={logoImg} alt="TRACNGHIEM Logo" className="sd-brand-logo" />
        </div>

        <nav className="sd-nav">
          <button
            type="button"
            className={`sd-nav-item ${activeNav === "home" ? "active" : ""}`}
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </span>
            <span>Trang chủ</span>
          </button>

          <button
            type="button"
            className="sd-nav-item"
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <span>Thi của tôi</span>
          </button>

          <button
            type="button"
            className="sd-nav-item"
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </span>
            <span>Ngân hàng câu hỏi</span>
          </button>

          <button
            type="button"
            className="sd-nav-item"
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            <span>Kết quả</span>
          </button>

          <button
            type="button"
            className="sd-nav-item"
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <span>Thông báo</span>
          </button>

          <button
            type="button"
            className="sd-nav-item"
            onClick={() => setActiveNav("home")}
          >
            <span className="sd-nav-icon">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            <span>Cài đặt</span>
          </button>
        </nav>

        {/* Minh họa góc dưới Sidebar */}
        <div className="sd-sidebar-footer">
          <div className="sd-shield-illustration">
            <svg viewBox="0 0 64 64" width="56" height="56">
              <path
                d="M32 6L12 14v16c0 14.5 8.5 27.3 20 32 11.5-4.7 20-17.5 20-32V14L32 6z"
                fill="#dbeafe"
                stroke="#2563eb"
                strokeWidth="2.5"
              />
              <rect
                x="25"
                y="28"
                width="14"
                height="11"
                rx="2"
                fill="#1d4ed8"
              />
              <path
                d="M28 28v-3a4 4 0 0 1 8 0v3"
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <p className="sd-Poster-title">Thi nghiêm túc</p>
          <p className="sd-Poster-sub">Kiến tạo tương lai</p>
        </div>
      </aside>

      {/* PHẦN NỘI DUNG CHÍNH BÊN PHẢI */}
      <div className="sd-main-area">
        {/* TOP HEADER */}
        <header className="sd-topbar">
          <button
            type="button"
            className="sd-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Thu gọn / Mở rộng menu"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="sd-topbar-right">
            <button type="button" className="sd-notif-btn" title="Thông báo">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="sd-notif-dot" />
            </button>

            <div className="sd-user-profile">
              <div className="sd-avatar">
                {studentInfo.profile_image_url ? (
                  <img
                    src={studentInfo.profile_image_url}
                    alt={studentInfo.full_name}
                  />
                ) : (
                  <svg viewBox="0 0 40 40" width="38" height="38">
                    <circle cx="20" cy="20" r="20" fill="#dbeafe" />
                    <circle cx="20" cy="15" r="7" fill="#1e40af" />
                    <path d="M7 36c2-7 8-11 13-11s11 4 13 11" fill="#2563eb" />
                  </svg>
                )}
              </div>
              <div className="sd-user-meta">
                <span className="sd-user-name">{studentInfo.full_name}</span>
                <span className="sd-user-role">
                  {studentInfo.role_name} · {studentInfo.username}
                </span>
              </div>
              {onLogout && (
                <button
                  type="button"
                  className="sd-logout-btn"
                  onClick={onLogout}
                  title="Đăng xuất"
                >
                  Đăng xuất
                </button>
              )}
            </div>
          </div>
        </header>

        {/* NỘI DUNG DASHBOARD */}
        <main className="sd-content">
          {/* Lời chào sinh viên (Hiển thị động tên sinh viên) */}
          <div className="sd-welcome-block">
            <h1 className="sd-welcome-title">
              Xin chào, {studentInfo.full_name}!{" "}
              <span className="sd-wave">👋</span>
            </h1>
            <p className="sd-welcome-sub">Chúc bạn có một kỳ thi thật tốt!</p>
          </div>

          {/* 4 THẺ THỐNG KÊ ĐỘNG */}
          <div className="sd-stats-grid">
            <div className="sd-stat-card sd-stat-blue">
              <div className="sd-stat-icon-wrap blue">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
              </div>
              <div className="sd-stat-info">
                <span className="sd-stat-label">
                  Tổng số bài thi đã tham gia
                </span>
                <div className="sd-stat-value-row">
                  <strong className="sd-stat-number">
                    {stats.totalParticipated}
                  </strong>
                  <span className="sd-stat-unit">bài thi</span>
                </div>
              </div>
            </div>

            <div className="sd-stat-card sd-stat-green">
              <div className="sd-stat-icon-wrap green">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <div className="sd-stat-info">
                <span className="sd-stat-label">Bài thi đã hoàn thành</span>
                <div className="sd-stat-value-row">
                  <strong className="sd-stat-number">
                    {stats.completedCount}
                  </strong>
                  <span className="sd-stat-unit">bài thi</span>
                </div>
              </div>
            </div>

            <div className="sd-stat-card sd-stat-orange">
              <div className="sd-stat-icon-wrap orange">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div className="sd-stat-info">
                <span className="sd-stat-label">Bài thi đang diễn ra</span>
                <div className="sd-stat-value-row">
                  <strong className="sd-stat-number">
                    {stats.ongoingCount}
                  </strong>
                  <span className="sd-stat-unit">bài thi</span>
                </div>
              </div>
            </div>

            <div className="sd-stat-card sd-stat-purple">
              <div className="sd-stat-icon-wrap purple">
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.47 14L12 14.42 9.53 16l.65-2.81-2.18-1.89 2.87-.25L12 8.4l1.13 2.65 2.87.25-2.18 1.89.65 2.81z" />
                </svg>
              </div>
              <div className="sd-stat-info">
                <span className="sd-stat-label">Điểm trung bình</span>
                <div className="sd-stat-value-row">
                  <strong className="sd-stat-number">
                    {stats.averageScore}
                  </strong>
                  <span className="sd-stat-unit">/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* LƯỚI CHÍNH 2 CỘT */}
          <div className="sd-dashboard-grid">
            {/* CỘT TRÁI: Các kỳ thi sắp tới & Kết quả học tập gần đây */}
            <div className="sd-left-col">
              {/* KHỐI 1: CÁC KỲ THI SẮP TỚI */}
              <section className="sd-panel">
                <div className="sd-panel-header">
                  <div className="sd-panel-title-wrap">
                    <span className="sd-panel-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <h2 className="sd-panel-title">Các kỳ thi sắp tới</h2>
                  </div>
                  <a
                    href="#all-exams"
                    onClick={(e) => e.preventDefault()}
                    className="sd-view-all"
                  >
                    Xem tất cả →
                  </a>
                </div>

                <div className="sd-exam-list">
                  {upcomingExams.map((exam) => (
                    <div key={exam.session_id} className="sd-exam-item">
                      <div className="sd-exam-left">
                        <div className="sd-exam-subject-icon">
                          {exam.icon_type === "code" && <span>&lt;/&gt;</span>}
                          {exam.icon_type === "math" && <span>√x</span>}
                          {exam.icon_type === "lang" && (
                            <span>
                              A<sub>Z</sub>
                            </span>
                          )}
                        </div>
                        <div className="sd-exam-meta">
                          <h3 className="sd-exam-name">{exam.title}</h3>
                          <p className="sd-exam-sub">
                            Môn học: {exam.subject_name}
                          </p>
                        </div>
                      </div>

                      <div className="sd-exam-Schedule">
                        <div className="sd-schedule-row">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <span>{exam.exam_date}</span>
                        </div>
                        <div className="sd-schedule-row">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>{exam.time_range}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="sd-enter-exam-btn"
                        onClick={() => handleEnterExam(exam)}
                      >
                        Vào thi <span>›</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* KHỐI 2: KẾT QUẢ HỌC TẬP GẦN ĐÂY */}
              <section className="sd-panel">
                <div className="sd-panel-header">
                  <div className="sd-panel-title-wrap">
                    <span className="sd-panel-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </span>
                    <h2 className="sd-panel-title">Kết quả học tập gần đây</h2>
                  </div>
                  <a
                    href="#all-results"
                    onClick={(e) => e.preventDefault()}
                    className="sd-view-all"
                  >
                    Xem tất cả →
                  </a>
                </div>

                <div className="sd-table-wrapper">
                  <table className="sd-results-table">
                    <thead>
                      <tr>
                        <th>Tên bài thi</th>
                        <th>Môn học</th>
                        <th>Thời gian làm bài</th>
                        <th>Điểm số</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttempts.map((item) => (
                        <tr key={item.attempt_id}>
                          <td className="sd-td-title">{item.exam_title}</td>
                          <td>{item.subject_name}</td>
                          <td className="sd-td-time">{item.submit_time}</td>
                          <td className="sd-td-score">
                            {Number(item.total_score).toFixed(1)}
                          </td>
                          <td>
                            <span className="sd-status-badge">
                              {item.status_label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* CỘT PHẢI: Giám sát thông minh AI & Slogan */}
            <div className="sd-right-col">
              {/* Thẻ Giám sát thông minh */}
              <section className="sd-panel sd-proctor-card">
                <div className="sd-proctor-top">
                  <div className="sd-proctor-text">
                    <h3 className="sd-proctor-heading">
                      Giám sát thông minh
                      <br />
                      Chống gian lận hiệu quả
                    </h3>
                    <p className="sd-proctor-desc">
                      Hệ thống sử dụng AI và Computer Vision để nhận diện khuôn
                      mặt, phát hiện hành vi bất thường và đảm bảo kỳ thi công
                      bằng, minh bạch.
                    </p>
                  </div>
                  <div className="sd-proctor-face-graphic">
                    <svg viewBox="0 0 80 80" width="76" height="76">
                      <path
                        d="M14 26V14h12M54 14h12v12M66 54v12H54M26 66H14V54"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="40" cy="34" r="11" fill="#3b82f6" />
                      <path
                        d="M22 60c3-10 10-15 18-15s15 5 18 15"
                        fill="#60a5fa"
                      />
                      <circle cx="62" cy="58" r="10" fill="#2563eb" />
                      <polyline
                        points="57 58 60.5 61.5 67 55"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="2.5"
                      />
                    </svg>
                  </div>
                </div>

                <div className="sd-proctor-features">
                  <div className="sd-feature-item">
                    <div className="sd-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                      >
                        <path d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                        <circle cx="12" cy="11" r="3" />
                        <path d="M7 18c1.5-2.5 3.2-3.5 5-3.5s3.5 1 5 3.5" />
                      </svg>
                    </div>
                    <span>Nhận diện khuôn mặt</span>
                  </div>

                  <div className="sd-feature-item">
                    <div className="sd-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                      >
                        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                      </svg>
                    </div>
                    <span>Phát hiện cử chỉ bất thường</span>
                  </div>

                  <div className="sd-feature-item">
                    <div className="sd-feature-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="none"
                        stroke="#1d4ed8"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <circle cx="12" cy="14" r="3" />
                      </svg>
                    </div>
                    <span>Lưu bằng chứng vi phạm</span>
                  </div>
                </div>
              </section>

              {/* Thẻ Châm ngôn học tập */}
              <section className="sd-panel sd-quote-card">
                <div className="sd-quote-left">
                  <div className="sd-quote-target-icon">
                    <svg
                      viewBox="0 0 24 24"
                      width="28"
                      height="28"
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth="2.2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                  </div>
                  <blockquote className="sd-quote-text">
                    “Kiến thức là chìa khóa mở ra cánh cửa tương lai.”
                  </blockquote>
                  <p className="sd-quote-sub">— Vững bước cùng bạn —</p>
                </div>

                <div className="sd-quote-graphic">
                  <svg viewBox="0 0 100 100" width="90" height="90">
                    <path
                      d="M10 90 L45 55 L65 70 L90 35 L90 90 Z"
                      fill="#dbeafe"
                    />
                    <path
                      d="M55 55 L55 20 L80 28 L55 36"
                      fill="#2563eb"
                      stroke="#1d4ed8"
                      strokeWidth="2"
                    />
                    <circle cx="45" cy="42" r="5" fill="#1e3a8a" />
                    <path
                      d="M40 55 L45 47 L52 52"
                      stroke="#1d4ed8"
                      strokeWidth="3.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
