import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiRequest } from '../../services/api';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import AttemptDetailModal from '../../components/AttemptDetailModal';
import './Dashboard.css';

export default function StudentDashboard({ authData, onStartExam, onLogout }) {
  // Navigation active tab: 'open_exams' | 'upcoming' | 'history' | 'rules'
  const [activeTab, setActiveTab] = useState('open_exams');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Thông tin thí sinh
  const studentInfo = useMemo(() => {
    const user = authData?.user || authData?.student || {};
    return {
      id: user.id || 1,
      username: user.username || user.studentCode || 'SV2026001',
      full_name: user.full_name || user.fullName || user.username || 'Thí sinh',
      email: user.email || 'sv2026001@student.edu.vn',
      role_name: 'Thí sinh',
      token: authData?.token || ''
    };
  }, [authData]);

  // 2. Danh sách ca thi từ API / Fallback
  const [allSessions, setAllSessions] = useState([
    {
      id: 1,
      session_id: 1,
      session_code: 'EXAM88',
      title: 'Kiểm tra giữa kỳ: An toàn thông tin & Khảo thí AI',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      subject_code: 'IT4010',
      room: 'Phòng Máy 302 - Tòa A',
      exam_date: '12/11/2026',
      time_range: '08:00 - 08:30',
      duration_minutes: 30,
      total_questions: 20,
      passing_score: 5.0,
      status: 'OPEN',
      status_label: 'Đang mở / Vào thi ngay',
      security_config: {
        require_face_check: true,
        detect_tab_switch: true,
        require_fullscreen: true,
        prevent_copy_paste: true
      }
    },
    {
      id: 2,
      session_id: 2,
      session_code: 'IT6012_WEB',
      title: 'Thi kết thúc học phần: Lập trình Web nâng cao',
      subject_name: 'Công nghệ Web & Frameworks',
      subject_code: 'IT6012',
      room: 'Phòng Máy 405 - Tòa B',
      exam_date: '15/11/2026',
      time_range: '09:00 - 10:30',
      duration_minutes: 90,
      total_questions: 40,
      passing_score: 5.0,
      status: 'UPCOMING',
      status_label: 'Sắp diễn ra',
      security_config: {
        require_face_check: true,
        detect_tab_switch: true,
        require_fullscreen: true,
        prevent_copy_paste: true
      }
    },
    {
      id: 3,
      session_id: 3,
      session_code: 'IT6025_CSDL',
      title: 'Khảo thí đánh giá định kỳ: Hệ quản trị Cơ sở dữ liệu',
      subject_name: 'Cơ sở dữ liệu nâng cao',
      subject_code: 'IT6025',
      room: 'Phòng Máy 201 - Tòa A',
      exam_date: '20/11/2026',
      time_range: '14:00 - 15:00',
      duration_minutes: 60,
      total_questions: 30,
      passing_score: 5.0,
      status: 'UPCOMING',
      status_label: 'Sắp diễn ra',
      security_config: {
        require_face_check: true,
        detect_tab_switch: true,
        require_fullscreen: true,
        prevent_copy_paste: false
      }
    }
  ]);

  // 3. Lịch sử bài thi đã nộp
  const [recentAttempts, setRecentAttempts] = useState([
    {
      attempt_id: 101,
      session_code: 'IT6025_PREV',
      exam_title: 'Kiểm tra Thực hành: Truy vấn SQL nâng cao',
      subject_name: 'Cơ sở dữ liệu nâng cao',
      submit_time: '08/11/2026 14:45',
      total_score: 9.0,
      status: 'SUBMITTED',
      status_label: 'Đã hoàn thành',
      passed: true
    },
    {
      attempt_id: 102,
      session_code: 'IT4010_QUIZ',
      exam_title: 'Đánh giá định kỳ: Mã hóa đối xứng AES & RSA',
      subject_name: 'An toàn thông tin',
      submit_time: '01/11/2026 09:20',
      total_score: 8.5,
      status: 'SUBMITTED',
      status_label: 'Đã hoàn thành',
      passed: true
    },
    {
      attempt_id: 103,
      session_code: 'CS101_MID',
      exam_title: 'Cấu trúc dữ liệu và Giải thuật',
      subject_name: 'Khoa học máy tính',
      submit_time: '24/10/2026 15:30',
      total_score: 8.0,
      status: 'SUBMITTED',
      status_label: 'Đã hoàn thành',
      passed: true
    }
  ]);

  // 4. Fetch danh sách ca thi & lịch sử thi từ backend
  const fetchStudentData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [sesData, attData] = await Promise.allSettled([
        apiRequest('/exam/sessions', { token: studentInfo.token }),
        apiRequest('/exam/attempts', { token: studentInfo.token })
      ]);

      if (sesData.status === 'fulfilled' && Array.isArray(sesData.value?.sessions) && sesData.value.sessions.length > 0) {
        setAllSessions(sesData.value.sessions);
      }
      if (attData.status === 'fulfilled' && Array.isArray(attData.value?.attempts) && attData.value.attempts.length > 0) {
        setRecentAttempts(attData.value.attempts);
      }
    } catch {
      // Dùng fallback store có sẵn
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [studentInfo.token]);

  // Phân loại ca thi
  const openSessions = useMemo(() => {
    let list = allSessions.filter((s) => s.status === 'OPEN' || s.is_active === true || s.is_active === 1);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.session_code?.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.subject_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allSessions, searchQuery]);

  const upcomingSessions = useMemo(() => {
    let list = allSessions.filter((s) => s.status === 'UPCOMING' || s.status === 'UPCOMING_SCHEDULE');
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.session_code?.toLowerCase().includes(q) ||
          s.title?.toLowerCase().includes(q) ||
          s.subject_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allSessions, searchQuery]);

  // Thống kê điểm và ca thi
  const stats = useMemo(() => {
    const completedCount = recentAttempts.length;
    const totalParticipated = completedCount + openSessions.length;
    const avgScore =
      completedCount > 0
        ? (
            recentAttempts.reduce((sum, item) => sum + Number(item.total_score || 0), 0) / completedCount
          ).toFixed(1)
        : '0.0';

    return {
      totalParticipated,
      completedCount,
      openCount: openSessions.length,
      upcomingCount: upcomingSessions.length,
      averageScore: avgScore
    };
  }, [recentAttempts, openSessions, upcomingSessions]);

  // Xử lý vào ca thi
  const handleEnterExam = (examItem) => {
    if (onStartExam) {
      onStartExam(examItem);
    }
  };

  // State kiểm tra thiết bị Webcam
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCameraTest = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt chặn Camera do đang truy cập qua HTTP mạng LAN. Hãy mở chrome://flags và thêm URL vào mục Insecure origins treated as secure.');
        setCameraActive(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360 },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setStatusMsg('Camera và Microphone hoạt động bình thường! Thiết bị đã sẵn sàng cho phòng thi AI.');
    } catch (err) {
      setCameraError('Không thể truy cập Camera/Microphone: ' + (err.message || 'Vui lòng cấp quyền trong trình duyệt.'));
      setCameraActive(false);
    }
  };

  const stopCameraTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraTest();
    };
  }, []);

  const navItems = [
    {
      key: 'open_exams',
      label: 'Ca thi trực tuyến',
      count: openSessions.length,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )
    },
    {
      key: 'upcoming',
      label: 'Lịch thi sắp tới',
      count: upcomingSessions.length,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
          <rect x="3" y="5" width="18" height="16" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      )
    },
    {
      key: 'history',
      label: 'Lịch sử & Kết quả thi',
      count: recentAttempts.length,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    },
    {
      key: 'rules',
      label: 'Kiểm tra thiết bị & Quy chế',
      count: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    }
  ];

  return (
    <div className="eg-dashboard eg-shell">
      {/* ===== Sidebar Điều hướng bên trái ===== */}
      <aside className={`eg-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="eg-brand">
          <span className="eg-brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="eg-brand-text">
              <strong>Hệ thống khảo thí</strong>
              <small>Khu vực thí sinh</small>
            </span>
          )}
          <button
            type="button"
            className="eg-btn-collapse-sidebar"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Mở rộng menu chức năng" : "Thu gọn menu chức năng"}
            aria-label="Đóng mở menu chức năng"
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="eg-nav" aria-label="Chức năng chính">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`eg-nav-btn ${activeTab === item.key ? 'is-active' : ''}`}
              aria-current={activeTab === item.key ? 'page' : undefined}
              onClick={() => setActiveTab(item.key)}
              title={sidebarCollapsed ? `${item.label} ${typeof item.count === 'number' ? `(${item.count})` : ''}` : undefined}
            >
              {item.icon}
              {!sidebarCollapsed && <span className="eg-nav-label">{item.label}</span>}
              {!sidebarCollapsed && typeof item.count === 'number' && (
                <span className="eg-nav-count">{item.count}</span>
              )}
            </button>
          ))}
        </nav>

        <button type="button" onClick={onLogout} className="eg-dashboard-logout" title={sidebarCollapsed ? "Đăng xuất" : undefined}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!sidebarCollapsed && <span>Đăng xuất</span>}
        </button>
      </aside>

      {/* ===== Khu vực nội dung chính ===== */}
      <main className="eg-main">
        {/* 1. Header trên cùng */}
        <div className="eg-dashboard-header">
          <div className="eg-dashboard-welcome-wrap">
            <button
              type="button"
              className="eg-btn-menu-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Mở menu chức năng" : "Đóng menu chức năng"}
              aria-label="Đóng mở menu chức năng"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>{sidebarCollapsed ? "Mở menu" : "Đóng menu"}</span>
            </button>
            <div className="eg-dashboard-welcome">
              <span className="eg-dashboard-eyebrow">HỆ THỐNG KHẢO THÍ TRỰC TUYẾN · KHU VỰC THÍ SINH</span>
              <h1 className="eg-dashboard-title">Bảng điều khiển Thí sinh</h1>
              <p className="eg-dashboard-description">
                Xin chào <strong>{studentInfo.full_name}</strong> · Mã SV: <strong>{studentInfo.username}</strong>
                {' '}· Trạng thái: <span className="eg-badge-student-ready">● Sẵn sàng tham gia thi</span>
              </p>
            </div>
          </div>

          <div className="eg-dashboard-actions">
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="eg-dashboard-pwd-btn"
              title="Đổi mật khẩu tài khoản"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Đổi mật khẩu
            </button>
            <button
              type="button"
              onClick={fetchStudentData}
              className="eg-dashboard-refresh"
              disabled={loading}
            >
              {loading ? 'Đang tải...' : '↻ Làm mới'}
            </button>
          </div>
        </div>

        {/* Global alert notifications */}
        {statusMsg && (
          <div className="eg-dashboard-alert-banner is-success" role="status">
            <span>{statusMsg}</span>
            <button type="button" onClick={() => setStatusMsg('')} className="eg-banner-close" aria-label="Đóng thông báo">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="eg-dashboard-alert-banner is-error" role="alert">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} className="eg-banner-close" aria-label="Đóng thông báo">✕</button>
          </div>
        )}

        {/* 2. DÃY THỐNG KÊ (STATS ROW) */}
        <section className="eg-dashboard-stats" aria-label="Thống kê học tập">
          <div className="eg-dashboard-stat">
            <span className="eg-dashboard-stat-label">Tổng bài thi đã tham gia</span>
            <strong>{stats.totalParticipated}</strong>
          </div>
          <div className="eg-dashboard-stat eg-dashboard-stat-warning">
            <span className="eg-dashboard-stat-label">Ca thi đang mở (Vào thi ngay)</span>
            <strong>{stats.openCount}</strong>
          </div>
          <div className="eg-dashboard-stat">
            <span className="eg-dashboard-stat-label">Lịch thi sắp tới</span>
            <strong>{stats.upcomingCount}</strong>
          </div>
          <div className="eg-dashboard-stat">
            <span className="eg-dashboard-stat-label">Bài thi đã hoàn thành</span>
            <strong>{stats.completedCount}</strong>
          </div>
          <div className="eg-dashboard-stat">
            <span className="eg-dashboard-stat-label">Điểm trung bình tích lũy</span>
            <strong style={{ color: 'var(--eg-accent)' }}>{stats.averageScore}đ</strong>
          </div>
        </section>

      {/* =========================================================================
          TAB 1: CA THI TRỰC TUYẾN & VÀO THI NGAY
          ========================================================================= */}
      {activeTab === 'open_exams' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Danh sách ca thi đang mở</h2>
                <p className="eg-dashboard-roster-description">
                  Chọn phòng thi bạn được phân công và nhấn <strong>"Vào phòng thi ngay"</strong> để xác thực khuôn mặt và làm bài.
                </p>
              </div>
              <span className="eg-dashboard-roster-count">{openSessions.length} ca thi đang mở</span>
            </div>

            {/* Toolbar tìm kiếm */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo mã ca thi (EXAM88), môn học, tiêu đề..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="eg-dashboard-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                )}
              </div>
            </div>

            {openSessions.length === 0 ? (
              <p className="eg-dashboard-empty">
                Hiện tại không có ca thi nào đang mở. Vui lòng kiểm tra lại lịch thi hoặc liên hệ giám thị.
              </p>
            ) : (
              <div className="eg-student-open-sessions-grid">
                {openSessions.map((ses) => {
                  const sec = ses.security_config || {};
                  return (
                    <div key={ses.id || ses.session_id} className="eg-student-session-card">
                      <div className="eg-student-card-top">
                        <span className="eg-session-code-tag">{ses.session_code}</span>
                        <span className="eg-status-tag is-open">● Đang mở phòng thi</span>
                      </div>

                      <h3 className="eg-student-card-title">{ses.title}</h3>
                      <div className="eg-student-card-subject">
                        {ses.subject_name} {ses.subject_code ? `(${ses.subject_code})` : ''}
                      </div>

                      <div className="eg-student-meta-list">
                        <div className="eg-student-meta-item">
                          <span className="eg-meta-label">Thời lượng làm bài:</span>
                          <strong>{ses.duration_minutes || 60} phút</strong>
                        </div>
                        <div className="eg-student-meta-item">
                          <span className="eg-meta-label">Số câu hỏi:</span>
                          <strong>{ses.total_questions || 20} câu</strong>
                        </div>
                        <div className="eg-student-meta-item">
                          <span className="eg-meta-label">Địa điểm / Phòng:</span>
                          <span>{ses.room || 'Phòng trực tuyến 01'}</span>
                        </div>
                        <div className="eg-student-meta-item">
                          <span className="eg-meta-label">Khung giờ ca thi:</span>
                          <span>{ses.time_range || '08:00 - 09:30'}</span>
                        </div>
                      </div>

                      {/* Tiêu chí bảo mật AI */}
                      <div className="eg-student-sec-badges">
                        <span className="eg-mini-badge is-easy" title="Giám sát khuôn mặt định kỳ">
                          {sec.require_face_check !== false ? '✓ AI Camera' : '— No Camera'}
                        </span>
                        <span className="eg-mini-badge is-medium" title="Bắt sự kiện chuyển tab">
                          {sec.detect_tab_switch !== false ? '✓ Khóa chuyển tab' : '— Tự do tab'}
                        </span>
                        <span className="eg-mini-badge is-hard" title="Bắt buộc toàn màn hình">
                          {sec.require_fullscreen !== false ? '✓ Toàn màn hình' : '— Cửa sổ'}
                        </span>
                      </div>

                      <div className="eg-student-card-actions">
                        <button
                          type="button"
                          className="eg-student-enter-btn"
                          onClick={() => handleEnterExam(ses)}
                        >
                          Vào phòng thi ngay →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LỊCH THI SẮP TỚI
          ========================================================================= */}
      {activeTab === 'upcoming' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Lịch thi sắp diễn ra</h2>
                <p className="eg-dashboard-roster-description">
                  Theo dõi lịch thi các môn học trong học kỳ để chuẩn bị thiết bị và ôn tập kịp thời.
                </p>
              </div>
              <span className="eg-dashboard-roster-count">{upcomingSessions.length} ca thi</span>
            </div>

            {upcomingSessions.length === 0 ? (
              <p className="eg-dashboard-empty">Bạn không có lịch thi nào sắp tới.</p>
            ) : (
              <div className="eg-dashboard-roster-scroll">
                <table className="eg-dashboard-roster-table">
                  <thead>
                    <tr>
                      <th>Mã ca thi</th>
                      <th>Môn học & Ca thi</th>
                      <th>Ngày thi</th>
                      <th>Khung giờ</th>
                      <th>Thời lượng</th>
                      <th>Phòng máy</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSessions.map((ses) => (
                      <tr key={ses.id || ses.session_id}>
                        <td>
                          <span className="eg-session-code-tag">{ses.session_code}</span>
                        </td>
                        <td>
                          <strong>{ses.title}</strong>
                          <div className="eg-table-subtext">{ses.subject_name}</div>
                        </td>
                        <td>{ses.exam_date || 'Chưa xếp'}</td>
                        <td>{ses.time_range || '08:00 - 09:30'}</td>
                        <td><strong>{ses.duration_minutes || 60} phút</strong></td>
                        <td>{ses.room || 'Phòng máy trực tuyến'}</td>
                        <td>
                          <span className="eg-status-tag is-upcoming">○ Sắp diễn ra</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 3: LỊCH SỬ BÀI THI & ĐIỂM SỐ
          ========================================================================= */}
      {activeTab === 'history' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Lịch sử bài thi & Kết quả khảo thí</h2>
                <p className="eg-dashboard-roster-description">
                  Xem lại điểm số, kết quả chấm tự động của backend và thời gian nộp bài các lượt thi đã hoàn thành.
                </p>
              </div>
              <span className="eg-dashboard-roster-count">{recentAttempts.length} bài thi</span>
            </div>

            <div className="eg-dashboard-roster-scroll">
              <table className="eg-dashboard-roster-table">
                <thead>
                  <tr>
                    <th>Mã ca thi</th>
                    <th>Tên bài thi & Môn học</th>
                    <th>Thời gian nộp bài</th>
                    <th>Điểm số</th>
                    <th>Xếp loại</th>
                    <th>Trạng thái</th>
                    <th>Vi phạm AI</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttempts.map((att) => {
                    const attId = att.attempt_id || att.id;
                    const vCount = Number(att.violation_count || 0);
                    return (
                      <tr key={attId}>
                        <td>
                          <span className="eg-session-code-tag">{att.session_code || `ATT_${attId}`}</span>
                        </td>
                        <td>
                          <strong>{att.exam_title || 'Bài thi trắc nghiệm'}</strong>
                          <div className="eg-table-subtext">{att.subject_name}</div>
                        </td>
                        <td>{att.submit_time ? new Date(att.submit_time).toLocaleString('vi-VN') : '—'}</td>
                        <td>
                          <strong style={{ fontSize: '15px', color: Number(att.total_score) >= 5.0 ? '#16a34a' : '#b42318' }}>
                            {att.total_score != null ? `${att.total_score}đ` : '—'}
                          </strong>
                        </td>
                        <td>
                          <span className={`eg-mini-badge ${Number(att.total_score) >= 5.0 ? 'is-easy' : 'is-hard'}`}>
                            {Number(att.total_score) >= 5.0 ? '✓ Đạt yêu cầu' : 'Chưa đạt'}
                          </span>
                        </td>
                        <td>
                          <span className={`eg-status-tag ${att.status === 'SUBMITTED' ? 'is-completed' : 'is-open'}`}>
                            {att.status_label || (att.status === 'SUBMITTED' ? 'Đã hoàn thành' : 'Đang làm bài')}
                          </span>
                        </td>
                        <td>
                          {vCount > 0 ? (
                            <span className="eg-mini-badge is-hard" title={`${vCount} lần bị giám sát AI cảnh báo`}>
                              ⚠️ {vCount} lần
                            </span>
                          ) : (
                            <span className="eg-mini-badge is-easy">
                              ✓ 0 vi phạm
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="eg-session-btn-edit"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setSelectedAttemptId(attId)}
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 4: KIỂM TRA THIẾT BỊ & QUY CHẾ THI AN TOÀN
          ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="eg-tab-content">
          <div className="eg-dashboard-grid">
            {/* Box 1: Kiểm tra phần cứng Webcam & Mic */}
            <div className="eg-panel">
              <h2 className="eg-dashboard-section-title">Kiểm tra Camera & Microphone</h2>
              <p className="eg-dashboard-roster-description" style={{ marginBottom: '14px' }}>
                Hệ thống yêu cầu bật Camera để giám sát khuôn mặt AI. Hãy kiểm tra thử trước khi vào phòng thi.
              </p>

              <div className="eg-device-preview-wrap">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`eg-device-video ${cameraActive ? 'is-active' : ''}`}
                />
                {!cameraActive && (
                  <div className="eg-device-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                      <path d="M23 7l-7 5 7 5V7z" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                    <span>Camera đang tắt. Bấm nút dưới để kiểm tra thử nghiệm.</span>
                  </div>
                )}
              </div>

              {cameraError && <div className="eg-modal-alert-error" style={{ marginTop: '10px' }}>{cameraError}</div>}

              <div className="eg-device-actions">
                {!cameraActive ? (
                  <button type="button" className="eg-primary-btn" onClick={startCameraTest}>
                    Bật Camera thử nghiệm
                  </button>
                ) : (
                  <button type="button" className="eg-btn-cancel" onClick={stopCameraTest}>
                    Tắt Camera
                  </button>
                )}
              </div>
            </div>

            {/* Box 2: Hướng dẫn quy chế phòng thi an toàn */}
            <div className="eg-panel">
              <h2 className="eg-dashboard-section-title">Quy chế phòng thi chống gian lận (ExamGuard AI)</h2>
              <ul className="eg-rules-checklist">
                <li>
                  <div className="eg-rule-icon ok">✓</div>
                  <div>
                    <strong>Luôn giữ khuôn mặt trong khung hình camera:</strong>
                    <p>Hệ thống AI sẽ quét so khớp khuôn mặt định kỳ. Tránh cúi đầu quá thấp hoặc che mặt.</p>
                  </div>
                </li>
                <li>
                  <div className="eg-rule-icon ok">✓</div>
                  <div>
                    <strong>Không có người thứ hai trong phòng:</strong>
                    <p>Cảnh báo vi phạm `MULTIPLE_FACES` sẽ được gửi ngay đến giám thị nếu phát hiện thêm người.</p>
                  </div>
                </li>
                <li>
                  <div className="eg-rule-icon ok">✓</div>
                  <div>
                    <strong>Không chuyển tab hoặc mở ứng dụng ngoài:</strong>
                    <p>Hệ thống tự động phát hiện chuyển tab (`TAB_SWITCH`) và đếm số lần vi phạm.</p>
                  </div>
                </li>
                <li>
                  <div className="eg-rule-icon ok">✓</div>
                  <div>
                    <strong>Bắt buộc chế độ toàn màn hình (Fullscreen):</strong>
                    <p>Không thoát toàn màn hình trước khi hoàn thành và bấm nộp bài.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
      </main>

      {/* MODAL ĐỔI MẬT KHẨU */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        token={studentInfo.token}
        userType="STUDENT"
        userInfo={{
          username: studentInfo.username,
          full_name: studentInfo.full_name,
          role_name: studentInfo.role_name
        }}
      />

      {/* MODAL CHI TIẾT BÀI THI & VI PHẠM */}
      <AttemptDetailModal
        isOpen={Boolean(selectedAttemptId)}
        onClose={() => setSelectedAttemptId(null)}
        attemptId={selectedAttemptId}
        token={studentInfo.token}
      />
    </div>
  );
}
