const { pool, fallbackStore } = require('../models/exam.model');

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

exports.startExamAttempt = async (req, res) => {
  const { id: userId, session_id: sessionId } = req.user;

  try {
    // 1. Tạo hoặc lấy lượt thi hiện tại trong MySQL
    await pool.query(
      `INSERT INTO exam_attempts (user_id, session_id, status)
       VALUES (?, ?, 'IN_PROGRESS')
       ON DUPLICATE KEY UPDATE status = status`,
      [userId, sessionId]
    );

    const [[attempt]] = await pool.query(
      `SELECT * FROM exam_attempts WHERE user_id = ? AND session_id = ? LIMIT 1`,
      [userId, sessionId]
    );

    // 2. Lấy danh sách câu hỏi và đáp án (KHÔNG gửi cột is_correct về client!)
    const [qRows] = await pool.query(
      `SELECT q.id, q.content, q.question_type, q.difficulty_level
       FROM questions q
       JOIN exams e ON e.subject_id = q.subject_id
       JOIN exam_sessions es ON es.exam_id = e.id
       WHERE es.id = ?`,
      [sessionId]
    );

    const questions = [];
    for (const q of qRows) {
      const [aRows] = await pool.query(
        `SELECT id, question_id, answer_text FROM answers WHERE question_id = ?`,
        [q.id]
      );
      questions.push({
        ...q,
        answers: shuffleArray(aRows)
      });
    }

    // 3. Lấy các câu trả lời đã lưu trước đó (nếu F5/mất kết nối)
    const [savedRows] = await pool.query(
      `SELECT question_id, selected_answer_id FROM attempt_details WHERE attempt_id = ?`,
      [attempt.id]
    );
    const savedAnswers = {};
    savedRows.forEach(r => {
      savedAnswers[r.question_id] = r.selected_answer_id;
    });

    return res.json({
      attempt,
      questions: shuffleArray(questions),
      savedAnswers,
      source: 'MYSQL'
    });
  } catch (err) {
    // Dự phòng In-Memory nếu MySQL chưa khởi chạy
    let attempt = fallbackStore.attempts.find(a => a.user_id === userId && a.session_id === sessionId && a.status === 'IN_PROGRESS');
    if (!attempt) {
      const sessionObj = (fallbackStore.sessions && fallbackStore.sessions.find(s => s.id === sessionId)) || fallbackStore.session;
      attempt = {
        id: fallbackStore.attempts.length + 101,
        user_id: userId,
        session_id: sessionId,
        session_code: sessionObj?.session_code || 'EXAM88',
        exam_title: sessionObj?.title || 'Kiểm tra trắc nghiệm trực tuyến',
        subject_name: sessionObj?.subject_name || 'Khảo thí AI',
        subject_code: sessionObj?.subject_code || 'IT4010',
        start_time: new Date().toISOString(),
        submit_time: null,
        total_score: null,
        total_questions: fallbackStore.questions.length,
        correct_count: null,
        status: 'IN_PROGRESS',
        status_label: 'Đang làm bài',
        passed: false,
        violation_count: 0
      };
      fallbackStore.attempts.unshift(attempt);
    }

    const approvedReq = (fallbackStore.checkinRequests || []).find(
      r => r.student_code === (req.user?.username || 'SV2026001') && r.status === 'APPROVED'
    );
    if (approvedReq?.face_signature) {
      attempt.reference_face_signature = approvedReq.face_signature;
    }

    // Loại bỏ hoàn toàn trường is_correct trước khi gửi cho sinh viên
    const sanitizedQuestions = shuffleArray(fallbackStore.questions).map(q => ({
      id: q.id,
      content: q.content,
      difficulty_level: q.difficulty_level,
      answers: shuffleArray(
        q.answers.map(a => ({
          id: a.id,
          question_id: q.id,
          answer_text: a.answer_text
        }))
      )
    }));

    return res.json({
      attempt,
      questions: sanitizedQuestions,
      savedAnswers: fallbackStore.attemptDetails[attempt.id] || {},
      source: 'FALLBACK_MEMORY'
    });
  }
};

