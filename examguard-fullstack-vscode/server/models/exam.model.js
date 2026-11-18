/**
 * Lớp truy cập dữ liệu kết hợp MySQL (bảng users, exams, exam_sessions, questions, answers,
 * exam_attempts, attempt_details, proctoring_logs) và bộ nhớ đệm dự phòng nếu MySQL chưa bật.
 */
const pool = require('../config/db');

const fallbackStore = {
  users: [
    {
      id: 1,
      role_id: 2,
      role_name: 'TEACHER',
      username: 'anhpt',
      full_name: 'Thế Anh',
      email: 'anhpt@haui.edu.vn',
      face_embedding: null
    },
    {
      id: 2,
      role_id: 3,
      role_name: 'STUDENT',
      username: '2024603201',
      full_name: 'Bùi Minh Nhật',
      email: 'nhatbm.2024603201@haui.edu.vn',
      face_embedding: '[0.124, -0.082, 0.311, 0.045, -0.192, 0.278, 0.091, -0.144]'
    },
    {
      id: 3,
      role_id: 3,
      role_name: 'STUDENT',
      username: '2024604243',
      full_name: 'Trần Văn Trung',
      email: 'trungtv.2024604243@haui.edu.vn',
      face_embedding: '[0.124, -0.082, 0.311, 0.045, -0.192, 0.278, 0.091, -0.144]'
    },
    {
      id: 4,
      role_id: 3,
      role_name: 'STUDENT',
      username: '2024604304',
      full_name: 'Trần Hoàng Nam',
      email: 'namth.2024604304@haui.edu.vn',
      face_embedding: null
    },
    {
      id: 5,
      role_id: 3,
      role_name: 'STUDENT',
      username: '2024603775',
      full_name: 'Trịnh Đình Mạnh',
      email: 'manhtd.2024603775@haui.edu.vn',
      face_embedding: null
    },
    {
      id: 6,
      role_id: 3,
      role_name: 'STUDENT',
      username: '2024603200',
      full_name: 'Nhữ Quốc Trường',
      email: 'truongnq.2024603200@haui.edu.vn',
      face_embedding: null
    },
    {
      id: 7,
      role_id: 2,
      role_name: 'TEACHER',
      username: 'GV001',
      full_name: 'TS. Nguyễn Văn Giám Thị',
      email: 'gv001@examguard.edu.vn',
      face_embedding: null
    },
    {
      id: 8,
      role_id: 2,
      role_name: 'TEACHER',
      username: 'ThsPhamTheAnh',
      full_name: 'ThS. Phạm Thế Anh',
      email: 'thsphamtheanh@examguard.edu.vn',
      face_embedding: null
    }
  ],
  session: {
    id: 1,
    exam_id: 1,
    session_code: 'EXAM88',
    title: 'Kiểm tra giữa kỳ: An toàn thông tin & Khảo thí AI',
    subject_code: 'IT4010',
    subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
    duration_minutes: 30,
    total_questions: 5,
    passing_score: 5.0,
    shuffle_questions: 1,
    shuffle_answers: 1,
    is_active: 1
  },
  subjects: [
    {
      id: 1,
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      description: 'Khảo thí kiến thức bảo mật mạng, mật mã học và giám sát gian lận thi cử',
      total_questions: 3,
      created_at: '2026-10-01'
    },
    {
      id: 2,
      subject_code: 'IT6012',
      subject_name: 'Công nghệ Web & Frameworks',
      description: 'Lập trình ứng dụng web full-stack, RESTful API và kiến trúc Single Page App',
      total_questions: 1,
      created_at: '2026-10-05'
    },
    {
      id: 3,
      subject_code: 'IT6025',
      subject_name: 'Hệ quản trị Cơ sở dữ liệu',
      description: 'Thiết kế CSDL quan hệ, tối ưu câu lệnh SQL, transaction và bảo toàn toàn vẹn dữ liệu',
      total_questions: 1,
      created_at: '2026-10-10'
    }
  ],
  exams: [
    {
      id: 1,
      exam_code: 'EX_SEC_MID_2026',
      title: 'Đề thi Giữa kỳ: An toàn thông tin & Khảo thí AI',
      subject_id: 1,
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      duration_minutes: 30,
      total_questions: 20,
      passing_score: 5.0,
      shuffle_questions: true,
      shuffle_answers: true,
      easy_count: 8,
      medium_count: 8,
      hard_count: 4,
      variants_count: 4,
      status: 'ACTIVE',
      created_at: '2026-11-01'
    },
    {
      id: 2,
      exam_code: 'EX_WEB_FINAL_2026',
      title: 'Đề thi Kết thúc học phần: Lập trình Web Fullstack',
      subject_id: 2,
      subject_code: 'IT6012',
      subject_name: 'Công nghệ Web & Frameworks',
      duration_minutes: 60,
      total_questions: 40,
      passing_score: 5.0,
      shuffle_questions: true,
      shuffle_answers: true,
      easy_count: 15,
      medium_count: 15,
      hard_count: 10,
      variants_count: 4,
      status: 'ACTIVE',
      created_at: '2026-11-05'
    },
    {
      id: 3,
      exam_code: 'EX_DB_PERIODIC_2026',
      title: 'Đề kiểm tra Định kỳ: Hệ quản trị Cơ sở dữ liệu',
      subject_id: 3,
      subject_code: 'IT6025',
      subject_name: 'Hệ quản trị Cơ sở dữ liệu',
      duration_minutes: 45,
      total_questions: 30,
      passing_score: 5.0,
      shuffle_questions: true,
      shuffle_answers: false,
      easy_count: 12,
      medium_count: 12,
      hard_count: 6,
      variants_count: 2,
      status: 'DRAFT',
      created_at: '2026-11-08'
    }
  ],
  sessions: [
    {
      id: 1,
      session_code: 'EXAM88',
      title: 'Kiểm tra giữa kỳ: An toàn thông tin & Khảo thí AI',
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      exam_date: '12/11/2026',
      time_range: '08:00 - 08:30',
      duration_minutes: 30,
      total_questions: 5,
      passing_score: 5.0,
      status: 'OPEN',
      status_label: 'Đang mở / Đang thi',
      total_students: 8,
      in_progress_count: 1,
      submitted_count: 1
    },
    {
      id: 2,
      session_code: 'IT6012_WEB',
      title: 'Thi kết thúc học phần: Lập trình Web nâng cao',
      subject_code: 'IT6012',
      subject_name: 'Công nghệ Web & Frameworks',
      exam_date: '15/11/2026',
      time_range: '09:00 - 10:30',
      duration_minutes: 90,
      total_questions: 40,
      passing_score: 5.0,
      status: 'UPCOMING',
      status_label: 'Sắp diễn ra',
      total_students: 45,
      in_progress_count: 0,
      submitted_count: 0
    },
    {
      id: 3,
      session_code: 'IT6025_CSDL',
      title: 'Khảo thí đánh giá định kỳ: Hệ quản trị Cơ sở dữ liệu',
      subject_code: 'IT6025',
      subject_name: 'Cơ sở dữ liệu nâng cao',
      exam_date: '08/11/2026',
      time_range: '14:00 - 15:00',
      duration_minutes: 60,
      total_questions: 30,
      passing_score: 5.0,
      status: 'COMPLETED',
      status_label: 'Đã hoàn thành',
      total_students: 42,
      in_progress_count: 0,
      submitted_count: 42
    }
  ],
  questions: [
    {
      id: 1,
      question_code: 'Q_AI_01',
      subject_id: 1,
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      content: 'Trong hệ thống giám sát thi trực tuyến ExamGuard, độ đo khoảng cách nào được lưu trong bảng proctoring_logs để so khớp vector đặc trưng khuôn mặt (face_embedding)?',
      difficulty_level: 'EASY',
      answers: [
        { id: 1, answer_text: 'Khoảng cách Euclidean (Euclidean Distance)', is_correct: true },
        { id: 2, answer_text: 'Thuật toán nén Huffman', is_correct: false },
        { id: 3, answer_text: 'Giao thức định tuyến OSPF', is_correct: false },
        { id: 4, answer_text: 'Chuẩn mã hóa đối xứng AES-256', is_correct: false }
      ]
    },
    {
      id: 2,
      question_code: 'Q_SEC_02',
      subject_id: 1,
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      content: 'Cơ chế nào trên trình duyệt giúp phát hiện thí sinh chuyển sang tab khác hoặc thu nhỏ cửa sổ làm bài?',
      difficulty_level: 'EASY',
      answers: [
        { id: 5, answer_text: 'Page Visibility API (sự kiện visibilitychange) kết hợp window blur/focus', is_correct: true },
        { id: 6, answer_text: 'Giao thức truyền file FTP', is_correct: false },
        { id: 7, answer_text: 'Thẻ meta viewport trong HTML', is_correct: false },
        { id: 8, answer_text: 'Bộ chọn CSS media query', is_correct: false }
      ]
    },
    {
      id: 3,
      question_code: 'Q_API_03',
      subject_id: 2,
      subject_code: 'IT6012',
      subject_name: 'Công nghệ Web & Frameworks',
      content: 'Vì sao tuyệt đối không được gửi trường is_correct của bảng answers về phía trình duyệt của thí sinh khi đang làm bài?',
      difficulty_level: 'MEDIUM',
      answers: [
        { id: 9, answer_text: 'Vì thí sinh có thể mở DevTools (Network/Inspect) để đọc JSON response và biết ngay đáp án đúng', is_correct: true },
        { id: 10, answer_text: 'Vì trường BOOLEAN làm tăng dung lượng gói tin lên gấp 10 lần', is_correct: false },
        { id: 11, answer_text: 'Vì MySQL không cho phép truy vấn cột BOOLEAN qua Node.js', is_correct: false },
        { id: 12, answer_text: 'Vì React không hiển thị được dữ liệu kiểu BOOLEAN', is_correct: false }
      ]
    },
    {
      id: 4,
      question_code: 'Q_FACE_04',
      subject_id: 1,
      subject_code: 'IT4010',
      subject_name: 'An toàn và Bảo mật Hệ thống Thông tin',
      content: 'Khi phát hiện 2 khuôn mặt trong khung hình camera (MULTIPLE_FACES), luồng xử lý chuẩn của hệ thống là gì?',
      difficulty_level: 'MEDIUM',
      answers: [
        { id: 13, answer_text: 'AI Service trả về cảnh báo MULTIPLE_FACES, Backend lưu vào bảng proctoring_logs kèm ảnh bằng chứng và phát sự kiện Socket.IO cho Giám thị', is_correct: true },
        { id: 14, answer_text: 'Tự động xóa cơ sở dữ liệu MySQL', is_correct: false },
        { id: 15, answer_text: 'Tự động cộng thêm 10 điểm cho thí sinh', is_correct: false },
        { id: 16, answer_text: 'Tắt máy tính của giám thị', is_correct: false }
      ]
    },
    {
      id: 5,
      question_code: 'Q_DB_05',
      subject_id: 3,
      subject_code: 'IT6025',
      subject_name: 'Hệ quản trị Cơ sở dữ liệu',
      content: 'Ràng buộc UNIQUE (user_id, session_id) trong bảng exam_attempts có tác dụng gì?',
      difficulty_level: 'HARD',
      answers: [
        { id: 17, answer_text: 'Đảm bảo mỗi sinh viên chỉ được tạo tối đa 1 lượt thi trong cùng một ca thi (session_id)', is_correct: true },
        { id: 18, answer_text: 'Cho phép nhiều sinh viên dùng chung một tài khoản cùng lúc', is_correct: false },
        { id: 19, answer_text: 'Tự động xóa câu hỏi sau khi nộp bài', is_correct: false },
        { id: 20, answer_text: 'Ngăn giảng viên tạo nhiều ca thi cho một đề thi', is_correct: false }
      ]
    }
  ],
  attempts: [
    {
      id: 101,
      user_id: 3,
      session_id: 3,
      session_code: 'IT6025_CSDL',
      exam_title: 'Khảo thí đánh giá định kỳ: Hệ quản trị Cơ sở dữ liệu',
      subject_name: 'Cơ sở dữ liệu nâng cao',
      subject_code: 'IT6025',
      start_time: '2026-11-08T14:00:00Z',
      submit_time: '2026-11-08T14:45:00Z',
      total_score: 9.0,
      total_questions: 5,
      correct_count: 5,
      status: 'SUBMITTED',
      status_label: 'Đã hoàn thành',
      passed: true,
      violation_count: 0
    },
    {
      id: 102,
      user_id: 3,
      session_id: 2,
      session_code: 'IT6012_WEB',
      exam_title: 'Kiểm tra Chuyên đề: Kiến trúc SPA & RESTful API',
      subject_name: 'Công nghệ Web & Frameworks',
      subject_code: 'IT6012',
      start_time: '2026-11-01T08:30:00Z',
      submit_time: '2026-11-01T09:20:00Z',
      total_score: 8.5,
      total_questions: 5,
      correct_count: 4,
      status: 'SUBMITTED',
      status_label: 'Đã hoàn thành',
      passed: true,
      violation_count: 1
    }
  ],
  attemptDetails: {
    101: { 1: 1, 2: 5, 3: 9, 4: 13, 5: 17 },
    102: { 1: 1, 2: 5, 3: 9, 4: 13, 5: 18 }
  },
  proctoringLogs: [
    {
      id: 101,
      attempt_id: 1,
      student_code: 'SV2026001',
      full_name: 'Minh Nhật',
      violation_type: 'MULTIPLE_FACES',
      euclidean_distance: 0.68,
      evidence_image_path: '/uploads/evidence_two_faces_demo.jpg',
      timestamp: new Date().toISOString()
    }
  ],
  checkinRequests: [
    {
      id: 1,
      student_id: 2,
      student_code: '2024603201',
      full_name: 'Bùi Minh Nhật',
      session_code: 'EXAM88',
      session_title: 'Kiểm tra giữa kỳ: An toàn thông tin & Khảo thí AI',
      snapshot_url: '/uploads/evidence_default.jpg',
      mic_ready: true,
      camera_ready: true,
      face_count: 1,
      euclidean_distance: 0.25,
      status: 'APPROVED',
      created_at: new Date().toISOString()
    }
  ],
  supportRequests: [
    {
      id: 1,
      student_code: '2024604243',
      full_name: 'Trần Văn Trung',
      session_code: 'EXAM203',
      category: 'REENTRY_REQUEST',
      message: 'Em bị rớt mạng chập chờn, xin thầy/cô hỗ trợ duyệt cho em tiếp tục làm bài thi.',
      status: 'PENDING',
      reply_message: null,
      created_at: new Date().toISOString()
    }
  ]
};

async function findStudentAndSession(studentCode, sessionCode) {
  try {
    const [userRows] = await pool.query(
      `SELECT u.*, r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = ? LIMIT 1`,
      [studentCode]
    );
    const [sessionRows] = await pool.query(
      `SELECT es.id AS session_id, es.session_code, es.start_time, es.end_time, es.is_active,
              e.id AS exam_id, e.title, e.duration_minutes, e.total_questions, e.passing_score,
              e.shuffle_questions, e.shuffle_answers,
              s.subject_code, s.subject_name
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE es.session_code = ? AND es.is_active = TRUE LIMIT 1`,
      [sessionCode]
    );
    return {
      user: userRows[0] || null,
      session: sessionRows[0] || null,
      dbConnected: true
    };
  } catch (err) {
    const user = fallbackStore.users.find(u => u.username.toUpperCase() === studentCode.toUpperCase()) || null;
    const session = fallbackStore.session.session_code.toUpperCase() === sessionCode.toUpperCase()
      ? {
          session_id: fallbackStore.session.id,
          ...fallbackStore.session
        }
      : null;
    return { user, session, dbConnected: false };
  }
}

module.exports = {
  pool,
  fallbackStore,
  findStudentAndSession
};
