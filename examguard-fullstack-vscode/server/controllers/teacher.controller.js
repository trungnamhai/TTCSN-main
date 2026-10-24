const { pool, fallbackStore } = require('../models/exam.model');

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
    return res.json({
      logs,
      attempts,
      questions: fallbackStore.questions,
      session: fallbackStore.session,
      source: 'MYSQL'
    });
  } catch (err) {
    return res.json({
      logs: fallbackStore.proctoringLogs,
      attempts: fallbackStore.attempts.length
        ? fallbackStore.attempts
        : [
            {
              id: 1,
              student_code: 'SV2026001',
              full_name: 'Minh Nhật',
              session_code: 'EXAM88',
              start_time: new Date().toISOString(),
              status: 'IN_PROGRESS',
              total_score: null
            }
          ],
      questions: fallbackStore.questions,
      session: fallbackStore.session,
      source: 'FALLBACK_MEMORY'
    });
  }
};

exports.createQuestion = async (req, res) => {
  const { content, difficulty_level = 'MEDIUM', answers = [] } = req.body;
  if (!content || answers.length < 2) {
    return res.status(400).json({ message: 'Câu hỏi cần nội dung và ít nhất 2 phương án trả lời.' });
  }

  const newQ = {
    id: fallbackStore.questions.length + 1,
    content,
    difficulty_level,
    answers: answers.map((a, idx) => ({
      id: Date.now() + idx,
      answer_text: a.answer_text,
      is_correct: Boolean(a.is_correct)
    }))
  };
  fallbackStore.questions.push(newQ);
  return res.status(201).json({ message: 'Đã thêm câu hỏi mới thành công.', question: newQ });
};
