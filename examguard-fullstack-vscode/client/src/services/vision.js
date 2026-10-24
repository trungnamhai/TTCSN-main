/**
 * vision.js - Tiện ích chụp khung hình từ thẻ <video> sang Base64
 * để gửi về Backend / FastAPI OpenCV phân tích khuôn mặt.
 */
export function captureFrameFromVideo(videoElement) {
  if (!videoElement || videoElement.readyState < 2) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}
