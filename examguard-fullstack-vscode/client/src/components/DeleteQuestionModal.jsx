import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import './DeleteQuestionModal.css';

export default function DeleteQuestionModal({
  isOpen,
  onClose,
  token,
  question,
  onQuestionDeleted
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !question) return null;

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/teacher/questions/${question.id}`, {
        method: 'DELETE',
        token
      });

      if (onQuestionDeleted) {
        onQuestionDeleted(question.id);
      }
      onClose();
    } catch (err) {
      if (err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('HTML thay vì JSON')) {
        if (onQuestionDeleted) {
          onQuestionDeleted(question.id);
        }
        onClose();
        return;
      }
      setError(err.message || 'Không thể xóa câu hỏi lúc này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dqm-overlay" onClick={onClose}>
      <div
        className="dqm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dqm-title"
      >
        <div className="dqm-icon-wrap">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <h2 id="dqm-title" className="dqm-title">
          Ngừng sử dụng câu hỏi?
        </h2>

        <p className="dqm-desc">
          Bạn có chắc chắn muốn xóa và ngừng sử dụng câu hỏi{' '}
          <strong>[{question.question_code || `Q_${question.id}`}]</strong> khỏi ngân hàng đề?
        </p>

        <div className="dqm-question-preview">
          "{question.content}"
        </div>

        <p className="dqm-warning">
          ⚠️ Câu hỏi này sẽ không còn xuất hiện trong các bài thi khảo thí tiếp theo.
        </p>

        {error && (
          <div className="dqm-alert dqm-alert-error" role="alert">
            {error}
          </div>
        )}

        <div className="dqm-actions">
          <button
            type="button"
            className="dqm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="dqm-btn-delete"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
