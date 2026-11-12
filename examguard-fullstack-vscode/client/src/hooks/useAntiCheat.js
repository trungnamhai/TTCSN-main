import { useEffect, useRef } from 'react';

/**
 * Hook giám sát hành vi gian lận trên trình duyệt trong lúc làm bài:
 * - Phát hiện chuyển tab / thu nhỏ cửa sổ (visibilitychange, blur)
 * - Chặn và phát hiện Copy, Cut, Paste, Chuột phải và phím tắt DevTools
 */
export function useAntiCheat({ enabled, onViolation }) {
  const lastAlertTimeRef = useRef({});

  useEffect(() => {
    if (!enabled) return;

    const triggerViolationWithThrottle = (type, message, cooldownMs = 2500) => {
      const now = Date.now();
      const last = lastAlertTimeRef.current[type] || 0;
      if (now - last > cooldownMs) {
        lastAlertTimeRef.current[type] = now;
        onViolation(type, message);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolationWithThrottle('TAB_SWITCH', 'Cảnh báo vi phạm: Phát hiện thí sinh rời khỏi tab làm bài thi!');
      }
    };

    const handleWindowBlur = () => {
      triggerViolationWithThrottle('WINDOW_BLUR', 'Cảnh báo vi phạm: Cửa sổ phòng thi bị mất tiêu điểm (Alt+Tab / chuyển ứng dụng)!');
    };

    const handleCopy = (e) => {
      e.preventDefault();
      triggerViolationWithThrottle('CLIPBOARD_COPY', 'Cảnh báo vi phạm: Nghiêm cấm sao chép nội dung câu hỏi trong phòng thi!');
    };

    const handlePaste = (e) => {
      e.preventDefault();
      triggerViolationWithThrottle('CLIPBOARD_PASTE', 'Cảnh báo vi phạm: Nghiêm cấm dán nội dung từ bên ngoài vào bài thi!');
    };

    const handleCut = (e) => {
      e.preventDefault();
      triggerViolationWithThrottle('CLIPBOARD_COPY', 'Cảnh báo vi phạm: Nghiêm cấm cắt nội dung đề thi!');
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerViolationWithThrottle('CLIPBOARD_COPY', 'Cảnh báo: Chuột phải bị vô hiệu hóa để bảo mật đề thi!');
    };

    const handleKeyDown = (e) => {
      const key = e.key ? e.key.toUpperCase() : '';
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(key))
      ) {
        e.preventDefault();
        triggerViolationWithThrottle('DEVTOOLS_SHORTCUT', 'Cảnh báo vi phạm: Không được phép mở công cụ nhà phát triển (DevTools)!');
      } else if (e.ctrlKey && (key === 'C' || key === 'X')) {
        e.preventDefault();
        triggerViolationWithThrottle('CLIPBOARD_COPY', `Cảnh báo vi phạm: Phím tắt Ctrl+${key} (Sao chép) bị nghiêm cấm trong phòng thi!`);
      } else if (e.ctrlKey && key === 'V') {
        e.preventDefault();
        triggerViolationWithThrottle('CLIPBOARD_PASTE', 'Cảnh báo vi phạm: Phím tắt Ctrl+V (Dán) bị nghiêm cấm trong phòng thi!');
      } else if (e.ctrlKey && (key === 'U' || key === 'S' || key === 'P')) {
        e.preventDefault();
        triggerViolationWithThrottle('DEVTOOLS_SHORTCUT', `Cảnh báo vi phạm: Phím tắt Ctrl+${key} bị vô hiệu hóa trong phòng thi!`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onViolation]);
}
