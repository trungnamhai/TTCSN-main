import React, { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../services/api';
import { socket } from '../../services/socket';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import './ExamRoom.css';

export default function ExamRoom({ authData, onLogout }) {
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(
    (authData.session.duration_minutes || 30) * 60
  );
  const [violations, setViolations] = useState([]);
  const [submitResult, setSubmitResult] = useState(null);
  const [savingStatus, setSavingStatus] = useState('Đã đồng bộ');

  // Khởi tạo lượt thi từ Backend
  useEffect(() => {
    async function initAttempt() {
      const data = await apiRequest('/exams/start', {
        method: 'POST',
        token: authData.token
      });
      setAttempt(data.attempt);
      setQuestions(data.questions || []);
      setAnswers(data.savedAnswers || {});

      socket.emit('join_session', {
        sessionCode: authData.session.session_code,
        studentCode: authData.student.username,
        role: 'STUDENT'
      });
    }
    initAttempt();
  }, [authData]);

  // Đồng hồ đếm ngược
  useEffect(() => {
    if (submitResult) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitResult, answers, attempt]);

  const handleViolation = useCallback(
    async (violationType, message) => {
      if (submitResult) return;
      const item = {
        id: Date.now(),
        violationType,
        message,
        time: new Date().toLocaleTimeString('vi-VN')
      };
      setViolations((prev) => [item, ...prev]);

      try {
        await apiRequest('/proctoring/report-violation', {
          method: 'POST',
          token: authData.token,
          body: {
            attemptId: attempt?.id || 1,
            violationType
          }
        });
      } catch (e) {
        // Tiếp tục làm bài nếu mạng chập chờn
      }
    },
    [authData.token, attempt, submitResult]
  );

  useAntiCheat({
    enabled: !submitResult,
    onViolation: handleViolation
  });

  const handleSelectAnswer = async (questionId, answerId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerId }));
    setSavingStatus('Đang tự động lưu...');
    try {
      await apiRequest('/exams/save-answer', {
        method: 'POST',
        token: authData.token,
        body: {
          attemptId: attempt?.id || 1,
          questionId,
          selectedAnswerId: answerId
        }
      });
      setSavingStatus('Đã tự động lưu vào MySQL');
    } catch (err) {
      setSavingStatus('Đã lưu tạm trên trình duyệt');
    }
  };

  const handleSubmitExam = async () => {
    const res = await apiRequest('/exams/submit', {
      method: 'POST',
      token: authData.token,
      body: {
        attemptId: attempt?.id || 1,
        answers
      }
    });
    setSubmitResult(res);
  };

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  if (submitResult) {
    return (
      <div className="eg-center-wrapper">
        <div className="eg-auth-card eg-exam-result-card">
          <h1 className="eg-card-title">Kết quả bài thi</h1>
          <p className="eg-card-desc">{submitResult.message}</p>

          <div className="eg-exam-result-details">
            <div className="eg-exam-result-line">
              Thí sinh: <strong>{authData.student.full_name}</strong> ({authData.student.username})
            </div>
            <div className="eg-exam-result-line">
              Ca thi: <strong>{authData.session.session_code}</strong> — {authData.session.title}
            </div>
            <div className="eg-exam-result-line">
              Số câu đúng: <strong>{submitResult.correctCount} / {submitResult.totalQuestions}</strong>
            </div>
            <div className="eg-exam-result-score">
              Điểm số: {submitResult.totalScore} / 10.00
            </div>
          </div>

          <button type="button" className="eg-primary-btn" onClick={onLogout}>
            Hoàn tất & Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];

  return (
    <div className="eg-exam-grid">
      {/* Cột trái: Câu hỏi trắc nghiệm */}
      <div className="eg-panel">
        <div className="eg-exam-header">
          <div>
            <div className="eg-exam-meta">
              Ca thi: <strong>{authData.session.session_code}</strong> · Thí sinh:{' '}
              <strong>{authData.student.username}</strong>
            </div>
            <h2 className="eg-exam-title">
              {authData.session.title}
            </h2>
          </div>

          <div className="eg-exam-timer">
            ⏱ {formatTime(remainingSeconds)}
          </div>
        </div>

        {currentQuestion ? (
          <>
            <div className="eg-question-controls">
              <span className="eg-question-count">
                Câu hỏi {currentIdx + 1} / {questions.length}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFlagged((prev) => ({
                    ...prev,
                    [currentQuestion.id]: !prev[currentQuestion.id]
                  }))
                }
                className={`eg-question-flag ${
                  flagged[currentQuestion.id] ? 'is-flagged' : ''
                }`}
              >
                {flagged[currentQuestion.id] ? '★ Đã đánh dấu xem lại' : '☆ Đánh dấu câu hỏi'}
              </button>
            </div>

            <p className="eg-question-content">
              {currentQuestion.content}
            </p>

            <div>
              {currentQuestion.answers.map((ans, idx) => {
                const isSelected = Number(answers[currentQuestion.id]) === ans.id;
                return (
                  <button
                    key={ans.id}
                    type="button"
                    className={`eg-option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectAnswer(currentQuestion.id, ans.id)}
                  >
                    <strong>{String.fromCharCode(65 + idx)}.</strong> {ans.answer_text}
                  </button>
                );
              })}
            </div>

            <div className="eg-exam-pagination">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => i - 1)}
                className="eg-exam-page-btn"
              >
                ← Câu trước
              </button>

              <span className="eg-exam-saving-status">{savingStatus}</span>

              <button
                type="button"
                disabled={currentIdx === questions.length - 1}
                onClick={() => setCurrentIdx((i) => i + 1)}
                className="eg-exam-page-btn eg-exam-page-next"
              >
                Câu tiếp theo →
              </button>
            </div>
          </>
        ) : (
          <p>Đang tải đề thi...</p>
        )}
      </div>

      {/* Cột phải: Giám sát AI & Danh sách câu hỏi */}
      <div className="eg-exam-sidebar">
        <div className="eg-panel">
          <h3 className="eg-exam-section-title">
            Camera giám sát AI thời gian thực
          </h3>
          <div className="eg-exam-ai-status">
            <div>● AI Proctoring đang hoạt động</div>
            <div className="eg-exam-ai-details">
              Khóa chuyển tab · Chặn Copy/Paste · OpenCV
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              handleViolation('TAB_SWITCH', 'Mô phỏng: Thí sinh chuyển sang tab khác!')
            }
            className="eg-exam-test-violation"
          >
            Test gửi cảnh báo vi phạm về Giám thị
          </button>

          {violations.length > 0 && (
            <div className="eg-exam-violations">
              {violations.map((v) => (
                <div
                  key={v.id}
                  className="eg-exam-violation"
                >
                  [{v.time}] {v.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="eg-panel">
          <h3 className="eg-exam-section-title">
            Bảng điều hướng câu hỏi
          </h3>
          <div className="eg-exam-question-nav">
            {questions.map((q, idx) => {
              const answered = Boolean(answers[q.id]);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`eg-exam-question-nav-btn ${
                    currentIdx === idx ? 'is-current' : ''
                  } ${answered ? 'is-answered' : ''}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="eg-primary-btn eg-exam-submit-btn"
            onClick={handleSubmitExam}
          >
            Nộp bài thi ngay
          </button>
        </div>
      </div>
    </div>
  );
}
