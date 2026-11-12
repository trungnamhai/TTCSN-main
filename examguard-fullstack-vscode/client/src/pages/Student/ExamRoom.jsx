import React, { useEffect, useState, useCallback, useRef } from 'react';
import { apiRequest } from '../../services/api';
import { socket } from '../../services/socket';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { analyzeRealFrame, captureFrameFromVideo, captureLiveThumbnail } from '../../services/vision';
import './ExamRoom.css';

export default function ExamRoom({ authData, onExit, onLogout }) {
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [violations, setViolations] = useState([]);
  const [submitResult, setSubmitResult] = useState(null);
  const [savingStatus, setSavingStatus] = useState('Đã kết nối');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live Camera stream in ExamRoom
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState(new Date().toLocaleTimeString('vi-VN'));

  const student = authData?.student || authData?.user || {};
  const session = authData?.selectedExam || authData?.session || {};

  const [remainingSeconds, setRemainingSeconds] = useState(
    (session.duration_minutes || 30) * 60
  );

  // Khởi động Camera giám sát thời gian thực
  useEffect(() => {
    let active = true;
    async function startLiveCam() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('Trình duyệt không hỗ trợ getUserMedia hoặc bị chặn do HTTP');
          setCameraActive(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch (err) {
        console.warn('Không thể khởi động camera giám sát phòng thi:', err.message);
        setCameraActive(false);
      }
    }
    startLiveCam();

    const timeTimer = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);

    return () => {
      active = false;
      clearInterval(timeTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Khởi tạo lượt thi từ Backend
  useEffect(() => {
    async function initAttempt() {
      setLoading(true);
      setErrorMsg('');
      try {
        const data = await apiRequest('/exam/start', {
          method: 'POST',
          token: authData.token
        });
        setAttempt(data.attempt);
        if (data.attempt?.reference_face_signature) {
          refSigRef.current = data.attempt.reference_face_signature;
        }
        setQuestions(data.questions || []);
        setAnswers(data.savedAnswers || {});

        const code = session.session_code || authData.session?.session_code || 'EXAM88';
        socket.emit('join_session', { sessionCode: code });
      } catch (err) {
        setErrorMsg('Không thể khởi tạo ca thi: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    initAttempt();
  }, [authData, session.session_code]);

  // Đồng hồ đếm ngược
  useEffect(() => {
    if (submitResult || loading) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          doSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [submitResult, loading, answers, attempt]);

  // Giám sát gian lận (Anti-cheat)
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
            attemptId: attempt?.id || session.session_id || 1,
            violationType
          }
        });
      } catch {
        // Tiếp tục làm bài nếu mạng chập chờn
      }
    },
    [authData.token, attempt, session.session_id, submitResult]
  );

  useAntiCheat({
    enabled: !submitResult && !loading,
    onViolation: handleViolation
  });

  // 1. Phân tích AI sinh trắc học & chống thi hộ (chạy định kỳ mỗi 2 giây để giữ CPU máy thí sinh luôn mát)
  const lastFaceWarningRef = useRef(0);
  const [faceStatus, setFaceStatus] = useState('Đang quét khuôn mặt AI...');
  const refSigRef = useRef(null);
  const latestAiResultRef = useRef({
    status: 'OK',
    violationType: null,
    faceCount: 1,
    message: '✓ Xác thực 1 khuôn mặt thí sinh hợp lệ.'
  });

  const getReferenceSignature = useCallback(() => {
    if (refSigRef.current) return refSigRef.current;
    if (authData?.verifiedFace?.faceSignature) {
      refSigRef.current = authData.verifiedFace.faceSignature;
      return refSigRef.current;
    }
    try {
      const stored = sessionStorage.getItem('examguard_ref_signature');
      if (stored) {
        refSigRef.current = JSON.parse(stored);
        return refSigRef.current;
      }
    } catch {
      // ignore
    }
    return null;
  }, [authData?.verifiedFace?.faceSignature]);

  useEffect(() => {
    if (submitResult || loading || !cameraActive) return;

    let isMounted = true;
    const aiInterval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        let refSig = getReferenceSignature();
        const analysis = await analyzeRealFrame(videoRef.current, refSig);
        if (!isMounted) return;

        latestAiResultRef.current = analysis;

        // Nếu chưa có baseline signature, lấy khung hình hợp lệ đầu tiên làm khuôn mặt gốc
        if (!refSig && analysis.faceSignature && analysis.status === 'OK') {
          refSigRef.current = analysis.faceSignature;
          sessionStorage.setItem('examguard_ref_signature', JSON.stringify(analysis.faceSignature));
        }

        if (analysis.status === 'VIOLATION') {
          setFaceStatus(analysis.message);
          const now = Date.now();
          // Tránh spam dồn dập, cảnh báo cách nhau ít nhất 5 giây
          if (now - lastFaceWarningRef.current > 5000) {
            lastFaceWarningRef.current = now;
            handleViolation(analysis.violationType, analysis.message);
          }
        } else {
          setFaceStatus(analysis.message || '✓ Khuôn mặt hợp lệ (Đúng thí sinh)');
        }
      } catch (err) {
        console.warn('Lỗi phân tích AI camera:', err);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(aiInterval);
    };
  }, [submitResult, loading, cameraActive, handleViolation, getReferenceSignature]);

  // 2. Truyền luồng webcam mượt mà (Tốc độ cao ~15 FPS) tới màn hình Giám thị qua Socket
  useEffect(() => {
    if (submitResult || loading || !cameraActive) return;

    const streamInterval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const liveThumb = captureLiveThumbnail(videoRef.current, 320, 240, 0.50);
        const ai = latestAiResultRef.current || {};
        socket.emit('student:camera_heartbeat', {
          studentCode: student.username || student.studentCode || 'SV2026001',
          fullName: student.full_name || student.fullName || student.username || 'Thí sinh',
          sessionCode: session.session_code || 'EXAM88',
          liveFrame: liveThumb,
          faceStatus: ai.status || 'OK',
          violationType: ai.violationType || null,
          faceCount: ai.faceCount || 1,
          message: ai.message || 'Đang phát camera trực tiếp',
          fps: 15,
          sentAt: Date.now()
        });
      } catch {
        // ignore
      }
    }, 66); // 66ms ~ 15 FPS mượt mà như video thật

    return () => {
      clearInterval(streamInterval);
    };
  }, [submitResult, loading, cameraActive, student, session]);

  // Bật / tắt toàn màn hình
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      const fs = Boolean(document.fullscreenElement);
      setIsFullscreen(fs);
      if (!fs && !submitResult && !loading) {
        handleViolation('FULLSCREEN_EXIT', 'Cảnh báo: Thí sinh thoát khỏi chế độ toàn màn hình!');
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [handleViolation, submitResult, loading]);

  // Chọn đáp án
  const handleSelectAnswer = async (questionId, answerId) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerId }));
    setSavingStatus('Đang lưu...');
    try {
      await apiRequest('/exam/save-answer', {
        method: 'POST',
        token: authData.token,
        body: {
          attemptId: attempt?.id || session.session_id || 1,
          questionId,
          selectedAnswerId: answerId
        }
      });
      setSavingStatus(`✓ Đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch {
      setSavingStatus('✓ Đã lưu trên trình duyệt');
    }
  };

  // Nộp bài thi
  const doSubmitExam = async () => {
    setSubmitting(true);
    setShowSubmitModal(false);
    try {
      const res = await apiRequest('/exam/submit', {
        method: 'POST',
        token: authData.token,
        body: {
          attemptId: attempt?.id || session.session_id || 1,
          answers
        }
      });
      const fixedSubmitTime = new Date().toLocaleString('vi-VN');
      setSubmitResult({
        ...res,
        submittedAt: res.submittedAt || res.submitTime || fixedSubmitTime
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      setErrorMsg('Lỗi khi nộp bài: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // MÀN HÌNH KẾT QUẢ SAU KHI NỘP BÀI
  if (submitResult) {
    const score = Number(submitResult.totalScore || 0);
    const isPassed = submitResult.passed || score >= 5.0;
    return (
      <div className="eg-exam-page eg-result-view">
        <div className="eg-result-card">
          <div className="eg-result-header">
            <span className="eg-mini-badge is-easy" style={{ fontSize: '13px', padding: '4px 10px' }}>
              ✓ ĐÃ HOÀN THÀNH & NỘP BÀI THÀNH CÔNG
            </span>
            <h1 className="eg-result-title">Kết quả bài thi</h1>
            <p className="eg-result-desc">
              Hệ thống khảo thí ExamGuard đã tự động chấm điểm và bảo lưu toàn bộ câu trả lời của bạn.
            </p>
          </div>

          <div className="eg-result-metrics-grid">
            <div className="eg-metric-item highlight">
              <span className="eg-metric-lbl">Điểm số đạt được</span>
              <strong className={`eg-metric-val ${isPassed ? 'is-pass' : 'is-fail'}`}>
                {score} / 10.00
              </strong>
            </div>

            <div className="eg-metric-item">
              <span className="eg-metric-lbl">Kết quả đánh giá</span>
              <strong className={`eg-metric-status ${isPassed ? 'is-pass' : 'is-fail'}`}>
                {isPassed ? '✓ ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
              </strong>
            </div>

            <div className="eg-metric-item">
              <span className="eg-metric-lbl">Số câu trả lời đúng</span>
              <strong>{submitResult.correctCount} / {submitResult.totalQuestions} câu</strong>
            </div>

            <div className="eg-metric-item">
              <span className="eg-metric-lbl">Tỷ lệ chính xác</span>
              <strong>{Math.round(((submitResult.correctCount || 0) / (submitResult.totalQuestions || 1)) * 100)}%</strong>
            </div>
          </div>

          <div className="eg-result-info-box">
            <div className="eg-info-line">
              <span>Thí sinh:</span> <strong>{student.full_name || student.fullName || student.username || 'Thí sinh'} ({student.username || student.studentCode || 'SV2026001'})</strong>
            </div>
            <div className="eg-info-line">
              <span>Ca thi:</span> <strong>{session.session_code || 'EXAM88'} — {session.title || 'Kiểm tra trực tuyến'}</strong>
            </div>
            <div className="eg-info-line">
              <span>Thời gian nộp bài:</span> <strong>{submitResult.submittedAt || new Date().toLocaleString('vi-VN')}</strong>
            </div>
            <div className="eg-info-line">
              <span>Giám sát AI ghi nhận:</span>
              <strong style={{ color: violations.length > 0 ? '#b42318' : '#0b6b3a' }}>
                {violations.length} cảnh báo vi phạm
              </strong>
            </div>
          </div>

          <div className="eg-result-actions">
            {onExit && (
              <button type="button" className="eg-primary-btn" onClick={onExit}>
                Xem Lịch sử thi & Về Bảng điều khiển →
              </button>
            )}
            <button type="button" className="eg-btn-cancel" onClick={onLogout}>
              Đăng xuất tài khoản
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const isUrgent = remainingSeconds <= 300; // < 5 phút
  const isCritical = remainingSeconds <= 60; // < 1 phút

  return (
    <div className="eg-exam-page">
      {/* 1. TOP BAR */}
      <header className="eg-exam-topbar">
        <div className="eg-exam-topbar-left">
          <span className="eg-dashboard-eyebrow">PHÒNG THI TRỰC TUYẾN CHÍNH THỨC · EXAMGUARD AI</span>
          <h1 className="eg-exam-main-title">
            {session.title || 'Kiểm tra trắc nghiệm kiến thức'}
          </h1>
          <div className="eg-exam-submeta">
            Mã ca thi: <strong>{session.session_code || 'EXAM88'}</strong> ·
            Thí sinh: <strong>{student.full_name || student.fullName || student.username || 'Thí sinh'}</strong> ({student.username || student.studentCode || 'SV2026001'})
          </div>
        </div>

        <div className="eg-exam-topbar-right">
          {/* Đồng hồ đếm ngược */}
          <div className={`eg-exam-timer-box ${isCritical ? 'is-critical' : isUrgent ? 'is-urgent' : ''}`}>
            <span className="eg-timer-lbl">Thời gian còn lại</span>
            <div className="eg-timer-clock">
              ⏱ {formatTime(remainingSeconds)}
            </div>
          </div>

          <button
            type="button"
            className="eg-btn-fullscreen"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Bật toàn màn hình'}
          >
            {isFullscreen ? '⤢ Thoát toàn màn hình' : '⤡ Toàn màn hình'}
          </button>

          <button
            type="button"
            className="eg-btn-exit-exam"
            onClick={() => setShowExitModal(true)}
            title="Thoát phòng thi về Dashboard"
          >
            Thoát phòng thi
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="eg-dashboard-alert-banner is-error" style={{ margin: '0 24px 16px 24px' }}>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. BODY CHÍNH (2 CỘT) */}
      <main className="eg-exam-workspace">
        {/* CỘT TRÁI: KHU VỰC CÂU HỎI TRẮC NGHIỆM */}
        <section className="eg-panel eg-exam-question-workspace">
          {loading ? (
            <div className="eg-exam-loading-state">
              <div className="eg-spinner" />
              <span>Đang tải đề thi và đồng bộ câu hỏi...</span>
            </div>
          ) : currentQuestion ? (
            <>
              {/* Header câu hỏi */}
              <div className="eg-question-top-bar">
                <div className="eg-q-badge-wrap">
                  <span className="eg-question-number-badge">
                    Câu hỏi {currentIdx + 1} / {questions.length}
                  </span>
                  {currentQuestion.difficulty_level && (
                    <span className={`eg-mini-badge ${
                      currentQuestion.difficulty_level === 'EASY' ? 'is-easy' :
                      currentQuestion.difficulty_level === 'MEDIUM' ? 'is-medium' : 'is-hard'
                    }`}>
                      {currentQuestion.difficulty_level === 'EASY' ? 'Dễ' :
                       currentQuestion.difficulty_level === 'MEDIUM' ? 'Trung bình' : 'Khó'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFlagged((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id]
                    }))
                  }
                  className={`eg-btn-flag ${flagged[currentQuestion.id] ? 'is-flagged' : ''}`}
                >
                  {flagged[currentQuestion.id] ? '★ Đã đánh dấu xem lại' : '☆ Đánh dấu xem lại'}
                </button>
              </div>

              {/* Nội dung câu hỏi */}
              <div className="eg-question-body-text">
                {currentQuestion.content}
              </div>

              {/* Danh sách phương án trả lời */}
              <div className="eg-options-list" role="radiogroup" aria-label="Phương án trả lời">
                {currentQuestion.answers?.map((ans, idx) => {
                  const isSelected = Number(answers[currentQuestion.id]) === ans.id;
                  const letter = String.fromCharCode(65 + idx);
                  return (
                    <button
                      key={ans.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`eg-option-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectAnswer(currentQuestion.id, ans.id)}
                    >
                      <span className="eg-option-indicator">
                        {isSelected ? '✓' : letter}
                      </span>
                      <span className="eg-option-letter">{letter}.</span>
                      <span className="eg-option-text">{ans.answer_text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Thanh điều hướng chuyển câu & Trạng thái lưu */}
              <div className="eg-question-footer-nav">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => i - 1)}
                  className="eg-btn-nav-prev"
                >
                  ← Câu trước
                </button>

                <div className="eg-save-indicator">
                  <span className="eg-save-dot" />
                  <span className="eg-save-text">{savingStatus}</span>
                </div>

                <button
                  type="button"
                  disabled={currentIdx === questions.length - 1}
                  onClick={() => setCurrentIdx((i) => i + 1)}
                  className="eg-btn-nav-next"
                >
                  Câu tiếp theo →
                </button>
              </div>
            </>
          ) : (
            <div className="eg-exam-empty-state">
              Không có câu hỏi nào trong đề thi này.
            </div>
          )}
        </section>

        {/* CỘT PHẢI: GIÁM SÁT AI & BẢNG ĐIỀU HƯỚNG CÂU HỎI */}
        <aside className="eg-exam-sidebar-workspace">
          {/* Widget Camera AI Giám sát thời gian thực */}
          <div className="eg-panel eg-ai-proctoring-widget">
            <div className="eg-widget-header">
              <span className="eg-live-pulse-dot" />
              <h3 className="eg-widget-title">Camera giám sát AI</h3>
              <span className="eg-watermark-time">{currentTimeStr}</span>
            </div>

            <div className="eg-live-cam-box">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`eg-exam-live-video ${cameraActive ? 'is-active' : ''}`}
              />
              {!cameraActive && (
                <div className="eg-cam-offline-cover">
                  <span>Camera AI giám sát đang hoạt động ẩn</span>
                </div>
              )}
              <div className="eg-cam-overlay-badge">● LIVE PROCTORING</div>
            </div>

            <div className="eg-ai-rules-tags">
              <span className="eg-mini-badge is-easy">✓ Khóa Tab</span>
              <span className="eg-mini-badge is-easy">✓ Chặn Copy</span>
              <span className="eg-mini-badge is-easy">✓ OpenCV AI</span>
            </div>

            <div className={`eg-face-realtime-status ${faceStatus.includes('✓') ? 'is-ok' : 'is-warning'}`}>
              <span className="eg-live-status-dot" />
              <span>{faceStatus}</span>
            </div>

            {violations.length > 0 && (
              <div className="eg-violations-list-box">
                <span className="eg-violations-title">Nhật ký cảnh báo ({violations.length}):</span>
                {violations.slice(0, 3).map((v) => (
                  <div key={v.id} className="eg-violation-row">
                    <span className="eg-v-time">[{v.time}]</span>
                    <span className="eg-v-msg">{v.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bảng ma trận điều hướng câu hỏi */}
          <div className="eg-panel eg-question-palette-widget">
            <div className="eg-palette-header">
              <h3 className="eg-widget-title">Danh sách câu hỏi</h3>
              <div className="eg-palette-counts">
                <span className="eg-count-item is-done">Đã làm: {answeredCount}</span>
                <span className="eg-count-item is-left">Chưa làm: {unansweredCount}</span>
                {flaggedCount > 0 && (
                  <span className="eg-count-item is-flag">Đánh dấu: {flaggedCount}</span>
                )}
              </div>
            </div>

            <div className="eg-question-matrix-grid">
              {questions.map((q, idx) => {
                const isCurrent = currentIdx === idx;
                const isAnswered = Boolean(answers[q.id]);
                const isFlag = Boolean(flagged[q.id]);

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`eg-matrix-btn ${isCurrent ? 'is-current' : ''} ${
                      isAnswered ? 'is-answered' : ''
                    } ${isFlag ? 'is-flagged' : ''}`}
                    title={`Câu ${idx + 1}: ${isAnswered ? 'Đã trả lời' : 'Chưa trả lời'}${
                      isFlag ? ' (Có đánh dấu)' : ''
                    }`}
                  >
                    {idx + 1}
                    {isFlag && <span className="eg-matrix-flag-star">★</span>}
                  </button>
                );
              })}
            </div>

            {/* Nút nộp bài */}
            <div className="eg-submit-exam-wrap">
              <button
                type="button"
                className="eg-primary-btn eg-btn-submit-big"
                onClick={() => setShowSubmitModal(true)}
                disabled={submitting}
              >
                {submitting ? 'Đang chấm điểm...' : 'Nộp bài thi ngay'}
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* MODAL XÁC NHẬN NỘP BÀI THI */}
      {showSubmitModal && (
        <div className="eg-modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="eg-modal-card eg-submit-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="eg-dialog-header">
              <div className="eg-dialog-title-group">
                <div className="eg-dialog-icon is-submit">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <h2 className="eg-dialog-title">Xác nhận nộp bài thi</h2>
                  <p className="eg-dialog-subtitle">
                    Ca thi: <strong>{session.session_code || 'EXAM88'}</strong> — {session.title || 'Kiểm tra trắc nghiệm'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="eg-dialog-close-btn"
                onClick={() => setShowSubmitModal(false)}
                title="Đóng cửa sổ"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="eg-dialog-body">
              <p className="eg-dialog-intro">
                Bạn có chắc chắn muốn kết thúc thời gian làm bài và nộp bài thi ngay bây giờ?
              </p>

              <div className="eg-dialog-stats-box">
                <div className="eg-dialog-stat-item">
                  <span className="eg-dstat-label">Tổng số câu hỏi:</span>
                  <strong className="eg-dstat-value">{questions.length} câu</strong>
                </div>

                <div className="eg-dialog-stat-item is-done">
                  <span className="eg-dstat-label">Đã hoàn thành:</span>
                  <strong className="eg-dstat-value is-green">
                    {answeredCount} / {questions.length} câu
                  </strong>
                </div>

                {unansweredCount > 0 ? (
                  <div className="eg-dialog-stat-item is-alert">
                    <span className="eg-dstat-label">Câu chưa trả lời:</span>
                    <strong className="eg-dstat-value is-red">
                      {unansweredCount} câu
                    </strong>
                  </div>
                ) : (
                  <div className="eg-dialog-stat-item is-perfect">
                    <span className="eg-dstat-label">Tiến độ làm bài:</span>
                    <strong className="eg-dstat-value is-green">100% (Đã làm đủ)</strong>
                  </div>
                )}

                {flaggedCount > 0 && (
                  <div className="eg-dialog-stat-item is-flagged">
                    <span className="eg-dstat-label">Đang đánh dấu xem lại:</span>
                    <strong className="eg-dstat-value is-orange">{flaggedCount} câu</strong>
                  </div>
                )}
              </div>

              <div className="eg-dialog-tip-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  Sau khi nộp, hệ thống sẽ tự động chấm điểm và bảo lưu toàn bộ kết quả. Thí sinh không thể sửa lại câu trả lời sau khi đã xác nhận nộp.
                </span>
              </div>
            </div>

            <div className="eg-dialog-footer">
              <button
                type="button"
                className="eg-btn-secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                className="eg-btn-primary-submit"
                onClick={doSubmitExam}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="eg-btn-spinner" />
                    <span>Đang nộp bài...</span>
                  </>
                ) : (
                  <span>Xác nhận nộp bài →</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN THOÁT PHÒNG THI */}
      {showExitModal && (
        <div className="eg-modal-overlay" onClick={() => setShowExitModal(false)}>
          <div className="eg-modal-card eg-submit-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="eg-dialog-header">
              <div className="eg-dialog-title-group">
                <div className="eg-dialog-icon is-exit">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="eg-dialog-title">Rời khỏi phòng thi?</h2>
                  <p className="eg-dialog-subtitle">
                    Thời gian làm bài vẫn đang tiếp tục đếm ngược
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="eg-dialog-close-btn"
                onClick={() => setShowExitModal(false)}
                title="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="eg-dialog-body">
              <p className="eg-dialog-intro" style={{ color: '#0b2545' }}>
                Hệ thống đã tự động lưu các câu trả lời bạn đã chọn. Bạn có thể quay lại phòng thi trước khi hết giờ.
              </p>
              <div className="eg-dialog-tip-box is-warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Nếu thoát mà không quay lại trước khi hết giờ, bài thi sẽ tự động được thu và chấm điểm theo tiến độ hiện tại.</span>
              </div>
            </div>
            <div className="eg-dialog-footer">
              <button type="button" className="eg-btn-secondary" onClick={() => setShowExitModal(false)}>
                Ở lại làm tiếp
              </button>
              {onExit && (
                <button type="button" className="eg-btn-danger" onClick={onExit}>
                  Rời về Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