exports.saveAnswer = async (req, res) => {
  const { attemptId, questionId, selectedAnswerId } = req.body;
  try {
    await pool.query(
      `INSERT INTO attempt_details (attempt_id, question_id, selected_answer_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE selected_answer_id = VALUES(selected_answer_id), updated_at = CURRENT_TIMESTAMP`,
      [attemptId, questionId, selectedAnswerId]
    );
    return res.json({ saved: true, updated_at: new Date().toISOString() });
  } catch (err) {
    if (!fallbackStore.attemptDetails[attemptId]) {
      fallbackStore.attemptDetails[attemptId] = {};
    }
    fallbackStore.attemptDetails[attemptId][questionId] = selectedAnswerId;
    return res.json({ saved: true, updated_at: new Date().toISOString(), fallback: true });
  }
};

exports.submitExam = async (req, res) => {
  const { attemptId, answers = {} } = req.body;

  try {
    // Lưu toàn bộ đáp án lần cuối
    for (const [qId, aId] of Object.entries(answers)) {
      await pool.query(
        `INSERT INTO attempt_details (attempt_id, question_id, selected_answer_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE selected_answer_id = VALUES(selected_answer_id)`,
        [attemptId, Number(qId), Number(aId)]
      );
    }

    // Tính điểm trên Backend từ bảng answers trong MySQL
    const [correctRows] = await pool.query(
      `SELECT ad.question_id, ad.selected_answer_id, a.is_correct
       FROM attempt_details ad
       LEFT JOIN answers a ON ad.selected_answer_id = a.id
       WHERE ad.attempt_id = ?`,
      [attemptId]
    );

    const totalQuestions = fallbackStore.questions.length;
    const correctCount = correctRows.filter(r => r.is_correct === 1 || r.is_correct === true).length;
    const score = Number(((correctCount / totalQuestions) * 10).toFixed(2));

    await pool.query(
      `UPDATE exam_attempts
       SET submit_time = CURRENT_TIMESTAMP, total_score = ?, status = 'SUBMITTED'
       WHERE id = ?`,
      [score, attemptId]
    );

    return res.json({
      message: 'Nộp bài thành công! Điểm số đã được chấm tại Backend.',
      attemptId,
      correctCount,
      totalQuestions,
      totalScore: score,
      passed: score >= 5.0,
      submitTime: new Date().toISOString()
    });
  } catch (err) {
    // Tính điểm trên Backend bằng fallbackStore
    let correctCount = 0;
    const totalQuestions = fallbackStore.questions.length;

    fallbackStore.questions.forEach(q => {
      const chosenId = Number(answers[q.id]);
      const correctAns = q.answers.find(a => a.is_correct);
      if (correctAns && chosenId === correctAns.id) {
        correctCount += 1;
      }
    });

    const score = Number(((correctCount / totalQuestions) * 10).toFixed(2));
    const attempt = fallbackStore.attempts.find(a => a.id === Number(attemptId));
    if (attempt) {
      attempt.submit_time = new Date().toISOString();
      attempt.total_score = score;
      attempt.total_questions = totalQuestions;
      attempt.correct_count = correctCount;
      attempt.status = 'SUBMITTED';
      attempt.status_label = 'Đã hoàn thành';
      attempt.passed = score >= 5.0;
    }

    return res.json({
      message: 'Nộp bài thành công! Điểm số đã được chấm tại Backend.',
      attemptId,
      correctCount,
      totalQuestions,
      totalScore: score,
      passed: score >= 5.0,
      submitTime: new Date().toISOString()
    });
  }
};

