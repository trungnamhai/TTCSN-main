import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './ExamModal.css';

export default function ExamModal({ isOpen, exam, subjects = [], onClose, token, onExamSaved }) {
  const isEditing = Boolean(exam && exam.id);

  const [examCode, setExamCode] = useState('');
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [passingScore, setPassingScore] = useState(5.0);
  const [status, setStatus] = useState('ACTIVE');

  // Matrix & Shuffle config
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [easyCount, setEasyCount] = useState(8);
  const [mediumCount, setMediumCount] = useState(8);
  const [hardCount, setHardCount] = useState(4);
  const [variantsCount, setVariantsCount] = useState(4);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setExamCode(exam.exam_code || '');
        setTitle(exam.title || '');
        setSubjectId(exam.subject_id || (subjects[0]?.id || ''));
        setDurationMinutes(exam.duration_minutes || 60);
        setTotalQuestions(exam.total_questions || 20);
        setPassingScore(exam.passing_score !== undefined ? exam.passing_score : 5.0);
        setStatus(exam.status || 'ACTIVE');
        setShuffleQuestions(exam.shuffle_questions !== undefined ? Boolean(exam.shuffle_questions) : true);
        setShuffleAnswers(exam.shuffle_answers !== undefined ? Boolean(exam.shuffle_answers) : true);
        setEasyCount(exam.easy_count !== undefined ? exam.easy_count : 8);
        setMediumCount(exam.medium_count !== undefined ? exam.medium_count : 8);
        setHardCount(exam.hard_count !== undefined ? exam.hard_count : 4);
        setVariantsCount(exam.variants_count !== undefined ? exam.variants_count : 4);
      } else {
        setExamCode(`EXAM_${Date.now().toString().slice(-4)}`);
        setTitle('');
        setSubjectId(subjects[0]?.id || '');
        setDurationMinutes(60);
        setTotalQuestions(20);
        setPassingScore(5.0);
        setStatus('ACTIVE');
        setShuffleQuestions(true);
        setShuffleAnswers(true);
        setEasyCount(8);
        setMediumCount(8);
        setHardCount(4);
        setVariantsCount(4);
      }
      setErrorMsg('');
    }
  }, [isOpen, exam, subjects]);

  if (!isOpen) return null;

  const currentMatrixSum = Number(easyCount) + Number(mediumCount) + Number(hardCount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tên / tiêu đề bộ đề thi.');
      return;
    }
    if (!durationMinutes || Number(durationMinutes) <= 0) {
      setErrorMsg('Thời gian làm bài phải lớn hơn 0 phút.');
      return;
    }
    if (!totalQuestions || Number(totalQuestions) <= 0) {
      setErrorMsg('Tổng số câu hỏi phải lớn hơn 0.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        exam_code: examCode.trim() || `EXAM_${Date.now().toString().slice(-4)}`,
        title: title.trim(),
        subject_id: subjectId,
        duration_minutes: Number(durationMinutes),
        total_questions: Number(totalQuestions),
        passing_score: Number(passingScore),
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        easy_count: Number(easyCount),
        medium_count: Number(mediumCount),
        hard_count: Number(hardCount),
        variants_count: Number(variantsCount),
        status
      };

      let response;
      if (isEditing) {
        response = await apiRequest(`/teacher/exams/${exam.id}`, {
          method: 'PUT',
          token,
          body: payload
        });
      } else {
        response = await apiRequest('/teacher/exams', {
          method: 'POST',
          token,
          body: payload
        });
      }

      const saved = response.exam || {
        id: exam?.id || Date.now(),
        ...payload
      };

      onExamSaved(saved);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu bộ đề thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-container eg-exam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div>
            <h3 className="eg-modal-title">
              {isEditing ? 'Sửa cấu trúc đề thi & Ma trận trộn đề' : 'Tạo bộ đề thi gốc & Cấu hình ma trận trộn đề'}
            </h3>
            <p className="eg-modal-subtitle">
              Định hình ma trận phân bổ độ khó, thời lượng thi và cơ chế hoán vị câu hỏi/đáp án.
            </p>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose} title="Đóng">✕</button>
        </div>

        {errorMsg && <div className="eg-modal-alert-error" role="alert">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="eg-modal-form">
          {/* Group 1: Thông tin cơ bản */}
          <div className="eg-form-section-title">1. Thông tin chung bộ đề</div>

          <div className="eg-modal-grid-2">
            <div className="eg-form-group">
              <label className="eg-form-label">
                Mã đề thi gốc <span className="eg-required">*</span>
              </label>
              <input
                type="text"
                className="eg-input eg-monospace-input"
                placeholder="VD: EX_SEC_MID_2026"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                autoFocus
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">
                Môn học / Chủ đề <span className="eg-required">*</span>
              </label>
              <select
                className="eg-select"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_code} — {s.subject_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="eg-form-group">
            <label className="eg-form-label">
              Tên / Tiêu đề bộ đề thi <span className="eg-required">*</span>
            </label>
            <input
              type="text"
              className="eg-input"
              placeholder="VD: Đề thi Giữa kỳ: An ninh Mạng và An toàn Thông tin..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Group 2: Cấu trúc & thời gian làm bài */}
          <div className="eg-form-section-title">2. Cấu trúc đề & Thời gian làm bài</div>

          <div className="eg-modal-grid-3">
            <div className="eg-form-group">
              <label className="eg-form-label">Thời gian thi (phút)</label>
              <input
                type="number"
                min="5"
                max="360"
                className="eg-input"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">Tổng số câu hỏi</label>
              <input
                type="number"
                min="1"
                max="200"
                className="eg-input"
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(e.target.value)}
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">Điểm đạt (Thang 10)</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                className="eg-input"
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>
          </div>

          {/* Group 3: Ma trận trộn đề & hoán vị câu hỏi */}
          <div className="eg-form-section-title">
            3. Ma trận độ khó & Cơ chế trộn đề tự động
            {currentMatrixSum !== Number(totalQuestions) && (
              <span className="eg-matrix-warning-badge">
                Lưu ý: Tổng số câu ma trận ({currentMatrixSum}) chưa khớp tổng số câu đề ({totalQuestions})
              </span>
            )}
          </div>

          <div className="eg-matrix-grid">
            <div className="eg-matrix-item is-easy">
              <label className="eg-matrix-label">Dễ (Easy)</label>
              <input
                type="number"
                min="0"
                className="eg-input eg-matrix-input"
                value={easyCount}
                onChange={(e) => setEasyCount(e.target.value)}
              />
              <span className="eg-matrix-ratio">
                {totalQuestions > 0 ? Math.round((easyCount / totalQuestions) * 100) : 0}%
              </span>
            </div>

            <div className="eg-matrix-item is-medium">
              <label className="eg-matrix-label">Trung bình (Medium)</label>
              <input
                type="number"
                min="0"
                className="eg-input eg-matrix-input"
                value={mediumCount}
                onChange={(e) => setMediumCount(e.target.value)}
              />
              <span className="eg-matrix-ratio">
                {totalQuestions > 0 ? Math.round((mediumCount / totalQuestions) * 100) : 0}%
              </span>
            </div>

            <div className="eg-matrix-item is-hard">
              <label className="eg-matrix-label">Khó (Hard)</label>
              <input
                type="number"
                min="0"
                className="eg-input eg-matrix-input"
                value={hardCount}
                onChange={(e) => setHardCount(e.target.value)}
              />
              <span className="eg-matrix-ratio">
                {totalQuestions > 0 ? Math.round((hardCount / totalQuestions) * 100) : 0}%
              </span>
            </div>

            <div className="eg-matrix-item is-variants">
              <label className="eg-matrix-label">Số mã đề hoán vị</label>
              <select
                className="eg-select eg-matrix-input"
                value={variantsCount}
                onChange={(e) => setVariantsCount(e.target.value)}
              >
                <option value={1}>1 mã đề gốc</option>
                <option value={2}>2 mã đề (101, 102)</option>
                <option value={4}>4 mã đề (101 - 104)</option>
                <option value={8}>8 mã đề (101 - 108)</option>
              </select>
              <span className="eg-matrix-ratio">Sinh tự động</span>
            </div>
          </div>

          {/* Shuffle Options Checkboxes */}
          <div className="eg-shuffle-options">
            <label className="eg-checkbox-label">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
              />
              <span>
                <strong>Đảo thứ tự câu hỏi (`shuffle_questions`):</strong> Mỗi thí sinh nhận thứ tự câu hỏi ngẫu nhiên trong đề.
              </span>
            </label>

            <label className="eg-checkbox-label">
              <input
                type="checkbox"
                checked={shuffleAnswers}
                onChange={(e) => setShuffleAnswers(e.target.checked)}
              />
              <span>
                <strong>Đảo phương án trả lời (`shuffle_answers`):</strong> Tự động hoán vị vị trí các phương án A, B, C, D chống nhìn bài.
              </span>
            </label>
          </div>

          <div className="eg-modal-actions">
            <button type="button" className="eg-btn-cancel" onClick={onClose} disabled={loading}>
              Hủy bỏ
            </button>
            <button type="submit" className="eg-btn-submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEditing ? 'Cập nhật bộ đề' : '+ Khởi tạo bộ đề thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
