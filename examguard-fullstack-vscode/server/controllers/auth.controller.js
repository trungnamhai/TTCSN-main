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
         WHERE (u.username = ? OR LOWER(u.username) = LOWER(?)) AND UPPER(r.role_name) IN ('TEACHER', 'GIANGVIEN', 'ADMIN')
         LIMIT 1`,
        [username.trim(), username.trim()],
      );
      user = users[0];
    } catch (dbErr) {
      console.warn("Lỗi truy vấn CSDL giáo viên:", dbErr.message);
    }

    if (!user) {
      user = fallbackStore.users.find(
        (u) =>
          u.username.toUpperCase() === username.trim().toUpperCase() &&
          ['TEACHER', 'GIANGVIEN', 'ADMIN'].includes((u.role_name || '').toUpperCase()),
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

    const roleName = (user.role_name || 'TEACHER').toUpperCase();
    const token = jwt.sign(
      { id: user.id, username: user.username, role_name: roleName, full_name: user.full_name },
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

    const roleName = (user.role_name || 'TEACHER').toUpperCase();
    const token = jwt.sign(
      { id: user.id, username: user.username, role_name: roleName, full_name: user.full_name },
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

/**
 * Đăng ký tài khoản thí sinh mới (Student Registration)
 */
exports.register = async (req, res) => {
  try {
    const { username, full_name, email, password, confirmPassword } = req.body;

    if (!username?.trim() || !password || !full_name?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ Mã sinh viên / Tên đăng nhập, Họ và tên, và Mật khẩu.",
      });
    }

    const cleanUsername = username.trim();
    const cleanFullName = full_name.trim();
    const cleanEmail = email?.trim() || `${cleanUsername.toLowerCase()}@examguard.edu.vn`;

    if (password.length < 6) {
      return res.status(400).json({
        message: "Mật khẩu phải có tối thiểu 6 ký tự.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        message: "Mật khẩu xác nhận không khớp.",
      });
    }

    // Kiểm tra xem tài khoản đã tồn tại chưa
    let existingUser = null;
    try {
      const [users] = await pool.query(
        `SELECT id, username FROM users WHERE username = ? OR email = ? LIMIT 1`,
        [cleanUsername, cleanEmail]
      );
      if (users && users.length > 0) {
        existingUser = users[0];
      }
    } catch (dbErr) {
      console.warn("Lỗi kiểm tra CSDL khi đăng ký:", dbErr.message);
    }

    if (!existingUser) {
      existingUser = fallbackStore.users.find(
        (u) => u.username.toUpperCase() === cleanUsername.toUpperCase()
      );
    }

    if (existingUser) {
      return res.status(400).json({
        message: `Tài khoản "${cleanUsername}" đã tồn tại trong hệ thống. Vui lòng đăng nhập hoặc chọn tên khác.`,
      });
    }

    // Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    let newUserId = Date.now();
    try {
      // Tìm role_id của STUDENT
      const [roles] = await pool.query(
        `SELECT id FROM roles WHERE role_name = 'STUDENT' LIMIT 1`
      );
      const roleId = roles && roles.length > 0 ? roles[0].id : 3;

      const [insertRes] = await pool.query(
        `INSERT INTO users (username, password_hash, full_name, email, role_id)
         VALUES (?, ?, ?, ?, ?)`,
        [cleanUsername, hashedPassword, cleanFullName, cleanEmail, roleId]
      );
      if (insertRes && insertRes.insertId) {
        newUserId = insertRes.insertId;
      }
    } catch (insertErr) {
      console.warn("Lưu MySQL thất bại, lưu vào bộ nhớ dự phòng:", insertErr.message);
    }

    // Thêm vào fallbackStore
    fallbackStore.users.push({
      id: newUserId,
      role_id: 3,
      role_name: 'STUDENT',
      username: cleanUsername,
      full_name: cleanFullName,
      email: cleanEmail,
      password_hash: hashedPassword,
      face_embedding: null
    });

    return res.status(201).json({
      success: true,
      message: `Đăng ký tài khoản "${cleanUsername}" thành công! Bạn có thể đăng nhập để tham gia ca thi ngay bây giờ.`,
      user: {
        id: newUserId,
        username: cleanUsername,
        full_name: cleanFullName,
        email: cleanEmail,
        role_name: 'STUDENT'
      }
    });
  } catch (error) {
    console.error("Lỗi khi đăng ký tài khoản:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đăng ký tài khoản: " + error.message,
    });
  }
};

/**
 * Đổi mật khẩu trực tiếp bằng Tên đăng nhập / MSSV (Không cần đăng nhập trước)
 */
exports.publicChangePassword = async (req, res) => {
  try {
    const { username, currentPassword, newPassword, confirmPassword } = req.body;

    if (!username?.trim() || !currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ Tên đăng nhập/Mã SV, Mật khẩu hiện tại và Mật khẩu mới.",
      });
    }

    const cleanUsername = username.trim();

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
        `SELECT id, username, password_hash, full_name FROM users WHERE username = ? LIMIT 1`,
        [cleanUsername]
      );
      user = users && users[0];
    } catch (dbErr) {
      dbConnected = false;
    }

    if (!user) {
      user = fallbackStore.users.find(
        (u) => u.username.toUpperCase() === cleanUsername.toUpperCase()
      );
    }

    if (!user) {
      return res.status(404).json({
        message: `Không tìm thấy tài khoản "${cleanUsername}" trong hệ thống.`,
      });
    }

    // So khớp mật khẩu cũ
    let isMatch = false;
    if (user.password_hash) {
      if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
        isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      } else {
        isMatch = user.password_hash === currentPassword;
      }
    } else {
      isMatch = currentPassword === "123456789";
    }

    if (!isMatch) {
      return res.status(400).json({
        message: "Mật khẩu hiện tại không chính xác.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (dbConnected && pool) {
      try {
        await pool.query(
          `UPDATE users SET password_hash = ? WHERE username = ?`,
          [hashedPassword, user.username]
        );
      } catch (err) {
        console.warn("Lỗi update MySQL:", err.message);
      }
    }

    user.password_hash = hashedPassword;

    return res.status(200).json({
      success: true,
      message: `Đổi mật khẩu cho tài khoản "${cleanUsername}" thành công! Vui lòng sử dụng mật khẩu mới để đăng nhập.`,
    });
  } catch (error) {
    console.error("Lỗi khi đổi mật khẩu công khai:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đổi mật khẩu: " + error.message,
    });
  }
};
