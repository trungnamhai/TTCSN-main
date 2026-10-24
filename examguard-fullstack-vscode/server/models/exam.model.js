/**
 * Lớp truy cập dữ liệu kết hợp MySQL (bảng users, exams, exam_sessions, questions, answers,
 * exam_attempts, attempt_details, proctoring_logs) và bộ nhớ đệm dự phòng nếu MySQL chưa bật.
 */
const pool = require('../config/db');

const fallbackStore = {
  users: [
    {
      id: 3,
      role_id: 3,
      role_name: 'STUDENT',
      username: 'SV2026001',
      full_name: 'Minh Nhật',
      email: 'sv2026001@student.edu.vn',
      face_embedding: '[0.124, -0.082, 0.311, 0.045, -0.192, 0.278, 0.091, -0.144]'
    },
    {
      id: 2,
      role_id: 2,
      role_name: 'TEACHER',
      username: 'GV001',
      full_name: 'TS. Nguyễn Văn Giám Thị',
      email: 'gv001@examguard.edu.vn',
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
  questions: [
    {
      id: 1,
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
  attempts: [],
  attemptDetails: {},
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
