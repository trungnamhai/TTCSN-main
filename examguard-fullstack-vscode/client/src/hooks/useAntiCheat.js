import { useEffect } from 'react';

/**
 * Hook giám sát hành vi gian lận trên trình duyệt trong lúc làm bài:
 * - Phát hiện chuyển tab / thu nhỏ cửa sổ (visibilitychange, blur)
 * - Chặn Copy, Cut, Paste, Chuột phải và phím tắt DevTools (F12, Ctrl+Shift+I)
 */
export function useAntiCheat({ enabled, onViolation }) {
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        onViolation('TAB_SWITCH', 'Cảnh báo: Phát hiện thí sinh rời khỏi tab làm bài thi!');
      }
    };

    const handleWindowBlur = () => {
      onViolation('WINDOW_BLUR', 'Cảnh báo: Cửa sổ phòng thi bị mất tiêu điểm (Alt+Tab / chuyển ứng dụng)!');
    };

    const handleCopyPaste = (e) => {
      e.preventDefault();
      onViolation('COPY_PASTE_BLOCKED', 'Cảnh báo: Hành vi sao chép / dán nội dung bị khóa trong phòng thi!');
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        onViolation('DEVTOOLS_SHORTCUT', 'Cảnh báo: Không được phép mở công cụ nhà phát triển (DevTools)!');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onViolation]);
}
