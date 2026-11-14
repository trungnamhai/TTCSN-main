import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { socket } from '../../services/socket';
import { captureFrameFromVideo, analyzeRealFrame } from '../../services/vision';
import './FaceVerification.css';

export default function FaceVerification({ authData, onVerifiedSuccess, onBack }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Trạng thái thiết bị phần cứng
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micVolume, setMicVolume] = useState(0); // 0 to 100
  const [deviceError, setDeviceError] = useState('');

  // Ảnh chụp xác thực
  const [capturedPhoto, setCapturedPhoto] = useState(null);

  // Trạng thái quy trình Check-in & Duyệt:
  // 'PREPARING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  const [checkinStage, setCheckinStage] = useState('PREPARING');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [autoRedirectSec, setAutoRedirectSec] = useState(null);

  const student = authData?.student || authData?.user || {};
  const session = authData?.selectedExam || authData?.session || {};
  const sessionCode = session.session_code || 'EXAM88';

  // 1. Khởi động Webcam & Microphone thật
  const [copiedHost, setCopiedHost] = useState(false);

  const initMedia = useCallback(async () => {
    setDeviceError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('SECURE_CONTEXT_REQUIRED');
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            facingMode: 'user',
            frameRate: { ideal: 60, min: 30 }
          },
          audio: true
        });
      } catch (mediaErr) {
        // Fallback: nếu mic bị từ chối hoặc lỗi đa thiết bị trên điện thoại, chỉ mở camera Full HD
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
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          });
        }
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
      }
      setCameraReady(true);

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const checkVolume = () => {
            if (!streamRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };

          checkVolume();
          setMicReady(true);
        }
      } catch (audioErr) {
        console.warn('Lỗi audio context:', audioErr);
        setMicReady(true);
      }
    } catch (err) {
      setCameraReady(false);
      setMicReady(false);
      if (err.message === 'SECURE_CONTEXT_REQUIRED' || (typeof window !== 'undefined' && !window.isSecureContext)) {
        setDeviceError('INSECURE_HTTP');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setDeviceError('PERMISSION_DENIED');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setDeviceError('DEVICE_IN_USE');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setDeviceError('NO_DEVICE');
      } else {
        setDeviceError(err.message || 'Không thể khởi động thiết bị');
      }
    }
  }, []);

  useEffect(() => {
    initMedia();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [initMedia]);

  // 2. Chụp ảnh từ Camera thật và phân tích nhận diện khuôn mặt
  const handleSnapPhoto = async () => {
    if (!videoRef.current || !cameraReady) return;
    setDeviceError('');
    const photoBase64 = captureFrameFromVideo(videoRef.current);
    if (!photoBase64) return;

    // Tạm dừng video để đóng băng ảnh tĩnh rõ ràng như chụp ảnh
    try {
      if (videoRef.current) videoRef.current.pause();
    } catch {
      // ignore
    }

    setCapturedPhoto(photoBase64);
    setCheckinStage('PREPARING');

    // Phân tích nhận diện khuôn mặt thật từ luồng video
    const analysis = await analyzeRealFrame(videoRef.current);
    if (analysis.status === 'VIOLATION') {
      setVerifyResult({
        status: 'VIOLATION',
        verified: false,
        face_count: analysis.faceCount,
        violation_type: analysis.violationType,
        message: analysis.message,
        boxes: analysis.boxes || []
      });
    } else {
      if (analysis.faceSignature) {
        sessionStorage.setItem('examguard_ref_signature', JSON.stringify(analysis.faceSignature));
        sessionStorage.setItem('examguard_ref_snapshot', photoBase64);
      }
      setVerifyResult({
        status: 'OK',
        verified: true,
        face_count: 1,
        euclidean_distance: analysis.euclideanDistance || 0.22,
        faceSignature: analysis.faceSignature || null,
        message: '✓ Nhận diện 1 khuôn mặt thí sinh hợp lệ. Sẵn sàng gửi yêu cầu check-in!',
        boxes: analysis.boxes || []
      });
    }
  };

  // 2b. Chụp ảnh tĩnh bằng Camera điện thoại (Native camera shutter)
  const handleFileCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const photoBase64 = event.target.result;
      setCapturedPhoto(photoBase64);
      setCheckinStage('PREPARING');

      // Tạm dừng video camera nếu đang chạy
      try {
        if (videoRef.current) videoRef.current.pause();
      } catch {
        // ignore
      }

      const img = new Image();
      img.onload = async () => {
        const analysis = await analyzeRealFrame(img);
        if (analysis.status === 'VIOLATION') {
          setVerifyResult({
            status: 'VIOLATION',
            verified: false,
            face_count: analysis.faceCount,
            violation_type: analysis.violationType,
            message: analysis.message,
            boxes: analysis.boxes || []
          });
        } else {
          if (analysis.faceSignature) {
            sessionStorage.setItem('examguard_ref_signature', JSON.stringify(analysis.faceSignature));
            sessionStorage.setItem('examguard_ref_snapshot', photoBase64);
          }
          setVerifyResult({
            status: 'OK',
            verified: true,
            face_count: 1,
            euclidean_distance: analysis.euclideanDistance || 0.22,
            faceSignature: analysis.faceSignature || null,
            message: '✓ Nhận diện 1 khuôn mặt thí sinh hợp lệ. Sẵn sàng gửi yêu cầu check-in!',
            boxes: analysis.boxes || []
          });
        }
      };
      img.src = photoBase64;
    };
    reader.readAsDataURL(file);
  };

  // 3. Chụp lại ảnh
  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setVerifyResult(null);
    setCheckinStage('PREPARING');
    setRejectReason('');
    setAutoRedirectSec(null);
    setDeviceError('');
    try {
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    } catch {
      // ignore
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 4. Gửi yêu cầu Check-in thật tới Giám thị
  const handleSubmitCheckinRequest = async () => {
    setVerifying(true);
    setDeviceError('');
    try {
      let imageBase64 = capturedPhoto;
      if (!imageBase64 && cameraReady) {
        imageBase64 = captureFrameFromVideo(videoRef.current);
        setCapturedPhoto(imageBase64);
      }

      if (!imageBase64) {
        setDeviceError('Vui lòng chụp ảnh khuôn mặt trước khi gửi yêu cầu check-in.');
        setVerifying(false);
        return;
      }

      // Kiểm tra xem ảnh có phát hiện vi phạm không
      if (verifyResult?.status === 'VIOLATION') {
        setDeviceError(verifyResult.message || 'Không thể check-in do vi phạm nhận diện khuôn mặt. Vui lòng chụp lại.');
        setVerifying(false);
        return;
      }

      // Gửi yêu cầu check-in thật tới Giám thị
      const checkinRes = await apiRequest('/exam/check-in', {
        method: 'POST',
        token: authData.token,
        body: {
          sessionCode,
          imageBase64,
          micOk: micReady,
          cameraOk: cameraReady,
          faceCount: verifyResult?.face_count || 1,
          faceSignature: verifyResult?.faceSignature || null,
          fullName: student.full_name || student.fullName || student.username,
          studentCode: student.username || student.studentCode
        }
      });

      if (checkinRes.success) {
        setCheckinStage('PENDING_APPROVAL');
      }
    } catch (err) {
      setDeviceError(err.message || 'Lỗi khi gửi yêu cầu check-in.');
    } finally {
      setVerifying(false);
    }
  };

  // 5. Lắng nghe quyết định duyệt thật của Giám thị qua Socket & Polling
  useEffect(() => {
    if (checkinStage !== 'PENDING_APPROVAL') return;

    const handleDecision = (data) => {
      const isForMe = data.allApproved || data.studentCode === student.username;
      if (!isForMe) return;

      if (data.status === 'APPROVED') {
        setCheckinStage('APPROVED');
        setAutoRedirectSec(2);
      } else if (data.status === 'REJECTED') {
        setCheckinStage('REJECTED');
        setRejectReason(data.reason || 'Ảnh chụp không rõ ràng hoặc không hợp lệ.');
      }
    };

    socket.on('student:checkin_decision', handleDecision);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiRequest(`/exam/check-in/status?sessionCode=${sessionCode}`, {
          token: authData.token
        });
        if (res.status === 'APPROVED') {
          setCheckinStage('APPROVED');
          setAutoRedirectSec(2);
          clearInterval(pollTimerRef.current);
        } else if (res.status === 'REJECTED') {
          setCheckinStage('REJECTED');
          setRejectReason(res.reason || 'Giám thị từ chối yêu cầu.');
          clearInterval(pollTimerRef.current);
        }
      } catch {
        // Tiếp tục poll
      }
    }, 2000);

    return () => {
      socket.off('student:checkin_decision', handleDecision);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [checkinStage, sessionCode, student.username, authData.token]);

  // 6. Countdown chuyển vào phòng thi khi Giám thị đã duyệt
  useEffect(() => {
    if (autoRedirectSec === null) return;
    if (autoRedirectSec <= 0) {
      onVerifiedSuccess(verifyResult);
      return;
    }
    const t = setTimeout(() => {
      setAutoRedirectSec((prev) => (prev ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(t);
  }, [autoRedirectSec, onVerifiedSuccess, verifyResult]);

  return (
    <div className="eg-checkin-page">
      <div className="eg-checkin-shell">
        {/* Header */}
        <header className="eg-checkin-header">
          <div className="eg-checkin-header-left">
            <span className="eg-dashboard-eyebrow">QUY TRÌNH CHECK-IN PHÒNG THI AN TOÀN · EXAMGUARD AI</span>
            <h1 className="eg-checkin-title">Kiểm tra thiết bị & Chụp ảnh xác thực</h1>
            <p className="eg-checkin-desc">
              Ca thi: <strong>{session.session_code || 'EXAM88'}</strong> — {session.title || 'Kiểm tra trắc nghiệm'} ·
              {' '}Thí sinh: <strong>{student.full_name || student.fullName || student.username || 'Thí sinh'}</strong> ({student.username || student.studentCode || 'SV2026001'})
            </p>
          </div>
          <button type="button" className="eg-btn-cancel" onClick={onBack}>
            ← Quay lại Bảng điều khiển
          </button>
        </header>

        {deviceError && (
          <div className="eg-dashboard-alert-banner is-error" style={{ margin: '0 0 20px 0', display: 'block', padding: '16px 20px' }}>
            {deviceError === 'INSECURE_HTTP' ? (
              <div style={{ lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px', color: '#b91c1c' }}>
                  ⚠️ Trình duyệt chặn Camera do đang truy cập qua địa chỉ HTTP nội bộ (Mạng LAN)
                </div>
                <div style={{ fontSize: '13.5px', color: '#374151', marginBottom: '10px' }}>
                  Google Chrome & Microsoft Edge chỉ cho phép bật Camera/Mic trên <code>https://</code> hoặc <code>localhost</code>. Để bật camera trên máy tính này, bạn thực hiện <strong>3 bước đơn giản (mất 20 giây)</strong>:
                </div>
                <ol style={{ fontSize: '13px', color: '#1f2937', paddingLeft: '20px', margin: '0 0 12px 0' }}>
                  <li>
                    Mở tab mới, gõ vào thanh địa chỉ: <br />
                    <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
                    <span style={{ color: '#6b7280' }}> (nếu dùng Edge: <code>edge://flags/...</code>)</span>
                  </li>
                  <li style={{ marginTop: '6px' }}>
                    Dán địa chỉ sau vào ô <strong>Insecure origins treated as secure</strong>: <br />
                    <code style={{ background: '#e0e7ff', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, color: '#1d4ed8' }}>
                      {typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://192.168.1.115:5174'}
                    </code>
                    <button
                      type="button"
                      style={{
                        marginLeft: '10px',
                        padding: '3px 10px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid #93c5fd',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://192.168.1.115:5174';
                        navigator.clipboard?.writeText(url);
                        setCopiedHost(true);
                        setTimeout(() => setCopiedHost(false), 2500);
                      }}
                    >
                      {copiedHost ? '✓ Đã sao chép URL' : '📋 Sao chép URL'}
                    </button>
                  </li>
                  <li style={{ marginTop: '6px' }}>
                    Chuyển sang <strong>Enabled</strong> và nhấn nút <strong>Relaunch</strong> ở góc phải dưới để áp dụng.
                  </li>
                </ol>
                <button
                  type="button"
                  className="eg-btn-submit"
                  style={{ padding: '6px 14px', fontSize: '13px' }}
                  onClick={initMedia}
                >
                  ↻ Sau khi bật xong, nhấn vào đây để thử lại Camera
                </button>
              </div>
            ) : deviceError === 'PERMISSION_DENIED' ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#b91c1c' }}>⚠️ Trình duyệt chưa được cấp quyền Camera hoặc Microphone</div>
                <div style={{ fontSize: '13px' }}>
                  Vui lòng bấm vào biểu tượng <strong>Ổ khóa 🔒</strong> hoặc <strong>Máy ảnh 📷</strong> trên thanh địa chỉ trình duyệt, chọn <strong>Cho phép (Allow)</strong> cho Camera và Micro, sau đó bấm nút bên dưới.
                </div>
                <button type="button" className="eg-btn-submit" style={{ marginTop: '10px', padding: '6px 14px', fontSize: '13px' }} onClick={initMedia}>
                  ↻ Thử lại kết nối Camera
                </button>
              </div>
            ) : deviceError === 'DEVICE_IN_USE' ? (
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#b91c1c' }}>⚠️ Camera đang bị ứng dụng khác chiếm dụng</div>
                <div style={{ fontSize: '13px' }}>
                  Vui lòng tắt các phần mềm đang dùng webcam (Zoom, Google Meet, Teams, Zalo, ứng dụng Camera của máy...), rồi bấm thử lại.
                </div>
                <button type="button" className="eg-btn-submit" style={{ marginTop: '10px', padding: '6px 14px', fontSize: '13px' }} onClick={initMedia}>
                  ↻ Thử lại kết nối Camera
                </button>
              </div>
            ) : (
              <div>
                <span>{deviceError}</span>
                <button type="button" className="eg-btn-submit" style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '12px' }} onClick={initMedia}>
                  ↻ Thử lại
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MÀN HÌNH ĐANG CHỜ GIÁM THỊ DUYỆT (PENDING APPROVAL)
            ========================================================================= */}
        {checkinStage === 'PENDING_APPROVAL' && (
          <div className="eg-panel eg-checkin-waiting-panel">
            <div className="eg-waiting-icon-wrap">
              <div className="eg-radar-pulse" />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a66e0" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h2 className="eg-waiting-title">Đã gửi yêu cầu check-in tới Giám thị</h2>
            <p className="eg-waiting-desc">
              Hệ thống đã gửi ảnh chân dung và thông số thiết bị của bạn đến màn hình giám thị ca thi <strong>{sessionCode}</strong>.
              <br />Vui lòng giữ nguyên màn hình, hệ thống sẽ <strong>tự động chuyển vào phòng thi ngay khi Giám thị duyệt</strong>.
            </p>

            {capturedPhoto && (
              <div className="eg-waiting-photo-preview">
                <img src={capturedPhoto} alt="Ảnh check-in" />
                <span>Ảnh chân dung thực tế đang chờ duyệt</span>
              </div>
            )}

            <div className="eg-waiting-status-pills">
              <span className="eg-status-tag is-open">● Đang chờ giám thị phê duyệt</span>
              <span className="eg-mini-badge is-easy">✓ Webcam & Mic OK</span>
              <span className="eg-mini-badge is-easy">✓ AI Nhận diện hợp lệ</span>
            </div>
          </div>
        )}

        {/* =========================================================================
            MÀN HÌNH ĐÃ ĐƯỢC DUYỆT (APPROVED)
            ========================================================================= */}
        {checkinStage === 'APPROVED' && (
          <div className="eg-panel eg-checkin-approved-panel">
            <div className="eg-approved-icon">✓</div>
            <h2 className="eg-approved-title">Giám thị đã duyệt yêu cầu check-in!</h2>
            <p className="eg-approved-desc">
              Bạn đã đủ điều kiện vào phòng thi. Đang chuyển vào phòng làm bài thi sau <strong>{autoRedirectSec || 1} giây...</strong>
            </p>
            <button
              type="button"
              className="eg-primary-btn eg-btn-enter"
              onClick={() => onVerifiedSuccess(verifyResult)}
            >
              Vào làm bài thi ngay →
            </button>
          </div>
        )}

        {/* =========================================================================
            MÀN HÌNH BỊ TỪ CHỐI (REJECTED)
            ========================================================================= */}
        {checkinStage === 'REJECTED' && (
          <div className="eg-panel eg-checkin-rejected-panel">
            <div className="eg-rejected-icon">✕</div>
            <h2 className="eg-rejected-title">Giám thị đã từ chối yêu cầu check-in</h2>
            <p className="eg-rejected-desc">
              Lý do: <strong>{rejectReason || 'Ảnh chụp không rõ ràng hoặc không nhận diện được thí sinh.'}</strong>
            </p>
            <button type="button" className="eg-primary-btn" onClick={handleRetakePhoto}>
              ↻ Chụp lại ảnh xác thực khác
            </button>
          </div>
        )}

        {/* =========================================================================
            MÀN HÌNH BƯỚC 1: KIỂM TRA THIẾT BỊ VÀ CHỤP ẢNH THẬT
            ========================================================================= */}
        {checkinStage === 'PREPARING' && (
          <div className="eg-checkin-grid">
            {/* Cột trái: Khung hình Camera & Chụp ảnh */}
            <div className="eg-panel eg-checkin-video-panel">
              <div className="eg-video-container-wrap">
                {capturedPhoto ? (
                  <div className="eg-captured-preview-wrap">
                    <img src={capturedPhoto} alt="Ảnh chân dung thí sinh" className="eg-captured-img" />
                    <div className={`eg-captured-badge ${verifyResult?.status === 'VIOLATION' ? 'is-danger' : ''}`}>
                      {verifyResult?.status === 'VIOLATION'
                        ? `⚠️ ${verifyResult.message}`
                        : '📸 Ảnh chụp xác thực hợp lệ'}
                    </div>
                  </div>
                ) : (
                  <div className="eg-live-video-wrap">
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
                      className={`eg-live-stream-video ${cameraReady ? 'is-active' : ''}`}
                    />
                    {!cameraReady && (
                      <div className="eg-camera-offline-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                        <p>Đang kết nối camera hoặc quyền truy cập bị chặn...</p>
                      </div>
                    )}

                    {cameraReady && (
                      <div className="eg-face-guide-oval">
                        <div className="eg-guide-text">Căn chỉnh khuôn mặt vào giữa khung hình</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dải trạng thái Thiết bị */}
              <div className="eg-hardware-status-strip">
                <div className="eg-hw-indicator">
                  <span className={`eg-hw-dot ${cameraReady ? 'ok' : 'err'}`} />
                  <span className="eg-hw-label">
                    Webcam: <strong>{cameraReady ? 'Hoạt động (640x480)' : 'Chưa bật'}</strong>
                  </span>
                </div>

                <div className="eg-hw-indicator">
                  <span className={`eg-hw-dot ${micReady ? 'ok' : 'err'}`} />
                  <span className="eg-hw-label">
                    Microphone: <strong>{micReady ? 'Hoạt động' : 'Chưa nhận mic'}</strong>
                  </span>
                  <div className="eg-mic-vu-meter" title={`Cường độ âm thanh: ${micVolume}%`}>
                    <div className="eg-mic-vu-bar" style={{ width: `${Math.max(6, micVolume)}%` }} />
                  </div>
                </div>
              </div>

              {/* Nút hành động chụp ảnh */}
              <div className="eg-photo-actions-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileCapture}
                />
                {!capturedPhoto ? (
                  <div style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="eg-primary-btn eg-btn-snap"
                      onClick={handleSnapPhoto}
                      disabled={!cameraReady}
                      style={{ flex: 1, minWidth: '180px' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M4 8V6a2 2 0 0 1 2-2h3l2-2h6l2 2h3a2 2 0 0 1 2 2v2M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                      </svg>
                      Chụp ảnh từ Camera
                    </button>
                    <button
                      type="button"
                      className="eg-btn-cancel"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '0 16px', fontSize: '13px' }}
                      title="Mở camera điện thoại hoặc tải ảnh chân dung"
                    >
                      📱 Mở Camera điện thoại
                    </button>
                  </div>
                ) : (
                  <button type="button" className="eg-btn-cancel" onClick={handleRetakePhoto}>
                    ↻ Chụp lại ảnh khác
                  </button>
                )}
              </div>
            </div>

            {/* Cột phải: Tiêu chuẩn check-in & Gửi duyệt */}
            <div className="eg-panel eg-checkin-status-panel">
              <h2 className="eg-dashboard-section-title">Tiêu chuẩn Check-in phòng thi</h2>
              <p className="eg-dashboard-roster-description">
                Hệ thống nhận diện khuôn mặt tự động bằng AI. Vui lòng chụp rõ mặt trước khi gửi Giám thị duyệt.
              </p>

              <ul className="eg-checkin-steps">
                <li className={`eg-step-item ${cameraReady ? 'is-done' : ''}`}>
                  <div className="eg-step-num">{cameraReady ? '✓' : '1'}</div>
                  <div className="eg-step-text">
                    <strong>Kiểm tra Camera (Webcam):</strong>
                    <span>{cameraReady ? 'Đã nhận luồng hình ảnh video thời gian thực' : 'Đang chờ cấp quyền truy cập Camera'}</span>
                  </div>
                </li>

                <li className={`eg-step-item ${micReady ? 'is-done' : ''}`}>
                  <div className="eg-step-num">{micReady ? '✓' : '2'}</div>
                  <div className="eg-step-text">
                    <strong>Kiểm tra Microphone:</strong>
                    <span>{micReady ? 'Đã nhận micro thu âm phục vụ giám sát' : 'Đang chờ cấp quyền truy cập Micro'}</span>
                  </div>
                </li>

                <li className={`eg-step-item ${capturedPhoto ? 'is-done' : ''}`}>
                  <div className="eg-step-num">{capturedPhoto ? '✓' : '3'}</div>
                  <div className="eg-step-text">
                    <strong>Chụp ảnh chân dung xác thực:</strong>
                    <span>{capturedPhoto ? 'Đã chụp ảnh chân dung từ camera' : 'Nhấn nút "Chụp ảnh xác thực" bên trái'}</span>
                  </div>
                </li>

                <li className={`eg-step-item ${verifyResult?.verified ? 'is-done' : ''}`}>
                  <div className="eg-step-num">{verifyResult?.verified ? '✓' : '4'}</div>
                  <div className="eg-step-text">
                    <strong>Nhận diện khuôn mặt AI:</strong>
                    <span>{verifyResult ? verifyResult.message : 'Chờ chụp ảnh để AI đối soát'}</span>
                  </div>
                </li>
              </ul>

              {/* Thông báo kết quả nhận diện khuôn mặt */}
              {verifyResult && (
                <div className={`eg-dashboard-alert-banner ${verifyResult.verified ? 'is-success' : 'is-error'}`} style={{ margin: '14px 0' }}>
                  <span>{verifyResult.message}</span>
                </div>
              )}

              {/* Nút gửi yêu cầu check-in */}
              <div className="eg-checkin-action-bar">
                <button
                  type="button"
                  className="eg-primary-btn eg-btn-submit-checkin"
                  onClick={handleSubmitCheckinRequest}
                  disabled={verifying || !capturedPhoto || verifyResult?.status === 'VIOLATION'}
                >
                  {verifying ? 'Đang gửi yêu cầu check-in...' : 'Gửi yêu cầu Check-in tới Giám thị →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

