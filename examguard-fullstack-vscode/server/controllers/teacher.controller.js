const { pool, fallbackStore } = require('../models/exam.model');
const studentPresence = require('../services/student-presence');
const bcrypt = require('bcrypt');

exports.getDashboardOverview = async (req, res) => {
  try {
    const [logs] = await pool.query(
      `SELECT pl.*, u.username AS student_code, u.full_name
       FROM proctoring_logs pl
       JOIN exam_attempts ea ON pl.attempt_id = ea.id
       JOIN users u ON ea.user_id = u.id
       ORDER BY pl.timestamp DESC LIMIT 50`
    );
    const [attempts] = await pool.query(
      `SELECT ea.*, u.username AS student_code, u.full_name, es.session_code
       FROM exam_attempts ea
       JOIN users u ON ea.user_id = u.id
       JOIN exam_sessions es ON ea.session_id = es.id
       ORDER BY ea.start_time DESC`
    );
    const [students] = await pool.query(
      `SELECT u.id, u.username AS student_code, u.full_name, u.email,
              latest_attempt.status AS exam_status,
              latest_attempt.start_time,
              latest_attempt.total_score,
              latest_session.session_code
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN exam_attempts latest_attempt
         ON latest_attempt.id = (
           SELECT ea.id
           FROM exam_attempts ea
           WHERE ea.user_id = u.id
           ORDER BY ea.start_time DESC, ea.id DESC
           LIMIT 1
         )
       LEFT JOIN exam_sessions latest_session
         ON latest_session.id = latest_attempt.session_id
       WHERE r.role_name = 'STUDENT'
       ORDER BY u.full_name ASC, u.id ASC`
    );
    return res.json({
      logs,
      attempts,
      students: students.map((student) => ({
        ...student,
        is_online: studentPresence.isOnline(student.student_code)
      })),
      questions: fallbackStore.questions,
      session: fallbackStore.session,
      source: 'MYSQL'
    });
  } catch (err) {
    console.warn('MySQL không khả dụng, sử dụng dữ liệu từ fallbackStore:', err.message);
    const fallbackStudents = fallbackStore.users
      .filter((u) => u.role_name === 'STUDENT')
      .map((u) => ({
        id: u.id,
        student_code: u.username,
        full_name: u.full_name,
        email: u.email,
        exam_status: 'Chưa thi',
        start_time: null,
        total_score: null,
        session_code: fallbackStore.session?.session_code || 'EXAM88',
        is_online: studentPresence.isOnline(u.username)
      }));

    return res.json({
      logs: fallbackStore.proctoringLogs || [],
      attempts: [],
      students: fallbackStudents,
      questions: fallbackStore.questions,
      session: fallbackStore.session,
      source: 'FALLBACK'
    });
  }
};

exports.getAssignedSessions = async (req, res) => {
  try {
    const { q, status } = req.query;

    let sessions = [];
    try {
      let sql = `
        SELECT 
           es.id AS session_id,
           es.session_code,
           e.title,
           e.total_questions,
           e.passing_score,
           s.subject_name,
           s.subject_code,
           es.start_time,
           es.end_time,
           DATE_FORMAT(es.start_time, '%d/%m/%Y') AS exam_date,
           CONCAT(DATE_FORMAT(es.start_time, '%H:%i'), ' - ', DATE_FORMAT(es.end_time, '%H:%i')) AS time_range,
           e.duration_minutes,
           es.is_active,
           COUNT(DISTINCT ea.id) AS total_attempts,
           SUM(CASE WHEN ea.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS in_progress_count,
           SUM(CASE WHEN ea.status = 'SUBMITTED' THEN 1 ELSE 0 END) AS submitted_count
         FROM exam_sessions es
         JOIN exams e ON es.exam_id = e.id
         JOIN subjects s ON e.subject_id = s.id
         LEFT JOIN exam_attempts ea ON ea.session_id = es.id
      `;
      const params = [];
      if (q && q.trim()) {
        sql += ` WHERE (es.session_code LIKE ? OR e.title LIKE ? OR s.subject_name LIKE ? OR s.subject_code LIKE ?)`;
        const term = `%${q.trim()}%`;
        params.push(term, term, term, term);
      }
      sql += ` GROUP BY es.id ORDER BY es.start_time DESC`;

      const [rows] = await pool.query(sql, params);
      sessions = rows.map((r) => ({
        id: r.session_id,
        session_id: r.session_id,
        session_code: r.session_code,
        title: r.title,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        exam_date: r.exam_date,
        time_range: r.time_range,
        duration_minutes: r.duration_minutes,
        total_questions: r.total_questions,
        passing_score: r.passing_score,
        status: r.is_active ? 'OPEN' : 'COMPLETED',
        status_label: r.is_active ? 'Đang mở' : 'Đã kết thúc',
        total_students: Number(r.total_attempts || 0),
        in_progress_count: Number(r.in_progress_count || 0),
        submitted_count: Number(r.submitted_count || 0)
      }));
    } catch (dbErr) {
      console.warn('MySQL không khả dụng trong getAssignedSessions, lấy từ fallbackStore:', dbErr.message);
      sessions = [...(fallbackStore.sessions || [])];
      if (q && q.trim()) {
        const lowerQ = q.trim().toLowerCase();
        sessions = sessions.filter(
          (s) =>
            s.session_code.toLowerCase().includes(lowerQ) ||
            s.title.toLowerCase().includes(lowerQ) ||
            s.subject_name.toLowerCase().includes(lowerQ) ||
            s.subject_code.toLowerCase().includes(lowerQ)
        );
      }
      if (status && status !== 'ALL') {
        sessions = sessions.filter((s) => s.status === status);
      }
    }

    return res.json({ sessions });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách ca thi:', err);
    return res.status(500).json({ message: 'Không thể tải danh sách ca thi: ' + err.message });
  }
};