exports.getStudentAttempts = async (req, res) => {
  const userId = req.user?.id || 3;
  try {
    let attempts = [];
    try {
      const [rows] = await pool.query(`
        SELECT ea.id AS attempt_id, ea.session_id, ea.user_id, ea.start_time, ea.submit_time,
               ea.total_score, ea.status,
               es.session_code, es.exam_date, es.time_range,
               e.title AS exam_title, e.duration_minutes, e.total_questions, e.passing_score,
               s.subject_code, s.subject_name,
               (SELECT COUNT(*) FROM proctoring_logs pl WHERE pl.attempt_id = ea.id) AS violation_count
        FROM exam_attempts ea
        JOIN exam_sessions es ON ea.session_id = es.id
        JOIN exams e ON es.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        WHERE ea.user_id = ?
        ORDER BY ea.id DESC
      `, [userId]);
      attempts = rows.map((r) => ({
        ...r,
        id: r.attempt_id,
        passed: Number(r.total_score) >= Number(r.passing_score || 5.0),
        status_label: r.status === 'SUBMITTED' ? 'Đã hoàn thành' : r.status === 'IN_PROGRESS' ? 'Đang làm bài' : r.status
      }));
    } catch {
      attempts = (fallbackStore.attempts || [])
        .filter((a) => a.user_id === userId || !a.user_id || a.user_id === 3)
        .map((a) => ({
          ...a,
          attempt_id: a.id,
          status_label: a.status === 'SUBMITTED' ? 'Đã hoàn thành' : 'Đang làm bài',
          passed: Number(a.total_score) >= 5.0
        }));
    }
    return res.json({ attempts });
  } catch (err) {
    return res.status(500).json({ message: 'Không thể tải lịch sử thi: ' + err.message });
  }
};

exports.getAttemptDetail = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  try {
    let attempt = null;
    let details = [];
    let logs = [];
    try {
      const [[att]] = await pool.query(`
        SELECT ea.*, es.session_code, e.title AS exam_title, s.subject_name, s.subject_code
        FROM exam_attempts ea
        JOIN exam_sessions es ON ea.session_id = es.id
        JOIN exams e ON es.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        WHERE ea.id = ?
      `, [id]);
      attempt = att;
      const [detailRows] = await pool.query(`
        SELECT ad.*, q.content, q.question_code, a.answer_text, a.is_correct
        FROM attempt_details ad
        JOIN questions q ON ad.question_id = q.id
        LEFT JOIN answers a ON ad.selected_answer_id = a.id
        WHERE ad.attempt_id = ?
      `, [id]);
      details = detailRows;
      const [logRows] = await pool.query(`
        SELECT * FROM proctoring_logs WHERE attempt_id = ? ORDER BY timestamp DESC
      `, [id]);
      logs = logRows;
    } catch {
      attempt = (fallbackStore.attempts || []).find((a) => a.id === Number(id)) || null;
      const savedAnswers = (fallbackStore.attemptDetails && fallbackStore.attemptDetails[id]) || {};
      details = (fallbackStore.questions || []).map((q) => {
        const selectedId = savedAnswers[q.id];
        const selectedAns = q.answers.find((a) => a.id === selectedId);
        const correctAns = q.answers.find((a) => a.is_correct);
        return {
          question_id: q.id,
          question_code: q.question_code,
          content: q.content,
          selected_answer_id: selectedId,
          selected_text: selectedAns?.answer_text || 'Chưa trả lời',
          correct_text: correctAns?.answer_text || '',
          is_correct: selectedAns?.is_correct || false
        };
      });
      logs = (fallbackStore.proctoringLogs || []).filter((l) => l.attempt_id === Number(id));
    }

    if (!attempt) {
      return res.status(404).json({ message: 'Không tìm thấy lượt thi' });
    }

    return res.json({ attempt, details, logs });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi tải chi tiết bài thi: ' + err.message });
  }
};

exports.getStudentSessions = async (req, res) => {
  try {
    let sessions = [];
    try {
      const [rows] = await pool.query(`
        SELECT es.id AS session_id, es.session_code, es.start_time, es.end_time, es.is_active,
               e.id AS exam_id, e.title, e.duration_minutes, e.total_questions, e.passing_score,
               s.subject_code, s.subject_name
        FROM exam_sessions es
        JOIN exams e ON es.exam_id = e.id
        JOIN subjects s ON e.subject_id = s.id
        ORDER BY es.start_time DESC
      `);
      sessions = rows.map((r) => ({
        ...r,
        id: r.session_id,
        status: r.is_active ? 'OPEN' : 'COMPLETED',
        status_label: r.is_active ? 'Đang mở' : 'Đã kết thúc'
      }));
    } catch {
      sessions = [...(fallbackStore.sessions || [])];
    }
    return res.json({ sessions });
  } catch (err) {
    return res.status(500).json({ message: 'Không thể tải danh sách ca thi: ' + err.message });
  }
};

