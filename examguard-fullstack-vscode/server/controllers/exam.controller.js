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
    let attempt = fallbackStore.attempts.find(a => a.user_id === userId && a.session_id === sessionId);
    if (!attempt) {
      attempt = {
        id: fallbackStore.attempts.length + 1,
        user_id: userId,
        session_id: sessionId,
        start_time: new Date().toISOString(),
        submit_time: null,
        total_score: null,
        status: 'IN_PROGRESS'
      };
      fallbackStore.attempts.push(attempt);
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
      attempt.status = 'SUBMITTED';
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