exports.createSession = async (req, res) => {
  try {
    const {
      session_code,
      exam_id,
      title,
      room = 'Phòng thi Trực tuyến 01',
      exam_date,
      time_range,
      start_time,
      end_time,
      duration_minutes = 60,
      security_config = {}
    } = req.body;

    if (!session_code || !session_code.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập mã phòng thi / ca thi.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tiêu đề ca thi.' });
    }

    const trimmedCode = session_code.trim().toUpperCase();
    const trimmedTitle = title.trim();

    // Kiểm tra trùng mã ca thi trong fallback
    const existsInFallback = (fallbackStore.sessions || []).some(
      (s) => s.session_code.toUpperCase() === trimmedCode
    );
    if (existsInFallback) {
      return res.status(409).json({ message: `Mã ca thi "${trimmedCode}" đã tồn tại trong hệ thống.` });
    }

    let createdId = Date.now();
    let linkedExam = null;
    if (exam_id) {
      linkedExam = (fallbackStore.exams || []).find((e) => String(e.id) === String(exam_id));
    }

    const finalSecurity = {
      require_face_check: security_config.require_face_check !== false,
      max_face_distance: parseFloat(security_config.max_face_distance) || 0.60,
      detect_multiple_faces: security_config.detect_multiple_faces !== false,
      detect_tab_switch: security_config.detect_tab_switch !== false,
      require_fullscreen: security_config.require_fullscreen !== false,
      prevent_copy_paste: security_config.prevent_copy_paste !== false,
      max_violations: parseInt(security_config.max_violations, 10) || 3
    };

    try {
      const [check] = await pool.query(`SELECT id FROM exam_sessions WHERE session_code = ? LIMIT 1`, [trimmedCode]);
      if (check.length > 0) {
        return res.status(409).json({ message: `Mã ca thi "${trimmedCode}" đã tồn tại trong CSDL.` });
      }
      const [insRes] = await pool.query(
        `INSERT INTO exam_sessions (session_code, exam_id, start_time, end_time, is_active) VALUES (?, ?, ?, ?, true)`,
        [trimmedCode, exam_id || 1, start_time || new Date(), end_time || new Date(Date.now() + duration_minutes * 60000)]
      );
      createdId = insRes.insertId;
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi tạo ca thi, lưu vào fallbackStore:', dbErr.message);
    }

    const newSession = {
      id: createdId,
      session_id: createdId,
      session_code: trimmedCode,
      exam_id: linkedExam?.id || exam_id || 1,
      title: trimmedTitle,
      subject_code: linkedExam?.subject_code || 'IT4010',
      subject_name: linkedExam?.subject_name || 'An toàn và Bảo mật Hệ thống Thông tin',
      room: room.trim() || 'Phòng thi Trực tuyến 01',
      exam_date: exam_date || new Date().toLocaleDateString('vi-VN'),
      time_range: time_range || '08:00 - 09:30',
      start_time: start_time || new Date().toISOString(),
      end_time: end_time || new Date(Date.now() + duration_minutes * 60000).toISOString(),
      duration_minutes: parseInt(duration_minutes, 10) || linkedExam?.duration_minutes || 60,
      total_questions: linkedExam?.total_questions || 20,
      passing_score: linkedExam?.passing_score || 5.0,
      status: 'OPEN',
      status_label: 'Đang mở / Đang thi',
      total_students: 0,
      in_progress_count: 0,
      submitted_count: 0,
      security_config: finalSecurity
    };

    if (!fallbackStore.sessions) fallbackStore.sessions = [];
    fallbackStore.sessions.unshift(newSession);

    if (!fallbackStore.session || fallbackStore.session.id === 1) {
      fallbackStore.session = {
        ...newSession,
        shuffle_questions: linkedExam?.shuffle_questions ? 1 : 0,
        shuffle_answers: linkedExam?.shuffle_answers ? 1 : 0,
        is_active: 1
      };
    }

    return res.status(201).json({
      success: true,
      message: `Đã khởi tạo phòng thi / ca thi "${trimmedTitle}" [${trimmedCode}] thành công!`,
      session: newSession
    });
  } catch (err) {
    console.error('Lỗi khi tạo ca thi:', err);
    return res.status(500).json({ message: 'Không thể tạo phòng thi: ' + err.message });
  }
};

exports.updateSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const {
      session_code,
      exam_id,
      title,
      room,
      exam_date,
      time_range,
      start_time,
      end_time,
      duration_minutes,
      security_config
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Tiêu đề ca thi không được để trống.' });
    }

    const trimmedTitle = title.trim();
    const trimmedCode = session_code?.trim()?.toUpperCase();

    let linkedExam = null;
    if (exam_id) {
      linkedExam = (fallbackStore.exams || []).find((e) => String(e.id) === String(exam_id));
    }

    try {
      await pool.query(
        `UPDATE exam_sessions SET session_code = COALESCE(?, session_code), exam_id = COALESCE(?, exam_id) WHERE id = ?`,
        [trimmedCode, exam_id, sessionId]
      );
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi sửa ca thi, cập nhật fallbackStore:', dbErr.message);
    }

    const sInFallback = (fallbackStore.sessions || []).find(
      (s) => String(s.id) === String(sessionId) || String(s.session_id) === String(sessionId)
    );
    if (sInFallback) {
      if (trimmedCode) sInFallback.session_code = trimmedCode;
      sInFallback.title = trimmedTitle;
      if (room) sInFallback.room = room.trim();
      if (exam_date) sInFallback.exam_date = exam_date;
      if (time_range) sInFallback.time_range = time_range;
      if (duration_minutes) sInFallback.duration_minutes = parseInt(duration_minutes, 10);
      if (linkedExam) {
        sInFallback.exam_id = linkedExam.id;
        sInFallback.subject_code = linkedExam.subject_code;
        sInFallback.subject_name = linkedExam.subject_name;
        sInFallback.total_questions = linkedExam.total_questions;
        sInFallback.passing_score = linkedExam.passing_score;
      }
      if (security_config) {
        sInFallback.security_config = {
          ...sInFallback.security_config,
          ...security_config
        };
      }
    }

    return res.json({
      success: true,
      message: `Đã cập nhật thông tin phòng thi và cấu hình bảo mật thành công!`,
      session: sInFallback || { id: sessionId, title: trimmedTitle }
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật ca thi:', err);
    return res.status(500).json({ message: 'Không thể cập nhật ca thi: ' + err.message });
  }
};

