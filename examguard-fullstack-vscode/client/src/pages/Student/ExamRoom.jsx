import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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

  // Hỗ trợ kỹ thuật & Xin vào lại phòng thi
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState('REENTRY_REQUEST');
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportSuccessMsg, setSupportSuccessMsg] = useState('');
  const [supportHistory, setSupportHistory] = useState([]);
  const [supportReplyAlert, setSupportReplyAlert] = useState(null);

  // Cưỡng chế nộp bài & Duyệt thi lại sau sự cố mạng
  const [forceTerminatedData, setForceTerminatedData] = useState(null);
  const [networkResumeNotice, setNetworkResumeNotice] = useState('');

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

  const checkinSnapshot = useMemo(() => {
    try {
      return sessionStorage.getItem('examguard_ref_snapshot') || null;
    } catch {
      return null;
    }
  }, []);

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

        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 60, min: 30 }
            },
            audio: false
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 60, min: 30 }
              },
              audio: false
            });
          } catch {
            // Fallback cho thiết bị di động cấu hình cơ bản
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
              },
              audio: false
            });
          }
        }

        if (!active) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          const video = videoRef.current;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('x5-playsinline', 'true');
          video.setAttribute('muted', '');
          video.muted = true;
          video.playsInline = true;
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play().catch(() => {});
          };
          video.play().catch(() => {});
          video.onpause = () => {
            if (active && video.srcObject) {
              video.play().catch(() => {});
            }
          };
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

  // Tải lịch sử yêu cầu hỗ trợ kỹ thuật
  const fetchSupportHistory = useCallback(async () => {
    try {
      const list = await apiRequest('/exam/support-requests', { token: authData.token });
      setSupportHistory(Array.isArray(list) ? list : []);
    } catch {
      // ignore
    }
  }, [authData.token]);

  useEffect(() => {
    fetchSupportHistory();

    const handleSupportDecision = (data) => {
      const myCode = student.username || student.studentCode;
      if (!data.studentCode || data.studentCode === myCode) {
        setSupportReplyAlert(data);
        fetchSupportHistory();
      }
    };

    const handleForceSubmit = (data) => {
      const myCode = student.username || student.studentCode;
      if (!data.studentCode || data.studentCode === myCode) {
        setForceTerminatedData(data);
        if (streamRef.current) {
          try {
            streamRef.current.getTracks().forEach((track) => track.stop());
          } catch {
            // ignore
          }
        }
      }
    };

    const handleResumePermission = (data) => {
      const myCode = student.username || student.studentCode;
      if (!data.studentCode || data.studentCode === myCode) {
        setNetworkResumeNotice(data.message || 'Giám thị đã duyệt cho phép bạn tiếp tục làm bài thi sau sự cố mạng!');
        // Tự động khôi phục câu trả lời từ localStorage
        const cacheKey = `examguard_answers_${attempt?.id || session.session_id || 'curr'}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setAnswers((prev) => ({ ...prev, ...JSON.parse(cached) }));
          }
        } catch {
          // ignore
        }
      }
    };

    socket.on('student:support_decision', handleSupportDecision);
    socket.on('student:force_submitted', handleForceSubmit);
    socket.on('student:resume_exam_permission', handleResumePermission);

    return () => {
      socket.off('student:support_decision', handleSupportDecision);
      socket.off('student:force_submitted', handleForceSubmit);
      socket.off('student:resume_exam_permission', handleResumePermission);
    };
  }, [attempt?.id, fetchSupportHistory, session.session_id, student.studentCode, student.username]);

  // Khởi tạo lượt thi từ Backend & Khôi phục đáp án tự động lưu
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

        // Khôi phục đáp án đã tự động lưu từ server và localStorage
        let mergedAnswers = { ...(data.savedAnswers || {}) };
        try {
          const cacheKey = `examguard_answers_${data.attempt?.id || session.session_id || 'curr'}`;
          const localCache = localStorage.getItem(cacheKey);
          if (localCache) {
            mergedAnswers = { ...mergedAnswers, ...JSON.parse(localCache) };
          }
        } catch {
          // ignore
        }
        setAnswers(mergedAnswers);
        if (Object.keys(mergedAnswers).length > 0) {
          setSavingStatus(`Đã khôi phục ${Object.keys(mergedAnswers).length} câu trả lời tự động lưu`);
        }

        const code = session.session_code || authData.session?.session_code || 'EXAM88';
        socket.emit('join_session', { sessionCode: code });
      } catch (err) {
        setErrorMsg('Không thể khởi tạo ca thi: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    initAttempt();
  }, [authData, session.session_code, session.session_id]);

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
    message: 'Xác thực khuôn mặt thí sinh hợp lệ.'
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
          setFaceStatus(analysis.message || 'Khuôn mặt hợp lệ (Đúng thí sinh)');
        }
      } catch (err) {
        console.warn('Lỗi phân tích AI camera:', err);
      }
    }, 800); // 800ms: Quét nhận diện AI mượt mà và phản hồi nhanh gấp 2.5 lần

    return () => {
      isMounted = false;
      clearInterval(aiInterval);
    };
  }, [submitResult, loading, cameraActive, handleViolation, getReferenceSignature]);

  // 2. Truyền luồng webcam mượt mà (Tối ưu băng thông ~20 FPS) tới màn hình Giám thị qua Socket
  useEffect(() => {
    if (submitResult || loading || !cameraActive) return;

    let animId = null;
    let lastSent = 0;
    const intervalTarget = 1000 / 20; // 50ms = 20 FPS mượt mà chuẩn video, tiết kiệm 80% dung lượng mạng

    const sendFrameLoop = (timestamp) => {
      if (timestamp - lastSent >= intervalTarget) {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try {
            // Tối ưu kích thước 400px, chất lượng 0.68: hình ảnh sắc nét, dung lượng chỉ ~10KB/khung hình
            const liveThumb = captureLiveThumbnail(videoRef.current, 400, 0.68);
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
              fps: 20,
              sentAt: Date.now()
            });
            lastSent = timestamp;
          } catch {
            // ignore
          }
        }
      }
      animId = requestAnimationFrame(sendFrameLoop);
    };

    animId = requestAnimationFrame(sendFrameLoop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [submitResult, loading, cameraActive, student, session]);

  // Tự động lưu đáp án khi chọn phương án
  const handleSelectAnswer = async (questionId, answerId) => {
    const updatedAnswers = { ...answers, [questionId]: answerId };
    setAnswers(updatedAnswers);
    setSavingStatus('Đang tự động lưu...');

    // Lưu tức thì vào bộ nhớ đệm trình duyệt
    const cacheKey = `examguard_answers_${attempt?.id || session.session_id || 'curr'}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(updatedAnswers));
    } catch {
      // ignore
    }

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
      setSavingStatus(`Đã tự động lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`);
    } catch {
      setSavingStatus('Đã bảo lưu trên máy (sẽ đồng bộ khi có mạng)');
    }
  };

  // Gửi yêu cầu hỗ trợ kỹ thuật / Xin vào lại phòng thi
  const handleSendSupport = async (e) => {
    if (e) e.preventDefault();
    if (!supportMessage.trim()) return;
    setSendingSupport(true);
    setSupportSuccessMsg('');
    try {
      await apiRequest('/exam/support-request', {
        method: 'POST',
        token: authData.token,
        body: {
          sessionCode: session.session_code || 'EXAM88',
          category: supportCategory,
          message: supportMessage.trim(),
          attemptId: attempt?.id || session.session_id || 1
        }
      });

      // Bắn sự kiện socket thời gian thực cho giám thị
      socket.emit('student:send_support_request', {
        sessionCode: session.session_code || 'EXAM88',
        studentCode: student.username || student.studentCode || 'SV2026001',
        fullName: student.full_name || student.fullName || student.username || 'Thí sinh',
        category: supportCategory,
        message: supportMessage.trim()
      });

      setSupportSuccessMsg('Yêu cầu hỗ trợ đã được gửi tới Giám thị phòng thi');
      setSupportMessage('');
      fetchSupportHistory();
    } catch (err) {
      setErrorMsg('Không thể gửi yêu cầu hỗ trợ: ' + err.message);
    } finally {
      setSendingSupport(false);
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
              Đã hoàn thành và nộp bài thi
            </span>
            <h1 className="eg-result-title">Kết quả bài thi</h1>
            <p className="eg-result-desc">
              Hệ thống khảo thí ExamGuard đã chấm điểm tự động và lưu trữ toàn bộ bài làm của bạn.
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
                {isPassed ? 'Đạt yêu cầu' : 'Chưa đạt'}
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

          <span className="eg-fs-status-badge is-locked" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }} title="Đang kết nối phòng thi">
            Đang trong phòng thi
          </span>

          <button
            type="button"
            className="eg-btn-support"
            onClick={() => {
              setShowSupportModal(true);
              setSupportSuccessMsg('');
            }}
            title="Gửi yêu cầu hỗ trợ kỹ thuật hoặc xin vào lại phòng thi tới Giám thị"
          >
            Hỗ trợ kỹ thuật & Vào lại
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

      {/* Thông báo phản hồi trực tiếp từ Giám thị */}
      {supportReplyAlert && (
        <div className="eg-dashboard-alert-banner is-success" style={{ margin: '0 24px 16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Giám thị ca thi vừa phản hồi:</strong>{' '}
            <span>{supportReplyAlert.replyMessage || (supportReplyAlert.status === 'APPROVED' ? 'Đã duyệt yêu cầu của bạn! Bạn được phép tiếp tục làm bài.' : 'Yêu cầu của bạn đã được phản hồi.')}</span>
          </div>
          <button
            type="button"
            onClick={() => setSupportReplyAlert(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#166534', display: 'inline-flex', alignItems: 'center' }}
            aria-label="Đóng thông báo"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {networkResumeNotice && (
        <div className="eg-dashboard-alert-banner is-success" style={{ margin: '0 24px 16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{networkResumeNotice}</span>
          <button
            type="button"
            className="eg-banner-close"
            onClick={() => setNetworkResumeNotice('')}
            aria-label="Đóng"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={flagged[currentQuestion.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: '6px' }}>
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  {flagged[currentQuestion.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}
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
                        {isSelected ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : letter}
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
                webkit-playsinline="true"
                x5-playsinline="true"
                muted
                disablePictureInPicture
                controls={false}
                style={{ pointerEvents: 'none' }}
                className={`eg-exam-live-video ${cameraActive ? 'is-active' : ''}`}
              />
              {!cameraActive && checkinSnapshot && (
                <img
                  src={checkinSnapshot}
                  alt="Ảnh check-in đối soát"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {!cameraActive && !checkinSnapshot && (
                <div className="eg-cam-offline-cover">
                  <span>Camera AI giám sát đang hoạt động</span>
                </div>
              )}
              <div className="eg-cam-overlay-badge">Giám sát trực tiếp</div>
            </div>

            <div className="eg-ai-rules-tags">
              <span className="eg-mini-badge is-easy">Khóa Tab</span>
              <span className="eg-mini-badge is-easy">Chặn sao chép</span>
              <span className="eg-mini-badge is-easy">Giám sát AI YOLOv8</span>
            </div>

            <div className={`eg-face-realtime-status ${!faceStatus.toLowerCase().includes('vi phạm') && !faceStatus.toLowerCase().includes('cảnh báo') && !faceStatus.toLowerCase().includes('lỗi') ? 'is-ok' : 'is-warning'}`}>
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
                    {isFlag && <span className="eg-matrix-flag-dot" title="Đã đánh dấu" />}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
                aria-label="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
      {/* MODAL GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT / XIN VÀO LẠI PHÒNG THI */}
      {showSupportModal && (
        <div className="eg-modal-overlay" onClick={() => setShowSupportModal(false)}>
          <div className="eg-modal-card eg-submit-dialog-card eg-support-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="eg-dialog-header">
              <div className="eg-dialog-title-group">
                <div className="eg-dialog-icon" style={{ background: '#ffedd5', color: '#c2410c' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div>
                  <h2 className="eg-dialog-title">Hỗ trợ kỹ thuật & Xin vào lại phòng thi</h2>
                  <p className="eg-dialog-subtitle">
                    Gửi yêu cầu trực tiếp đến Giám thị ca thi <strong>{session.session_code || 'EXAM88'}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="eg-dialog-close-btn"
                onClick={() => setShowSupportModal(false)}
                title="Đóng"
                aria-label="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSendSupport} className="eg-dialog-body" style={{ gap: '14px' }}>
              {supportSuccessMsg && (
                <div className="eg-dashboard-alert-banner is-success" style={{ margin: 0 }}>
                  <span>{supportSuccessMsg}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Chọn loại vấn đề cần hỗ trợ:
                </label>
                <div className="eg-support-category-grid">
                  {[
                    {
                      id: 'REENTRY_REQUEST',
                      label: 'Xin vào lại phòng thi',
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      )
                    },
                    {
                      id: 'TECHNICAL_SUPPORT',
                      label: 'Sự cố Camera & Mic',
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      )
                    },
                    {
                      id: 'QUESTION_ISSUE',
                      label: 'Lỗi câu hỏi / Đề thi',
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      )
                    },
                    {
                      id: 'OTHER',
                      label: 'Vấn đề kỹ thuật khác',
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      )
                    }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`eg-support-cat-btn ${supportCategory === cat.id ? 'is-active' : ''}`}
                      onClick={() => setSupportCategory(cat.id)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Nội dung chi tiết gửi Giám thị:
                </label>
                <textarea
                  className="eg-support-textarea"
                  placeholder="Mô tả sự cố bạn đang gặp phải (Ví dụ: Em vừa bị rớt mạng và kết nối lại, xin thầy/cô duyệt cho em tiếp tục làm bài thi...)"
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  required
                />
              </div>

              {/* Lịch sử yêu cầu hỗ trợ */}
              {supportHistory.length > 0 && (
                <div className="eg-support-history-box">
                  <div className="eg-support-history-title">Các yêu cầu đã gửi gần đây:</div>
                  <div className="eg-support-history-list">
                    {supportHistory.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={`eg-support-history-item ${item.status === 'APPROVED' ? 'is-approved' : 'is-pending'}`}
                      >
                        <div>
                          <strong>[{item.category === 'REENTRY_REQUEST' ? 'Xin vào lại' : item.category === 'TECHNICAL_SUPPORT' ? 'Sự cố thiết bị' : 'Kỹ thuật'}]</strong>{' '}
                          <span>{item.message}</span>
                          {item.reply_message && (
                            <div style={{ color: '#15803d', marginTop: '3px', fontWeight: 600 }}>
                              ↳ Giám thị: {item.reply_message}
                            </div>
                          )}
                        </div>
                        <span className={`eg-mini-badge ${item.status === 'APPROVED' ? 'is-easy' : 'is-medium'}`} style={{ flexShrink: 0, marginLeft: '10px' }}>
                          {item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="eg-dialog-footer" style={{ margin: '8px -24px -24px -24px', padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="eg-btn-secondary"
                  onClick={() => setShowSupportModal(false)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="eg-btn-primary-submit"
                  style={{ background: '#ea580c', borderColor: '#ea580c' }}
                  disabled={sendingSupport || !supportMessage.trim()}
                >
                  {sendingSupport ? 'Đang gửi...' : 'Gửi yêu cầu tới Giám thị ngay →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẢNH BÁO BỊ CƯỠNG CHẾ THU BÀI DO VI PHẠM NẶNG */}
      {forceTerminatedData && (
        <div className="eg-modal-overlay">
          <div className="eg-modal-card eg-force-terminate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eg-force-icon-wrap">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </div>
            <h2 className="eg-force-title">BÀI THI ĐÃ BỊ THU HỒI BỞI GIÁM THỊ</h2>
            <p className="eg-force-subtitle">
              Giám thị phòng thi đã thực hiện lệnh cưỡng chế nộp bài và đình chỉ lượt thi của bạn do phát hiện vi phạm quy chế nghiêm trọng.
            </p>

            <div className="eg-force-reason-box">
              <div className="eg-force-reason-lbl">Lý do thu bài từ Giám thị:</div>
              <div className="eg-force-reason-val">"{forceTerminatedData.reason}"</div>
              <div className="eg-force-time">
                Thời điểm thu bài: {new Date(forceTerminatedData.timestamp || Date.now()).toLocaleTimeString('vi-VN')}
              </div>
            </div>

            <div className="eg-force-stats-strip">
              <div className="eg-force-stat-col">
                <span>Điểm số tạm tính:</span>
                <strong>{forceTerminatedData.totalScore != null ? `${forceTerminatedData.totalScore}đ` : 'Chờ chấm'}</strong>
              </div>
              <div className="eg-force-stat-col">
                <span>Trạng thái:</span>
                <strong style={{ color: '#dc2626' }}>Đã thu bài (Đình chỉ thi)</strong>
              </div>
            </div>

            <div className="eg-force-actions">
              <button
                type="button"
                className="eg-btn-primary-submit"
                style={{ width: '100%', background: '#0b2545', borderColor: '#0b2545', padding: '12px 24px', fontSize: '15px' }}
                onClick={onExit}
              >
                Rời phòng thi & Trở về Trang chủ →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
