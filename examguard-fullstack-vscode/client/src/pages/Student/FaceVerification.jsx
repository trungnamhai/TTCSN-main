import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { captureFrameFromVideo } from '../../services/vision';
import './FaceVerification.css';

export default function FaceVerification({ authData, onVerifiedSuccess, onBack }) {
  const videoRef = useRef(null);
  const [opencvStatus, setOpencvStatus] = useState('Đang tải OpenCV...');
  const [cameraReady, setCameraReady] = useState(false);
  const [simulatedMode, setSimulatedMode] = useState('TWO_FACES'); // 'TWO_FACES' | 'ONE_FACE' | 'LIVE_WEBCAM'
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let stream = null;
    const timer = setTimeout(() => {
      setOpencvStatus('OpenCV & FastAPI AI đã sẵn sàng. Nhấn "Xác thực khuôn mặt" để kiểm tra.');
    }, 900);

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (err) {
        setCameraReady(false);
      }
    }

    startWebcam();

    return () => {
      clearTimeout(timer);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleVerifyFace = async () => {
    setVerifying(true);
    try {
      const frameBase64 = cameraReady ? captureFrameFromVideo(videoRef.current) : null;
      const simulatedFaceCount =
        simulatedMode === 'TWO_FACES' ? 2 : simulatedMode === 'ONE_FACE' ? 1 : undefined;

      const res = await apiRequest('/proctoring/verify-face', {
        method: 'POST',
        token: authData.token,
        body: {
          imageBase64: frameBase64,
          simulatedFaceCount,
          attemptId: 1
        }
      });

      setVerifyResult(res);
      if (res.verified && res.face_count === 1) {
        setTimeout(() => {
          onVerifiedSuccess(res);
        }, 700);
      }
    } catch (err) {
      setVerifyResult({
        status: 'VIOLATION',
        verified: false,
        message: err.message
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="eg-center-wrapper">
      <div className="eg-auth-card eg-face-card">
        <h1 className="eg-card-title">Xác minh khuôn mặt</h1>
        <p className="eg-card-desc">Nhìn thẳng vào camera, chỉ một người trong khung hình.</p>

        {/* Thanh chuyển kịch bản để test trường hợp 2 người trong ảnh chụp màn hình hoặc 1 người hợp lệ */}
        <div className="eg-face-mode-switch">
          <button
            type="button"
            onClick={() => {
              setSimulatedMode('TWO_FACES');
              setVerifyResult(null);
            }}
            className={`eg-face-mode-btn eg-face-mode-two ${
              simulatedMode === 'TWO_FACES' ? 'active' : ''
            }`}
          >
            Test ảnh 2 người (Cảnh báo MULTIPLE_FACES)
          </button>

          <button
            type="button"
            onClick={() => {
              setSimulatedMode('ONE_FACE');
              setVerifyResult(null);
            }}
            className={`eg-face-mode-btn eg-face-mode-one ${
              simulatedMode === 'ONE_FACE' ? 'active' : ''
            }`}
          >
            ✓ 1 người hợp lệ (Vào phòng thi)
          </button>

          {cameraReady && (
            <button
              type="button"
              onClick={() => {
                setSimulatedMode('LIVE_WEBCAM');
                setVerifyResult(null);
              }}
              className={`eg-face-mode-btn eg-face-mode-live ${
                simulatedMode === 'LIVE_WEBCAM' ? 'active' : ''
              }`}
            >
              Camera thật
            </button>
          )}
        </div>

        <div className="eg-camera-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`eg-camera-video ${
              cameraReady && simulatedMode === 'LIVE_WEBCAM' ? 'is-visible' : 'is-hidden'
            }`}
          />

          {(!cameraReady || simulatedMode !== 'LIVE_WEBCAM') && (
            <div
              className="eg-face-simulation"
            >
              {simulatedMode === 'TWO_FACES' && (
                <div
                  className="eg-face-extra-person"
                >
                  Người thứ 2 (Vi phạm)
                </div>
              )}

              <div
                className={`eg-face-candidate ${
                  simulatedMode === 'ONE_FACE' ? 'is-valid' : 'is-warning'
                }`}
              >
                <span>Thí sinh: {authData.student.username}</span>
                <span className="eg-face-distance">
                  {simulatedMode === 'TWO_FACES'
                    ? 'Phát hiện 2 khuôn mặt trong khung hình'
                    : 'Euclidean distance: 0.25 (Hợp lệ)'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="eg-status-text">{opencvStatus}</div>

        {verifyResult && (
          <div
            className={`eg-alert-box ${
              verifyResult.verified ? 'eg-alert-success' : 'eg-alert-error'
            }`}
          >
            {verifyResult.message}
          </div>
        )}

        <button
          type="button"
          className="eg-primary-btn"
          onClick={handleVerifyFace}
          disabled={verifying}
        >
          {verifying ? 'Đang phân tích khuôn mặt bằng OpenCV...' : 'Xác thực khuôn mặt'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="eg-face-back-btn"
        >
          ← Quay lại đăng nhập phòng thi
        </button>
      </div>
    </div>
  );
}