exports.updateSessionStatus = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { status } = req.body; // 'OPEN' | 'CLOSED' | 'CANCELLED'

    const validStatuses = ['OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái ca thi không hợp lệ.' });
    }

    const isActive = status === 'OPEN';

    try {
      await pool.query(`UPDATE exam_sessions SET is_active = ? WHERE id = ?`, [isActive, sessionId]);
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi đổi trạng thái ca thi:', dbErr.message);
    }

    const sInFallback = (fallbackStore.sessions || []).find(
      (s) => String(s.id) === String(sessionId) || String(s.session_id) === String(sessionId)
    );
    if (sInFallback) {
      sInFallback.status = status;
      sInFallback.status_label = status === 'OPEN' ? 'Đang mở / Đang thi' : status === 'CANCELLED' ? 'Đã hủy' : 'Đã kết thúc / Đóng';
    }

    const msgMap = {
      OPEN: 'Đã mở lại phòng thi. Thí sinh có thể đăng nhập vào thi.',
      CLOSED: 'Đã đóng phòng thi. Thí sinh mới sẽ không thể truy cập.',
      COMPLETED: 'Đã đóng ca thi và kết thúc đợt khảo thí.',
      CANCELLED: 'Đã hủy bỏ ca thi và vô hiệu hóa phòng thi.'
    };

    return res.json({
      success: true,
      message: msgMap[status] || `Đã chuyển trạng thái ca thi sang "${status}".`,
      status,
      session: sInFallback
    });
  } catch (err) {
    console.error('Lỗi khi đổi trạng thái ca thi:', err);
    return res.status(500).json({ message: 'Không thể đổi trạng thái ca thi: ' + err.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const sessionId = req.params.id;

    try {
      await pool.query(`DELETE FROM exam_sessions WHERE id = ?`, [sessionId]);
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi xóa ca thi:', dbErr.message);
    }

    fallbackStore.sessions = (fallbackStore.sessions || []).filter(
      (s) => String(s.id) !== String(sessionId) && String(s.session_id) !== String(sessionId)
    );

    return res.json({
      success: true,
      message: 'Đã xóa bỏ phòng thi / ca thi khỏi hệ thống thành công.'
    });
  } catch (err) {
    console.error('Lỗi khi xóa ca thi:', err);
    return res.status(500).json({ message: 'Không thể xóa ca thi: ' + err.message });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const { q, difficulty } = req.query;

    let questions = [];
    try {
      let sql = `
        SELECT q.id, q.content, q.difficulty_level, q.subject_id, s.subject_name
        FROM questions q
        LEFT JOIN subjects s ON q.subject_id = s.id
      `;
      const params = [];
      if (q && q.trim()) {
        sql += ` WHERE (q.content LIKE ?)`;
        params.push(`%${q.trim()}%`);
      }
      sql += ` ORDER BY q.id DESC`;

      const [qRows] = await pool.query(sql, params);
      for (const qItem of qRows) {
        const [aRows] = await pool.query(
          `SELECT id, question_id, answer_text, is_correct FROM answers WHERE question_id = ? ORDER BY id ASC`,
          [qItem.id]
        );
        questions.push({
          ...qItem,
          question_code: `Q_${qItem.id}`,
          answers: aRows.map(a => ({
            id: a.id,
            answer_text: a.answer_text,
            is_correct: Boolean(a.is_correct)
          }))
        });
      }
    } catch (dbErr) {
      console.warn('MySQL không khả dụng trong getQuestions, lấy từ fallbackStore:', dbErr.message);
      questions = [...(fallbackStore.questions || [])];
    }

    if (q && q.trim()) {
      const lowerQ = q.trim().toLowerCase();
      questions = questions.filter(
        (qItem) =>
          qItem.content?.toLowerCase().includes(lowerQ) ||
          qItem.question_code?.toLowerCase().includes(lowerQ)
      );
    }

    if (difficulty && difficulty !== 'ALL') {
      questions = questions.filter((qItem) => qItem.difficulty_level === difficulty);
    }

    return res.json({ questions });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách câu hỏi:', err);
    return res.status(500).json({ message: 'Không thể tải ngân hàng câu hỏi: ' + err.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const { question_code, content, difficulty_level = 'MEDIUM', subject_id, answers = [] } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Nội dung câu hỏi không được để trống.' });
    }
    if (!answers || answers.length < 2) {
      return res.status(400).json({ message: 'Câu hỏi cần ít nhất 2 phương án trả lời.' });
    }

    const hasCorrect = answers.some(a => Boolean(a.is_correct));
    if (!hasCorrect) {
      return res.status(400).json({ message: 'Vui lòng đánh dấu ít nhất 1 phương án là đáp án đúng.' });
    }

    const trimmedCode = question_code && question_code.trim() ? question_code.trim() : `Q_${Date.now().toString().slice(-4)}`;
    const trimmedContent = content.trim();
    const finalSubjectId = subject_id ? Number(subject_id) : 1;

    let createdId = null;
    let savedAnswers = [];

    try {
      try {
        const [insertQ] = await pool.query(
          `INSERT INTO questions (content, difficulty_level, question_type, subject_id) VALUES (?, ?, 'MULTIPLE_CHOICE', ?)`,
          [trimmedContent, difficulty_level, finalSubjectId]
        );
        createdId = insertQ.insertId;
      } catch {
        const [insertQ] = await pool.query(
          `INSERT INTO questions (content, difficulty_level, question_type) VALUES (?, ?, 'MULTIPLE_CHOICE')`,
          [trimmedContent, difficulty_level]
        );
        createdId = insertQ.insertId;
      }

      for (const ans of answers) {
        const [insertA] = await pool.query(
          `INSERT INTO answers (question_id, answer_text, is_correct) VALUES (?, ?, ?)`,
          [createdId, ans.answer_text?.trim() || '', Boolean(ans.is_correct)]
        );
        savedAnswers.push({
          id: insertA.insertId,
          answer_text: ans.answer_text?.trim() || '',
          is_correct: Boolean(ans.is_correct)
        });
      }
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi tạo câu hỏi, lưu vào fallbackStore:', dbErr.message);
      createdId = Date.now();
      savedAnswers = answers.map((a, idx) => ({
        id: Date.now() + idx,
        answer_text: a.answer_text?.trim() || '',
        is_correct: Boolean(a.is_correct)
      }));
    }

    const newQuestion = {
      id: createdId,
      question_code: trimmedCode,
      subject_id: finalSubjectId,
      content: trimmedContent,
      difficulty_level,
      answers: savedAnswers
    };

    if (!fallbackStore.questions) fallbackStore.questions = [];
    fallbackStore.questions.push(newQuestion);

    // Cập nhật số lượng câu hỏi trong danh mục môn học
    if (fallbackStore.subjects) {
      const subj = fallbackStore.subjects.find((s) => String(s.id) === String(finalSubjectId));
      if (subj) {
        subj.total_questions = (subj.total_questions || 0) + 1;
      }
    }

    return res.status(201).json({
      success: true,
      message: `Đã thêm câu hỏi [${trimmedCode}] vào ngân hàng đề thành công!`,
      question: newQuestion
    });
  } catch (err) {
    console.error('Lỗi thêm câu hỏi:', err);
    return res.status(500).json({ message: 'Lỗi khi thêm câu hỏi: ' + err.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const questionId = req.params.id;
    const { question_code, content, difficulty_level = 'MEDIUM', answers = [] } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Nội dung câu hỏi không được để trống.' });
    }
    if (!answers || answers.length < 2) {
      return res.status(400).json({ message: 'Câu hỏi cần ít nhất 2 phương án trả lời.' });
    }
    const hasCorrect = answers.some(a => Boolean(a.is_correct));
    if (!hasCorrect) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 đáp án đúng.' });
    }

    const trimmedCode = question_code && question_code.trim() ? question_code.trim() : `Q_${questionId}`;
    const trimmedContent = content.trim();

    try {
      await pool.query(
        `UPDATE questions SET content = ?, difficulty_level = ? WHERE id = ?`,
        [trimmedContent, difficulty_level, questionId]
      );

      await pool.query(`DELETE FROM answers WHERE question_id = ?`, [questionId]);
      for (const ans of answers) {
        await pool.query(
          `INSERT INTO answers (question_id, answer_text, is_correct) VALUES (?, ?, ?)`,
          [questionId, ans.answer_text?.trim() || '', Boolean(ans.is_correct)]
        );
      }
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi sửa câu hỏi, cập nhật fallbackStore:', dbErr.message);
    }

    const qInFallback = fallbackStore.questions.find((q) => String(q.id) === String(questionId));
    if (qInFallback) {
      qInFallback.question_code = trimmedCode;
      qInFallback.content = trimmedContent;
      qInFallback.difficulty_level = difficulty_level;
      qInFallback.answers = answers.map((a, idx) => ({
        id: a.id || Date.now() + idx,
        answer_text: a.answer_text?.trim() || '',
        is_correct: Boolean(a.is_correct)
      }));
    }

    const updatedQuestion = {
      id: questionId,
      question_code: trimmedCode,
      content: trimmedContent,
      difficulty_level,
      answers: answers.map((a, idx) => ({
        id: a.id || Date.now() + idx,
        answer_text: a.answer_text?.trim() || '',
        is_correct: Boolean(a.is_correct)
      }))
    };

    return res.json({
      success: true,
      message: `Đã cập nhật câu hỏi [${trimmedCode}] thành công!`,
      question: updatedQuestion
    });
  } catch (err) {
    console.error('Lỗi sửa câu hỏi:', err);
    return res.status(500).json({ message: 'Không thể cập nhật câu hỏi: ' + err.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const questionId = req.params.id;

    try {
      await pool.query(`DELETE FROM answers WHERE question_id = ?`, [questionId]);
      await pool.query(`DELETE FROM questions WHERE id = ?`, [questionId]);
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi xóa câu hỏi, cập nhật fallbackStore:', dbErr.message);
    }

    fallbackStore.questions = fallbackStore.questions.filter((q) => String(q.id) !== String(questionId));

    return res.json({
      success: true,
      message: 'Đã ngừng sử dụng và xóa câu hỏi khỏi ngân hàng đề thành công.'
    });
  } catch (err) {
    console.error('Lỗi xóa câu hỏi:', err);
    return res.status(500).json({ message: 'Không thể xóa câu hỏi: ' + err.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { student_code, username, full_name, email, password } = req.body;
    const code = (student_code || username || '').trim();
    const name = (full_name || '').trim();

    if (!code) {
      return res.status(400).json({ message: 'Vui lòng nhập mã sinh viên.' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Vui lòng nhập họ và tên sinh viên.' });
    }

    const defaultEmail = `${code.toLowerCase()}@student.edu.vn`;
    const finalEmail = (email && email.trim()) ? email.trim() : defaultEmail;
    const plainPassword = (password && password.trim()) ? password.trim() : '123456789';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let studentRoleId = 3;

    try {
      // 1. Kiểm tra mã sinh viên đã tồn tại chưa trong CSDL
      const [existing] = await pool.query(
        `SELECT id, username FROM users WHERE username = ? LIMIT 1`,
        [code]
      );
      if (existing.length > 0) {
        return res.status(409).json({
          message: `Mã sinh viên "${code}" đã tồn tại trong hệ thống.`
        });
      }

      // 2. Lấy role_id cho 'STUDENT'
      const [roleRows] = await pool.query(
        `SELECT id FROM roles WHERE role_name = 'STUDENT' LIMIT 1`
      );
      if (roleRows.length > 0) {
        studentRoleId = roleRows[0].id;
      } else {
        const [insertedRole] = await pool.query(
          `INSERT INTO roles (role_name) VALUES ('STUDENT')`
        );
        studentRoleId = insertedRole.insertId;
      }

      // 3. Thêm tài khoản mới vào bảng users
      const [insertResult] = await pool.query(
        `INSERT INTO users (username, password_hash, full_name, email, role_id)
         VALUES (?, ?, ?, ?, ?)`,
        [code, hashedPassword, name, finalEmail, studentRoleId]
      );

      const newStudentId = insertResult.insertId;

      const newStudentObj = {
        id: newStudentId,
        student_code: code,
        username: code,
        full_name: name,
        email: finalEmail,
        is_online: studentPresence.isOnline(code),
        exam_status: 'Chưa thi',
        start_time: null,
        total_score: null,
        session_code: fallbackStore.session?.session_code || 'EXAM88'
      };

      // Đồng bộ vào fallbackStore
      fallbackStore.users.push({
        id: newStudentId,
        role_id: studentRoleId,
        role_name: 'STUDENT',
        username: code,
        full_name: name,
        email: finalEmail,
        password_hash: hashedPassword,
        face_embedding: null
      });

      return res.status(201).json({
        message: `Đã tạo tài khoản học sinh "${name}" (${code}) thành công! Mật khẩu khởi tạo: ${plainPassword}`,
        student: newStudentObj
      });
    } catch (dbErr) {
      console.warn('Lỗi kết nối MySQL khi tạo học sinh, lưu vào fallbackStore:', dbErr.message);
    }

    // Nếu MySQL offline / fallback mode
    const existsInFallback = fallbackStore.users.some(
      (u) => u.username.toUpperCase() === code.toUpperCase()
    );
    if (existsInFallback) {
      return res.status(409).json({
        message: `Mã sinh viên "${code}" đã tồn tại trong danh sách.`
      });
    }

    const newStudentId = Date.now();
    fallbackStore.users.push({
      id: newStudentId,
      role_id: studentRoleId,
      role_name: 'STUDENT',
      username: code,
      full_name: name,
      email: finalEmail,
      password_hash: hashedPassword,
      face_embedding: null
    });

    const studentItem = {
      id: newStudentId,
      student_code: code,
      username: code,
      full_name: name,
      email: finalEmail,
      is_online: studentPresence.isOnline(code),
      exam_status: 'Chưa thi',
      start_time: null,
      total_score: null,
      session_code: fallbackStore.session?.session_code || 'EXAM88'
    };

    return res.status(201).json({
      message: `Đã tạo tài khoản học sinh "${name}" (${code}) thành công! Mật khẩu khởi tạo: ${plainPassword}`,
      student: studentItem
    });
  } catch (err) {
    console.error('Lỗi khi tạo tài khoản học sinh:', err);
    return res.status(500).json({
      message: 'Không thể tạo tài khoản học sinh lúc này: ' + err.message
    });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { q } = req.query;
    let query = `
      SELECT u.id, u.username AS student_code, u.full_name, u.email,
             latest_attempt.status AS exam_status,
             latest_attempt.start_time,
             latest_attempt.total_score,
             latest_session.session_code
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN exam_attempts latest_attempt
        ON latest_attempt.id = (
          SELECT ea.id
          FROM exam_attempts ea
          WHERE ea.user_id = u.id
          ORDER BY ea.start_time DESC, ea.id DESC
          LIMIT 1
        )
      LEFT JOIN exam_sessions latest_session
        ON latest_session.id = latest_attempt.session_id
      WHERE r.role_name = 'STUDENT'
    `;
    const params = [];
    if (q && q.trim()) {
      query += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)`;
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }
    query += ` ORDER BY u.full_name ASC, u.id ASC`;

    let students = [];
    try {
      const [rows] = await pool.query(query, params);
      students = rows;
    } catch (dbErr) {
      console.warn('MySQL không khả dụng trong getStudents, sử dụng fallbackStore:', dbErr.message);
      students = fallbackStore.users
        .filter((u) => u.role_name === 'STUDENT')
        .map((u) => ({
          id: u.id,
          student_code: u.username,
          full_name: u.full_name,
          email: u.email,
          exam_status: 'Chưa thi',
          start_time: null,
          total_score: null,
          session_code: fallbackStore.session?.session_code || 'EXAM88'
        }));
      if (q && q.trim()) {
        const lowerQ = q.trim().toLowerCase();
        students = students.filter(
          (s) =>
            s.student_code.toLowerCase().includes(lowerQ) ||
            s.full_name.toLowerCase().includes(lowerQ) ||
            (s.email && s.email.toLowerCase().includes(lowerQ))
        );
      }
    }

    const result = students.map((s) => ({
      ...s,
      is_online: studentPresence.isOnline(s.student_code)
    }));

    return res.json({ students: result });
  } catch (err) {
    console.error('Lỗi lấy danh sách học sinh:', err);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách học sinh: ' + err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { full_name, email, password } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ message: 'Họ và tên không được để trống.' });
    }

    const trimmedName = full_name.trim();
    const trimmedEmail = email ? email.trim() : null;

    let hashedPassword = null;
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      }
      hashedPassword = await bcrypt.hash(password.trim(), 10);
    }

    try {
      if (hashedPassword) {
        await pool.query(
          `UPDATE users SET full_name = ?, email = ?, password_hash = ? WHERE id = ?`,
          [trimmedName, trimmedEmail, hashedPassword, studentId]
        );
      } else {
        await pool.query(
          `UPDATE users SET full_name = ?, email = ? WHERE id = ?`,
          [trimmedName, trimmedEmail, studentId]
        );
      }
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi cập nhật thí sinh:', dbErr.message);
    }

    const userInFallback = fallbackStore.users.find((u) => String(u.id) === String(studentId));
    if (userInFallback) {
      userInFallback.full_name = trimmedName;
      if (trimmedEmail) userInFallback.email = trimmedEmail;
      if (hashedPassword) userInFallback.password_hash = hashedPassword;
    }

    return res.json({
      success: true,
      message: `Đã cập nhật thông tin học sinh "${trimmedName}" thành công!`,
      student: {
        id: studentId,
        full_name: trimmedName,
        email: trimmedEmail,
        has_new_password: Boolean(hashedPassword)
      }
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật thông tin thí sinh:', err);
    return res.status(500).json({ message: 'Không thể cập nhật thông tin thí sinh: ' + err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const studentId = req.params.id;
    let studentUsername = '';

    try {
      const [users] = await pool.query(`SELECT username, full_name FROM users WHERE id = ?`, [studentId]);
      if (users.length > 0) {
        studentUsername = users[0].username;
      }

      // Xóa các liên kết trước để tránh lỗi khóa ngoại
      try {
        await pool.query(
          `DELETE FROM proctoring_logs WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = ?)`,
          [studentId]
        );
        await pool.query(
          `DELETE FROM attempt_details WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = ?)`,
          [studentId]
        );
        await pool.query(`DELETE FROM exam_attempts WHERE user_id = ?`, [studentId]);
      } catch (cascadeErr) {
        console.warn('Lỗi khi dọn dẹp bản ghi liên kết:', cascadeErr.message);
      }

      await pool.query(`DELETE FROM users WHERE id = ?`, [studentId]);
    } catch (dbErr) {
      console.warn('Lỗi xóa trong MySQL:', dbErr.message);
    }

    // Xóa khỏi fallbackStore
    fallbackStore.users = fallbackStore.users.filter(
      (u) => String(u.id) !== String(studentId) && (!studentUsername || u.username !== studentUsername)
    );

    return res.json({
      success: true,
      message: 'Đã xóa tài khoản học sinh thành công khỏi hệ thống.'
    });
  } catch (err) {
    console.error('Lỗi khi xóa tài khoản thí sinh:', err);
    return res.status(500).json({ message: 'Không thể xóa tài khoản thí sinh: ' + err.message });
  }
};

exports.toggleStudentStatus = async (req, res) => {
  try {
    const studentId = req.params.id;
    const { is_active } = req.body;

    try {
      await pool.query(`UPDATE users SET is_active = ? WHERE id = ?`, [is_active, studentId]);
    } catch (dbErr) {
      console.warn('Cột is_active có thể chưa tồn tại hoặc MySQL offline:', dbErr.message);
    }

    const u = fallbackStore.users.find((user) => String(user.id) === String(studentId));
    if (u) {
      u.is_active = is_active;
    }

    return res.json({
      success: true,
      message: is_active ? 'Đã kích hoạt lại tài khoản.' : 'Đã vô hiệu hóa tài khoản thí sinh.',
      is_active
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái: ' + err.message });
  }
};

/* ==========================================================================
   MÔN HỌC & CHỦ ĐỀ KHẢO THÍ (SUBJECTS & TOPICS)
   ========================================================================== */

exports.getSubjects = async (req, res) => {
  try {
    const { q } = req.query;
    let subjects = [];
    try {
      const sql = `
        SELECT s.id, s.subject_code, s.subject_name, s.description,
               COUNT(q.id) AS total_questions
        FROM subjects s
        LEFT JOIN questions q ON q.subject_id = s.id
        GROUP BY s.id, s.subject_code, s.subject_name, s.description
        ORDER BY s.id DESC
      `;
      const [rows] = await pool.query(sql);
      subjects = rows.map((r) => {
        let count = Number(r.total_questions) || 0;
        if (count === 0 && fallbackStore.subjects) {
          const fbSubj = fallbackStore.subjects.find(
            (fs) => String(fs.id) === String(r.id) || fs.subject_code === r.subject_code
          );
          if (fbSubj && fbSubj.total_questions) {
            count = fbSubj.total_questions;
          }
        }
        return {
          ...r,
          total_questions: count
        };
      });
    } catch (dbErr) {
      console.warn('MySQL không khả dụng trong getSubjects, lấy từ fallbackStore:', dbErr.message);
      subjects = (fallbackStore.subjects || []).map((s) => {
        const count = (fallbackStore.questions || []).filter(
          (q) => String(q.subject_id) === String(s.id)
        ).length;
        return {
          ...s,
          total_questions: count > 0 ? count : (s.total_questions || 0)
        };
      });
    }

    if (q && q.trim()) {
      const lowerQ = q.trim().toLowerCase();
      subjects = subjects.filter(
        (s) =>
          s.subject_code?.toLowerCase().includes(lowerQ) ||
          s.subject_name?.toLowerCase().includes(lowerQ) ||
          s.description?.toLowerCase().includes(lowerQ)
      );
    }

    return res.json({ subjects });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách môn học:', err);
    return res.status(500).json({ message: 'Không thể tải danh sách môn học: ' + err.message });
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { subject_code, subject_name, description = '' } = req.body;
    if (!subject_code || !subject_code.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập mã môn học / chủ đề.' });
    }
    if (!subject_name || !subject_name.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên môn học / chủ đề.' });
    }

    const trimmedCode = subject_code.trim().toUpperCase();
    const trimmedName = subject_name.trim();

    const codeExistsInFallback = (fallbackStore.subjects || []).some(
      (s) => s.subject_code.toUpperCase() === trimmedCode
    );
    if (codeExistsInFallback) {
      return res.status(409).json({ message: `Mã môn học "${trimmedCode}" đã tồn tại trong hệ thống.` });
    }

    let createdId = Date.now();
    try {
      const [check] = await pool.query(`SELECT id FROM subjects WHERE subject_code = ? LIMIT 1`, [trimmedCode]);
      if (check.length > 0) {
        return res.status(409).json({ message: `Mã môn học "${trimmedCode}" đã tồn tại trong CSDL.` });
      }
      const [insertRes] = await pool.query(
        `INSERT INTO subjects (subject_code, subject_name, description) VALUES (?, ?, ?)`,
        [trimmedCode, trimmedName, description.trim()]
      );
      createdId = insertRes.insertId;
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi tạo môn học, lưu vào fallbackStore:', dbErr.message);
    }

    const newSubject = {
      id: createdId,
      subject_code: trimmedCode,
      subject_name: trimmedName,
      description: description.trim(),
      total_questions: 0,
      created_at: new Date().toISOString().split('T')[0]
    };

    if (!fallbackStore.subjects) fallbackStore.subjects = [];
    fallbackStore.subjects.unshift(newSubject);

    return res.status(201).json({
      success: true,
      message: `Đã thêm môn học "${trimmedName}" (${trimmedCode}) thành công!`,
      subject: newSubject
    });
  } catch (err) {
    console.error('Lỗi khi thêm môn học:', err);
    return res.status(500).json({ message: 'Không thể thêm môn học: ' + err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subjectId = req.params.id;
    const { subject_code, subject_name, description = '' } = req.body;

    if (!subject_name || !subject_name.trim()) {
      return res.status(400).json({ message: 'Tên môn học không được để trống.' });
    }

    const trimmedCode = subject_code?.trim().toUpperCase();
    const trimmedName = subject_name.trim();

    try {
      await pool.query(
        `UPDATE subjects SET subject_code = COALESCE(?, subject_code), subject_name = ?, description = ? WHERE id = ?`,
        [trimmedCode, trimmedName, description.trim(), subjectId]
      );
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi sửa môn học, cập nhật fallbackStore:', dbErr.message);
    }

    const subjInFallback = (fallbackStore.subjects || []).find((s) => String(s.id) === String(subjectId));
    if (subjInFallback) {
      if (trimmedCode) subjInFallback.subject_code = trimmedCode;
      subjInFallback.subject_name = trimmedName;
      subjInFallback.description = description.trim();
    }

    const updated = {
      id: subjectId,
      subject_code: trimmedCode || subjInFallback?.subject_code || 'SUBJ',
      subject_name: trimmedName,
      description: description.trim(),
      total_questions: subjInFallback?.total_questions || 0
    };

    return res.json({
      success: true,
      message: `Đã cập nhật môn học "${trimmedName}" thành công!`,
      subject: updated
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật môn học:', err);
    return res.status(500).json({ message: 'Không thể cập nhật môn học: ' + err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subjectId = req.params.id;

    try {
      await pool.query(`DELETE FROM subjects WHERE id = ?`, [subjectId]);
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi xóa môn học, cập nhật fallbackStore:', dbErr.message);
    }

    fallbackStore.subjects = (fallbackStore.subjects || []).filter((s) => String(s.id) !== String(subjectId));

    return res.json({
      success: true,
      message: 'Đã xóa môn học / chủ đề thành công khỏi hệ thống.'
    });
  } catch (err) {
    console.error('Lỗi khi xóa môn học:', err);
    return res.status(500).json({ message: 'Không thể xóa môn học: ' + err.message });
  }
};

/* ==========================================================================
   BỘ ĐỀ THI GỐC & MA TRẬN TRỘN ĐỀ (EXAMS & SHUFFLE MATRIX)
   ========================================================================== */

exports.getExams = async (req, res) => {
  try {
    const { q, status } = req.query || {};
    let exams = [];
    try {
      const sql = `
        SELECT e.id, e.title, e.duration_minutes, e.total_questions, e.passing_score,
               e.shuffle_questions, e.shuffle_answers,
               s.id AS subject_id, s.subject_code, s.subject_name
        FROM exams e
        LEFT JOIN subjects s ON e.subject_id = s.id
        ORDER BY e.id DESC
      `;
      const [rows] = await pool.query(sql);
      exams = rows.map((r) => ({
        ...r,
        created_at: '2026-11-01',
        exam_code: r.exam_code || `EXAM_${r.id}`,
        status: 'ACTIVE',
        variants_count: 4,
        easy_count: Math.round((r.total_questions || 20) * 0.4),
        medium_count: Math.round((r.total_questions || 20) * 0.4),
        hard_count: Math.max(0, (r.total_questions || 20) - Math.round((r.total_questions || 20) * 0.8))
      }));
    } catch (dbErr) {
      console.warn('MySQL không khả dụng trong getExams, lấy từ fallbackStore:', dbErr.message);
      exams = [...(fallbackStore.exams || [])];
    }

    if (q && q.trim()) {
      const lowerQ = q.trim().toLowerCase();
      exams = exams.filter(
        (ex) =>
          ex.exam_code?.toLowerCase().includes(lowerQ) ||
          ex.title?.toLowerCase().includes(lowerQ) ||
          ex.subject_name?.toLowerCase().includes(lowerQ) ||
          ex.subject_code?.toLowerCase().includes(lowerQ)
      );
    }

    if (status && status !== 'ALL') {
      exams = exams.filter((ex) => ex.status === status);
    }

    return res.json({ exams });
  } catch (err) {
    console.error('Lỗi khi lấy danh sách đề thi:', err);
    return res.status(500).json({ message: 'Không thể tải danh sách đề thi: ' + err.message });
  }
};

exports.createExam = async (req, res) => {
  try {
    const {
      exam_code,
      title,
      subject_id,
      duration_minutes = 60,
      total_questions = 20,
      passing_score = 5.0,
      shuffle_questions = true,
      shuffle_answers = true,
      easy_count = 8,
      medium_count = 8,
      hard_count = 4,
      variants_count = 4,
      status = 'ACTIVE'
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên / tiêu đề bộ đề thi.' });
    }

    const trimmedCode = exam_code?.trim() || `EXAM_${Date.now().toString().slice(-4)}`;
    const trimmedTitle = title.trim();
    const numDuration = parseInt(duration_minutes, 10) || 60;
    const numQuestions = parseInt(total_questions, 10) || 20;
    const numPassing = parseFloat(passing_score) || 5.0;

    let subject = (fallbackStore.subjects || []).find((s) => String(s.id) === String(subject_id));
    if (!subject && fallbackStore.subjects?.length > 0) {
      subject = fallbackStore.subjects[0];
    }

    let createdId = Date.now();
    try {
      const [insRes] = await pool.query(
        `INSERT INTO exams (title, subject_id, duration_minutes, total_questions, passing_score, shuffle_questions, shuffle_answers)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [trimmedTitle, subject_id || 1, numDuration, numQuestions, numPassing, Boolean(shuffle_questions), Boolean(shuffle_answers)]
      );
      createdId = insRes.insertId;
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi tạo bộ đề, lưu vào fallbackStore:', dbErr.message);
    }

    const newExam = {
      id: createdId,
      exam_code: trimmedCode,
      title: trimmedTitle,
      subject_id: subject?.id || subject_id || 1,
      subject_code: subject?.subject_code || 'IT4010',
      subject_name: subject?.subject_name || 'An toàn và Bảo mật Hệ thống Thông tin',
      duration_minutes: numDuration,
      total_questions: numQuestions,
      passing_score: numPassing,
      shuffle_questions: Boolean(shuffle_questions),
      shuffle_answers: Boolean(shuffle_answers),
      easy_count: parseInt(easy_count, 10) || 8,
      medium_count: parseInt(medium_count, 10) || 8,
      hard_count: parseInt(hard_count, 10) || 4,
      variants_count: parseInt(variants_count, 10) || 4,
      status: status || 'ACTIVE',
      created_at: new Date().toISOString().split('T')[0]
    };

    if (!fallbackStore.exams) fallbackStore.exams = [];
    fallbackStore.exams.unshift(newExam);

    return res.status(201).json({
      success: true,
      message: `Đã tạo bộ đề thi gốc "${trimmedTitle}" thành công!`,
      exam: newExam
    });
  } catch (err) {
    console.error('Lỗi khi tạo đề thi:', err);
    return res.status(500).json({ message: 'Không thể tạo bộ đề thi: ' + err.message });
  }
};

exports.updateExam = async (req, res) => {
  try {
    const examId = req.params.id;
    const {
      exam_code,
      title,
      subject_id,
      duration_minutes,
      total_questions,
      passing_score,
      shuffle_questions,
      shuffle_answers,
      easy_count,
      medium_count,
      hard_count,
      variants_count,
      status
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Tiêu đề đề thi không được để trống.' });
    }

    const trimmedTitle = title.trim();
    const numDuration = parseInt(duration_minutes, 10) || 60;
    const numQuestions = parseInt(total_questions, 10) || 20;
    const numPassing = parseFloat(passing_score) || 5.0;

    const subject = (fallbackStore.subjects || []).find((s) => String(s.id) === String(subject_id));

    try {
      await pool.query(
        `UPDATE exams
         SET title = ?, duration_minutes = ?, total_questions = ?, passing_score = ?,
             shuffle_questions = ?, shuffle_answers = ?
         WHERE id = ?`,
        [trimmedTitle, numDuration, numQuestions, numPassing, Boolean(shuffle_questions), Boolean(shuffle_answers), examId]
      );
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi sửa bộ đề, cập nhật fallbackStore:', dbErr.message);
    }

    const exInFallback = (fallbackStore.exams || []).find((e) => String(e.id) === String(examId));
    if (exInFallback) {
      if (exam_code) exInFallback.exam_code = exam_code.trim();
      exInFallback.title = trimmedTitle;
      if (subject) {
        exInFallback.subject_id = subject.id;
        exInFallback.subject_code = subject.subject_code;
        exInFallback.subject_name = subject.subject_name;
      }
      exInFallback.duration_minutes = numDuration;
      exInFallback.total_questions = numQuestions;
      exInFallback.passing_score = numPassing;
      if (shuffle_questions !== undefined) exInFallback.shuffle_questions = Boolean(shuffle_questions);
      if (shuffle_answers !== undefined) exInFallback.shuffle_answers = Boolean(shuffle_answers);
      if (easy_count !== undefined) exInFallback.easy_count = parseInt(easy_count, 10);
      if (medium_count !== undefined) exInFallback.medium_count = parseInt(medium_count, 10);
      if (hard_count !== undefined) exInFallback.hard_count = parseInt(hard_count, 10);
      if (variants_count !== undefined) exInFallback.variants_count = parseInt(variants_count, 10);
      if (status) exInFallback.status = status;
    }

    const updatedExam = exInFallback || {
      id: examId,
      title: trimmedTitle,
      duration_minutes: numDuration,
      total_questions: numQuestions,
      passing_score: numPassing
    };

    return res.json({
      success: true,
      message: `Đã cập nhật cấu trúc và thông số bộ đề "${trimmedTitle}" thành công!`,
      exam: updatedExam
    });
  } catch (err) {
    console.error('Lỗi khi cập nhật bộ đề thi:', err);
    return res.status(500).json({ message: 'Không thể cập nhật bộ đề thi: ' + err.message });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const examId = req.params.id;

    try {
      await pool.query(`DELETE FROM exams WHERE id = ?`, [examId]);
    } catch (dbErr) {
      console.warn('MySQL không khả dụng khi xóa bộ đề, cập nhật fallbackStore:', dbErr.message);
    }

    fallbackStore.exams = (fallbackStore.exams || []).filter((e) => String(e.id) !== String(examId));

    return res.json({
      success: true,
      message: 'Đã xóa bộ đề thi thành công khỏi hệ thống.'
    });
  } catch (err) {
    console.error('Lỗi khi xóa bộ đề thi:', err);
    return res.status(500).json({ message: 'Không thể xóa bộ đề thi: ' + err.message });
  }
};

// ==========================================
// QUẢN LÝ & DUYỆT YÊU CẦU CHECK-IN THÍ SINH
// ==========================================
exports.getCheckinRequests = async (req, res) => {
  try {
    const list = fallbackStore.checkinRequests || [];
    return res.json({
      success: true,
      requests: list
    });
  } catch (err) {
    console.error('Lỗi lấy danh sách check-in:', err);
    return res.status(500).json({ message: 'Không thể tải danh sách check-in: ' + err.message });
  }
};

exports.decideCheckinRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { decision, reason = '' } = req.body; // 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ message: 'Quyết định phải là APPROVE hoặc REJECT.' });
    }

    const target = (fallbackStore.checkinRequests || []).find(r => r.id === requestId);
    if (!target) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu check-in.' });
    }

    target.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    target.reject_reason = decision === 'REJECT' ? reason : null;
    target.decided_at = new Date().toISOString();

    // Phát Socket tới Thí sinh
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:checkin_decision', {
          checkinId: target.id,
          studentCode: target.student_code,
          status: target.status,
          reason: target.reject_reason
        });
      }
    } catch (sErr) {
      console.warn('Lỗi emit socket decision:', sErr.message);
    }

    return res.json({
      success: true,
      message: decision === 'APPROVE'
        ? `Đã duyệt cho thí sinh ${target.full_name} (${target.student_code}) vào phòng thi!`
        : `Đã từ chối yêu cầu check-in của ${target.full_name}.`,
      request: target
    });
  } catch (err) {
    console.error('Lỗi khi duyệt check-in:', err);
    return res.status(500).json({ message: 'Không thể xử lý yêu cầu check-in: ' + err.message });
  }
};

