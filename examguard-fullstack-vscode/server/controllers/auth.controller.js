const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { JWT_SECRET } = require("../middlewares/auth.middleware");
const { fallbackStore } = require("../models/exam.model");

exports.loginTeacher = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
      });
    }

    let user = null;
    try {
      const [users] = await pool.query(
        `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.username = ? AND r.role_name = 'TEACHER'
         LIMIT 1`,
        [username.trim()],
      );
      user = users[0];
    } catch (dbErr) {
      console.warn("Lỗi truy vấn CSDL giáo viên:", dbErr.message);
    }

    if (!user) {
      user = fallbackStore.users.find(
        (u) =>
          u.username.toUpperCase() === username.trim().toUpperCase() &&
          u.role_name === "TEACHER",
      );
    }

    if (!user) {
      return res
        .status(401)
        .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác." });
    }

    let isPasswordMatch = false;
    if (user.password_hash) {
      if (
        user.password_hash.startsWith("$2a$") ||
        user.password_hash.startsWith("$2b$")
      ) {
        isPasswordMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        isPasswordMatch =
          user.password_hash === password ||
          (await bcrypt.compare(password, user.password_hash).catch(() => false));
      }
    } else {
      isPasswordMatch = password === "123456789";
    }

    if (!isPasswordMatch) {
      return res
        .status(401)
        .json({ message: "Tên đăng nhập hoặc mật khẩu không chính xác." });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role_name: user.role_name, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    return res.json({
      token,
      teacher: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role_name: user.role_name,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập giáo viên:", error);
    return res.status(500).json({ message: "Không thể đăng nhập lúc này." });
  }
};

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

    let isPasswordMatch = false;
    if (user.password_hash) {
      if (
        user.password_hash.startsWith("$2a$") ||
        user.password_hash.startsWith("$2b$")
      ) {
        isPasswordMatch = await bcrypt.compare(sessionCode.trim(), user.password_hash);
      } else {
        isPasswordMatch =
          user.password_hash === sessionCode.trim() ||
          (await bcrypt.compare(sessionCode.trim(), user.password_hash).catch(() => false));
      }
    } else {
      isPasswordMatch = sessionCode.trim() === "123456789";
    }

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
      { id: user.id, username: user.username, role_name: user.role_name, full_name: user.full_name },
      JWT_SECRET,
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

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id;
    const username = req.user?.username;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu mới phải có tối thiểu 6 ký tự.",
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Xác nhận mật khẩu mới không khớp.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại.",
      });
    }

    let user = null;
    let dbConnected = true;

    try {
      const [users] = await pool.query(
        `SELECT u.id, u.username, u.password_hash, r.role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? OR u.username = ?
         LIMIT 1`,
        [userId || 0, username || ""],
      );
      user = users && users[0];
    } catch (dbErr) {
      console.warn("Lỗi truy vấn CSDL:", dbErr.message);
      dbConnected = false;
    }

    // Nếu không tìm thấy trong CSDL hoặc CSDL offline, tìm trong fallbackStore
    if (!user) {
      user = fallbackStore.users.find(
        (u) =>
          (userId && u.id === userId) ||
          (username && u.username.toUpperCase() === username.toUpperCase()),
      );
    }

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy thông tin tài khoản người dùng.",
      });
    }

    // So khớp mật khẩu hiện tại
    let isMatch = false;
    if (user.password_hash) {
      if (
        user.password_hash.startsWith("$2a$") ||
        user.password_hash.startsWith("$2b$")
      ) {
        isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      } else {
        isMatch =
          user.password_hash === currentPassword ||
          (await bcrypt.compare(currentPassword, user.password_hash).catch(() => false));
      }
    } else {
      isMatch = currentPassword === "123456789";
    }

    if (!isMatch) {
      return res.status(400).json({
        message: "Mật khẩu hiện tại không chính xác.",
      });
    }

    // Băm mật khẩu mới với bcrypt (salt rounds = 10)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Cập nhật vào CSDL nếu có kết nối
    if (dbConnected && pool) {
      try {
        await pool.query(
          `UPDATE users SET password_hash = ? WHERE id = ? OR username = ?`,
          [hashedPassword, user.id, user.username],
        );
      } catch (updateErr) {
        console.warn("Không thể cập nhật MySQL:", updateErr.message);
      }
    }

    // Cập nhật bộ nhớ dự phòng
    user.password_hash = hashedPassword;

    return res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.",
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đổi mật khẩu: " + error.message,
    });
  }
};
