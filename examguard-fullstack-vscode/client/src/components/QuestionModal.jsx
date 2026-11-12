import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './QuestionModal.css';

export default function QuestionModal({
  isOpen,
  onClose,
  token,
  question, // null nếu là tạo mới, object nếu là sửa
  subjects = [],
  onSaved
}) {
  const isEdit = Boolean(question);

  const [questionCode, setQuestionCode] = useState('');
  const [content, setContent] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('MEDIUM');
  const [subjectId, setSubjectId] = useState('');
  const [answers, setAnswers] = useState([
    { answer_text: '', is_correct: true },
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (question) {
        setQuestionCode(question.question_code || `Q_${question.id}`);
        setContent(question.content || '');
        setDifficultyLevel(question.difficulty_level || 'MEDIUM');
        setSubjectId(question.subject_id || (subjects[0]?.id || 1));
        if (question.answers && question.answers.length > 0) {
          setAnswers(
            question.answers.map((a) => ({
              id: a.id,
              answer_text: a.answer_text || '',
              is_correct: Boolean(a.is_correct)
            }))
          );
        } else {
          setAnswers([
            { answer_text: '', is_correct: true },
            { answer_text: '', is_correct: false },
            { answer_text: '', is_correct: false },
            { answer_text: '', is_correct: false }
          ]);
        }
      } else {
        setQuestionCode(`Q_${Date.now().toString().slice(-4)}`);
        setContent('');
        setDifficultyLevel('MEDIUM');
        setSubjectId(subjects[0]?.id || 1);
        setAnswers([
          { answer_text: '', is_correct: true },
          { answer_text: '', is_correct: false },
          { answer_text: '', is_correct: false },
          { answer_text: '', is_correct: false }
        ]);
      }
      setError('');
      setSuccess('');
    }
  }, [isOpen, question, subjects]);

  if (!isOpen) return null;

  const handleAnswerTextChange = (index, text) => {
    setAnswers((prev) =>
      prev.map((ans, idx) => (idx === index ? { ...ans, answer_text: text } : ans))
    );
  };

  const handleCorrectSelect = (index) => {
    setAnswers((prev) =>
      prev.map((ans, idx) => ({ ...ans, is_correct: idx === index }))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Vui lòng nhập nội dung câu hỏi.');
      return;
    }

    // Kiểm tra các phương án trả lời
    const validAnswers = answers.filter((a) => a.answer_text.trim());
    if (validAnswers.length < 2) {
      setError('Vui lòng nhập ít nhất 2 phương án trả lời.');
      return;
    }

    const hasCorrect = answers.some((a) => a.is_correct && a.answer_text.trim());
    if (!hasCorrect) {
      setError('Vui lòng chọn 1 phương án có nội dung làm đáp án đúng.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isEdit ? `/teacher/questions/${question.id}` : '/teacher/questions';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await apiRequest(endpoint, {
        method,
        token,
        body: {
          question_code: questionCode.trim(),
          content: trimmedContent,
          difficulty_level: difficultyLevel,
          subject_id: subjectId ? Number(subjectId) : (subjects[0]?.id || 1),
          answers: answers.map((a) => ({
            ...a,
            answer_text: a.answer_text.trim()
          }))
        }
      });

      setSuccess(response.message || 'Lưu câu hỏi thành công!');
      if (onSaved) {
        onSaved(response.question, isEdit);
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError(err.message || 'Không thể lưu câu hỏi lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const answerLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="qm-overlay" onClick={onClose}>
      <div
        className="qm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qm-title"
      >
        <div className="qm-header">
          <div className="qm-header-icon-wrap">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="qm-header-text">
            <h2 id="qm-title" className="qm-title">
              {isEdit ? 'Sửa thông tin câu hỏi' : 'Thêm câu hỏi mới vào ngân hàng đề'}
            </h2>
            <p className="qm-subtitle">
              {isEdit
                ? `Đang chỉnh sửa câu hỏi: ${questionCode}`
                : 'Nhập nội dung, mức độ và thiết lập 4 phương án trả lời'}
            </p>
          </div>
          <button
            type="button"
            className="qm-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="qm-alert qm-alert-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="qm-alert qm-alert-success" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="qm-form">
          <div className="qm-form-row">
            {/* Mã câu hỏi */}
            <div className="qm-form-group">
              <label className="qm-label" htmlFor="qm-code">
                Mã câu hỏi <span className="qm-required">*</span>
              </label>
              <input
                id="qm-code"
                type="text"
                className="qm-input"
                placeholder="VD: IT_WEB_01"
                value={questionCode}
                onChange={(e) => setQuestionCode(e.target.value)}
                required
              />
            </div>

            {/* Môn học / Chủ đề */}
            <div className="qm-form-group">
              <label className="qm-label" htmlFor="qm-subj">
                Môn học / Chủ đề <span className="qm-required">*</span>
              </label>
              <select
                id="qm-subj"
                className="qm-input qm-select"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.length === 0 ? (
                  <option value={1}>IT4010 — An toàn thông tin</option>
                ) : (
                  subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.subject_code} — {s.subject_name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Mức độ khó */}
            <div className="qm-form-group">
              <label className="qm-label" htmlFor="qm-diff">
                Mức độ khó <span className="qm-required">*</span>
              </label>
              <select
                id="qm-diff"
                className="qm-input qm-select"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
              >
                <option value="EASY">Dễ (EASY)</option>
                <option value="MEDIUM">Trung bình (MEDIUM)</option>
                <option value="HARD">Khó (HARD)</option>
                <option value="EXPERT">Rất khó (EXPERT)</option>
              </select>
            </div>
          </div>

          {/* Nội dung câu hỏi */}
          <div className="qm-form-group">
            <label className="qm-label" htmlFor="qm-content">
              Nội dung câu hỏi <span className="qm-required">*</span>
            </label>
            <textarea
              id="qm-content"
              className="qm-textarea"
              rows="3"
              placeholder="Nhập nội dung đề bài câu hỏi..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {/* Danh sách 4 phương án trả lời */}
          <div className="qm-form-group">
            <div className="qm-answers-label-row">
              <label className="qm-label">Các phương án trả lời & Đáp án đúng</label>
              <span className="qm-hint-tag">Tích chọn tròn để đặt làm đáp án đúng</span>
            </div>

            <div className="qm-answers-list">
              {answers.map((ans, idx) => (
                <div
                  key={idx}
                  className={`qm-answer-row ${ans.is_correct ? 'is-correct' : ''}`}
                >
                  <label className="qm-radio-wrap" title="Chọn làm đáp án đúng">
                    <input
                      type="radio"
                      name="correct-answer"
                      checked={ans.is_correct}
                      onChange={() => handleCorrectSelect(idx)}
                      className="qm-radio"
                    />
                    <span className="qm-ans-letter">{answerLabels[idx]}</span>
                  </label>
                  <input
                    type="text"
                    className="qm-input qm-ans-input"
                    placeholder={`Nhập phương án ${answerLabels[idx]}...`}
                    value={ans.answer_text}
                    onChange={(e) => handleAnswerTextChange(idx, e.target.value)}
                  />
                  {ans.is_correct && (
                    <span className="qm-correct-badge">Đáp án đúng</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="qm-actions">
            <button
              type="button"
              className="qm-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="qm-btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="qm-spinner" />
                  Đang lưu...
                </>
              ) : isEdit ? (
                'Cập nhật câu hỏi'
              ) : (
                '+ Thêm vào ngân hàng đề'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