exports.approveAllCheckinRequests = async (req, res) => {
  try {
    const list = fallbackStore.checkinRequests || [];
    let count = 0;

    list.forEach(r => {
      if (r.status === 'PENDING') {
        r.status = 'APPROVED';
        r.decided_at = new Date().toISOString();
        count++;
      }
    });

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:checkin_decision', {
          allApproved: true,
          status: 'APPROVED'
        });
      }
    } catch (sErr) {
      console.warn('Lỗi emit socket approve all:', sErr.message);
    }

    return res.json({
      success: true,
      message: `Đã duyệt thành công ${count} thí sinh vào phòng thi!`,
      approvedCount: count
    });
  } catch (err) {
    console.error('Lỗi duyệt tất cả check-in:', err);
    return res.status(500).json({ message: 'Không thể duyệt tất cả check-in: ' + err.message });
  }
};

exports.getSupportRequests = async (req, res) => {
  try {
    const list = fallbackStore.supportRequests || [];
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi tải danh sách yêu cầu hỗ trợ: ' + err.message });
  }
};

exports.decideSupportRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'APPROVED', replyMessage = '' } = req.body;

    const list = fallbackStore.supportRequests || [];
    const item = list.find((r) => r.id === Number(id));

    if (!item) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hỗ trợ.' });
    }

    item.status = status;
    item.reply_message = replyMessage || (status === 'APPROVED' ? 'Giám thị đã đồng ý duyệt cho bạn vào lại phòng thi. Chúc bạn làm bài tốt!' : 'Giám thị đã phản hồi yêu cầu của bạn.');
    item.decided_at = new Date().toISOString();

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:support_decision', {
          requestId: item.id,
          studentCode: item.student_code,
          sessionCode: item.session_code,
          status: item.status,
          replyMessage: item.reply_message
        });
      }
    } catch (sErr) {
      console.warn('Lỗi emit socket support decision:', sErr.message);
    }

    return res.json({
      success: true,
      message: `Đã ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} yêu cầu hỗ trợ của thí sinh ${item.full_name}!`,
      request: item
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi xử lý yêu cầu hỗ trợ: ' + err.message });
  }
};

