const getBackendBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Dùng relative path '/api' để mọi truy cập (localhost, LAN IP, hoặc ngrok tunnel)
  // đều đi qua Vite dev server proxy -> chuyển tiếp an toàn tới backend http://localhost:5000.
  // Điều này tránh hoàn toàn lỗi Mixed Content (HTTPS -> HTTP:5000) và việc ngrok không mở port 5000.
  return '/api';
};

const API_URL = getBackendBaseUrl();

export async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${API_URL}${normalizedEndpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(
      `API ${endpoint} trả về HTML thay vì JSON (${response.status}). Hãy kiểm tra xem backend Node.js ở cổng 5000 đã được bật chưa.`
    );
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Lỗi kết nối API Backend');
  }
  return data;
}