exports.submitCheckin = async (req, res) => {
  const userId = req.user?.id || 3;
  const studentCode = req.body?.studentCode || req.user?.username || 'SV2026001';
  let fullName = req.body?.fullName || req.user?.full_name;

  if (!fullName) {
    try {
      const [rows] = await pool.query(
        `SELECT full_name FROM users WHERE username = ? LIMIT 1`,
        [studentCode]
      );
      if (rows && rows.length > 0 && rows[0].full_name) {
        fullName = rows[0].full_name;
      }
    } catch {
      // ignore
    }
  }

  if (!fullName) {
    const foundUser = (fallbackStore.users || []).find(u => u.username === studentCode);
    if (foundUser?.full_name) fullName = foundUser.full_name;
  }

  if (!fullName) {
    fullName = 'Thí sinh ' + studentCode;
  }

  const { sessionCode, imageBase64, micOk = true, cameraOk = true, faceCount = 1, simulatedFaceCount, faceSignature } = req.body;
  const actualFaceCount = Number(simulatedFaceCount !== undefined ? simulatedFaceCount : faceCount) || 1;

  let snapshotUrl = '/uploads/evidence_default.jpg';
  if (imageBase64 && imageBase64.includes('base64,')) {
    try {
      const fs = require('fs');
      const path = require('path');
      const base64Data = imageBase64.split('base64,')[1];
      const fileName = `checkin_${studentCode}_${Date.now()}.jpg`;
      const uploadDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(base64Data, 'base64'));
      snapshotUrl = `/uploads/${fileName}`;
    } catch (e) {
      console.warn('Lỗi lưu ảnh checkin:', e.message);
    }
  }

  const maxId = (fallbackStore.checkinRequests || []).reduce((max, r) => Math.max(max, r.id || 0), 0);
  const newReq = {
    id: maxId + 1,
    student_id: userId,
    student_code: studentCode,
    full_name: fullName,
    session_code: sessionCode || 'EXAM88',
    session_title: 'Kiểm tra giữa kỳ: An toàn thông tin & Khảo thí AI',
    snapshot_url: snapshotUrl,
    snapshot_base64: imageBase64 || null,
    mic_ready: Boolean(micOk),
    camera_ready: Boolean(cameraOk),
    face_count: actualFaceCount,
    face_signature: Array.isArray(faceSignature) ? faceSignature : null,
    euclidean_distance: actualFaceCount >= 2 ? 0.72 : 0.22,
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  if (!fallbackStore.checkinRequests) fallbackStore.checkinRequests = [];
  fallbackStore.checkinRequests = fallbackStore.checkinRequests.filter(
    r => !(r.student_code === studentCode && r.session_code === newReq.session_code && r.status === 'PENDING')
  );
  fallbackStore.checkinRequests.unshift(newReq);

  try {
    const io = req.app.get('io');
    if (io) {
      io.to('TEACHERS').emit('teacher:new_checkin_request', newReq);
      io.emit('teacher:new_checkin_request', newReq);
    }
  } catch (err) {
    console.warn('Lỗi emit socket checkin:', err.message);
  }

  return res.json({
    success: true,
    checkinId: newReq.id,
    status: 'PENDING',
    message: 'Yêu cầu check-in đã được gửi tới Giám thị. Vui lòng chờ duyệt.'
  });
};

exports.getCheckinStatus = async (req, res) => {
  const studentCode = req.user?.username || 'SV2026001';
  const sessionCode = req.query?.sessionCode || 'EXAM88';

  const userReq = (fallbackStore.checkinRequests || []).find(
    r => r.student_code === studentCode && (!sessionCode || r.session_code === sessionCode)
  );

  if (!userReq) {
    return res.json({ status: 'NONE', message: 'Chưa có yêu cầu check-in' });
  }

  return res.json({
    status: userReq.status,
    checkinId: userReq.id,
    reason: userReq.reject_reason || null,
    updated_at: userReq.updated_at || userReq.created_at
  });
};