// ==========================================
// DUYỆT THI LẠI KHI THÍ SINH GẶP SỰ CỐ MẠNG
// ==========================================
exports.allowResumeExam = async (req, res) => {
  try {
    const { studentCode } = req.params;
    const { sessionCode, note = '' } = req.body || {};

    let user = null;
    try {
      const [uRows] = await pool.query(
        `SELECT id, username, full_name FROM users WHERE username = ? LIMIT 1`,
        [studentCode]
      );
      if (uRows && uRows.length > 0) user = uRows[0];
    } catch {
      // ignore
    }

    if (!user) {
      user = (fallbackStore.users || []).find((u) => u.username === studentCode);
    }

    const fullName = user?.full_name || studentCode;

    // 1. Cập nhật trạng thái lượt thi trong MySQL nếu có
    try {
      if (user?.id) {
        await pool.query(
          `UPDATE exam_attempts
           SET status = 'IN_PROGRESS'
           WHERE user_id = ?
           ORDER BY id DESC LIMIT 1`,
          [user.id]
        );
      }
    } catch (dbErr) {
      console.warn('Lỗi cập nhật CSDL allowResume:', dbErr.message);
    }

    // 2. Cập nhật trong fallbackStore
    const att = (fallbackStore.attempts || []).find(
      (a) => (user?.id && a.user_id === user.id) || a.student_code === studentCode
    );
    if (att) {
      att.status = 'IN_PROGRESS';
      att.status_label = 'Đang làm bài (Đã duyệt sự cố mạng)';
      att.terminated_by_teacher = false;
    }

    // 3. Tự động duyệt các yêu cầu hỗ trợ / xin vào lại đang chờ của thí sinh này
    if (Array.isArray(fallbackStore.supportRequests)) {
      fallbackStore.supportRequests.forEach((r) => {
        if (r.student_code === studentCode && r.status === 'PENDING') {
          r.status = 'APPROVED';
          r.reply_message = note || 'Giám thị đã duyệt quyền cho phép bạn tiếp tục làm bài thi sau sự cố mạng. Toàn bộ đáp án đã được khôi phục!';
          r.decided_at = new Date().toISOString();
        }
      });
    }

    // 4. Ghi nhận log giám thị
    const logItem = {
      id: Date.now(),
      student_code: studentCode,
      full_name: fullName,
      violation_type: 'NETWORK_RESUME_APPROVED',
      euclidean_distance: null,
      evidence_image_path: 'Giám thị duyệt cho phép thi lại sau sự cố mạng',
      timestamp: new Date().toISOString()
    };
    if (!fallbackStore.proctoringLogs) fallbackStore.proctoringLogs = [];
    fallbackStore.proctoringLogs.unshift(logItem);

    // 5. Phát Socket tới Thí sinh ngay lập tức
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:resume_exam_permission', {
          studentCode,
          sessionCode: sessionCode || 'EXAM88',
          fullName,
          message: note || 'Giám thị đã duyệt cho phép bạn tiếp tục làm bài thi sau sự cố mạng! Toàn bộ bài làm của bạn đã được bảo lưu an toàn.',
          timestamp: new Date().toISOString()
        });
        io.emit('student:support_decision', {
          studentCode,
          sessionCode: sessionCode || 'EXAM88',
          status: 'APPROVED',
          replyMessage: note || 'Giám thị đã duyệt quyền cho phép tiếp tục thi lại sau sự cố mạng.'
        });
        io.emit('proctoring:violation_alert', logItem);
      }
    } catch (sErr) {
      console.warn('Lỗi emit socket allowResume:', sErr.message);
    }

    return res.json({
      success: true,
      message: `Đã duyệt cho phép thí sinh ${fullName} (${studentCode}) tiếp tục thi lại sau sự cố mạng!`,
      studentCode,
      fullName
    });
  } catch (err) {
    console.error('Lỗi khi duyệt thi lại:', err);
    return res.status(500).json({ message: 'Không thể duyệt thi lại: ' + err.message });
  }
};

