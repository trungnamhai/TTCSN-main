import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  // Kết nối Socket.io qua origin hiện tại (Vite proxy sẽ chuyển tiếp /socket.io tới backend :5000)
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  transports: ['websocket', 'polling']
});

export function connectSocket(token) {
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
}

export function disconnectSocket() {
  socket.disconnect();
  socket.auth = {};
}
