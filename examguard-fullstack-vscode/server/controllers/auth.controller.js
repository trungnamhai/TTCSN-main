const pool = require("../config/db");
const jwt = require("jsonwebtoken");

exports.loginExam = async (req, res) => {
  try {
    const { studentCode, sessionCode } = req.body;

    if (!studentCode || !sessionCode) {
      return res
        .status(400)
        .json({
          message: "Vui lòng nhập đầy đủ Mã sinh viên và Mật khẩu / Mã ca thi.",
        });
    }

    // 1. Tìm sinh viên trong bảng users theo mã sinh viên (username)
    const [users] = await pool.query(
      `SELECT u.*, r.role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.username = ? LIMIT 1`,
      [studentCode.trim()],
    );

    if (users.length === 0) {
      return res
        .status(401)
        .json({ message: "Mã sinh viên không tồn tại trong hệ thống." });
    }

    const user = users[0];

    // 2. Kiểm tra mật khẩu (123456789) hoặc mã ca thi
    const [sessions] = await pool.query(
      `SELECT es.*, e.title, e.duration_minutes, e.total_questions, s.subject_name, s.subject_code
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE es.session_code = ? AND es.is_active = TRUE
       LIMIT 1`,
      [sessionCode.trim()],
    );

    const isPasswordMatch = user.password_hash === sessionCode.trim();
    if (sessions.length === 0 && !isPasswordMatch) {
      return res
        .status(401)
        .json({ message: "Mật khẩu hoặc mã ca thi không chính xác." });
    }

    const currentSession = sessions[0] || {
      id: 1,
      session_code: "123456789",
      title: "Thiết kế Web",
    };

    // 3. Lấy danh sách các kỳ thi sắp tới từ CSDL
    const [upcomingRows] = await pool.query(
      `SELECT 
         es.id AS session_id,
         es.session_code,
         e.title,
         s.subject_name,
         s.subject_code,
         DATE_FORMAT(es.start_time, '%d/%m/%Y') AS exam_date,
         CONCAT(DATE_FORMAT(es.start_time, '%H:%i'), ' - ', DATE_FORMAT(es.end_time, '%H:%i')) AS time_range,
         e.duration_minutes,
         es.is_active
       FROM exam_sessions es
       JOIN exams e ON es.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE es.is_active = TRUE
       ORDER BY es.start_time ASC`,
    );

    const upcomingExams = upcomingRows.map((row, idx) => ({
      ...row,
      icon_type: idx === 0 ? "code" : idx === 1 ? "math" : "lang",
    }));

    // 4. Lấy kết quả học tập gần đây của đúng sinh viên đang đăng nhập
    const [attemptRows] = await pool.query(
      `SELECT 
         ea.id AS attempt_id,
         e.title AS exam_title,
         s.subject_name,
         DATE_FORMAT(ea.submit_time, '%d/%m/%Y %H:%i') AS submit_time,
         ea.total_score,
         ea.status
       FROM exam_attempts ea
       JOIN exam_sessions es ON ea.session_id = es.id
       JOIN exams e ON es.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE ea.user_id = ? AND ea.status = 'SUBMITTED'
       ORDER BY ea.submit_time DESC`,
      [user.id],
    );

    const recentAttempts = attemptRows.map((r) => ({
      ...r,
      status_label: r.status === "SUBMITTED" ? "Đã chấm" : "Đang chấm",
    }));

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role_name },
      process.env.JWT_SECRET || "examguard_secret_key_2026",
      { expiresIn: "8h" },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        studentCode: user.username,
        full_name: user.full_name,
        email: user.email,
        profile_image_url: user.profile_image_url,
        role_name: user.role_name,
      },
      session: currentSession,
      upcomingExams,
      recentAttempts,
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return res
      .status(500)
      .json({ message: "Lỗi kết nối CSDL: " + error.message });
  }
};