// ==========================================
// CƯỠNG CHẾ THU BÀI KHI VI PHẠM NẶNG
// ==========================================
exports.forceSubmitExam = async (req, res) => {
  try {
    const { studentCode } = req.params;
    const {
      sessionCode,
      reason = 'Vi phạm nghiêm trọng quy chế phòng thi',
      violationType = 'FORCE_TERMINATED'
    } = req.body || {};

    let user = null;
    try {
      const [uRows] = await pool.query(
        `SELECT id, username, full_name FROM users WHERE username = ? LIMIT 1`,
        [studentCode]
      );
      if (uRows && uRows.length > 0) user = uRows[0];
    } catch {
      // ignore
    }

    if (!user) {
      user = (fallbackStore.users || []).find((u) => u.username === studentCode);
    }

    const fullName = user?.full_name || studentCode;

    // Tính điểm dựa trên số câu hỏi đã kịp làm
    let score = 0;
    const totalQuestions = fallbackStore.questions?.length || 5;
    let correctCount = 0;

    // Trong MySQL
    try {
      if (user?.id) {
        const [attRows] = await pool.query(
          `SELECT id FROM exam_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
          [user.id]
        );
        if (attRows && attRows.length > 0) {
          const attemptId = attRows[0].id;
          const [correctRows] = await pool.query(
            `SELECT ad.question_id, ad.selected_answer_id, a.is_correct
             FROM attempt_details ad
             LEFT JOIN answers a ON ad.selected_answer_id = a.id
             WHERE ad.attempt_id = ?`,
            [attemptId]
          );
          correctCount = (correctRows || []).filter((r) => r.is_correct === 1 || r.is_correct === true).length;
          score = Number(((correctCount / totalQuestions) * 10).toFixed(2));

          await pool.query(
            `UPDATE exam_attempts
             SET submit_time = CURRENT_TIMESTAMP, total_score = ?, status = 'SUBMITTED'
             WHERE id = ?`,
            [score, attemptId]
          );
        }
      }
    } catch (dbErr) {
      console.warn('Lỗi cập nhật CSDL forceSubmit:', dbErr.message);
    }

    // Trong fallbackStore
    const att = (fallbackStore.attempts || []).find(
      (a) => (user?.id && a.user_id === user.id) || a.student_code === studentCode
    );
    if (att) {
      const savedAnswers = (fallbackStore.attemptDetails && fallbackStore.attemptDetails[att.id]) || {};
      (fallbackStore.questions || []).forEach((q) => {
        const chosenId = Number(savedAnswers[q.id]);
        const correctAns = q.answers?.find((a) => a.is_correct);
        if (correctAns && chosenId === correctAns.id) {
          correctCount += 1;
        }
      });
      score = Number(((correctCount / totalQuestions) * 10).toFixed(2));
      att.status = 'SUBMITTED';
      att.status_label = 'Đã bị cưỡng chế thu bài';
      att.submit_time = new Date().toISOString();
      att.total_score = score;
      att.terminated_by_teacher = true;
      att.termination_reason = reason;
    }

    // Ghi nhận vi phạm vào proctoring_logs
    const logItem = {
      id: Date.now(),
      student_code: studentCode,
      full_name: fullName,
      violation_type: 'FORCE_TERMINATED',
      euclidean_distance: null,
      evidence_image_path: reason,
      timestamp: new Date().toISOString()
    };
    if (!fallbackStore.proctoringLogs) fallbackStore.proctoringLogs = [];
    fallbackStore.proctoringLogs.unshift(logItem);

    // Phát socket cưỡng chế thu bài tới Thí sinh ngay lập tức
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('student:force_submitted', {
          studentCode,
          sessionCode: sessionCode || 'EXAM88',
          fullName,
          reason,
          totalScore: score,
          correctCount,
          totalQuestions,
          timestamp: new Date().toISOString()
        });
        io.emit('proctoring:violation_alert', logItem);
      }
    } catch (sErr) {
      console.warn('Lỗi emit socket forceSubmit:', sErr.message);
    }

    return res.json({
      success: true,
      message: `Đã xác nhận cưỡng chế thu bài thi của thí sinh ${fullName} (${studentCode}) do vi phạm nặng!`,
      studentCode,
      fullName,
      reason,
      totalScore: score
    });
  } catch (err) {
    console.error('Lỗi khi cưỡng chế thu bài:', err);
    return res.status(500).json({ message: 'Không thể cưỡng chế thu bài: ' + err.message });
  }
};
