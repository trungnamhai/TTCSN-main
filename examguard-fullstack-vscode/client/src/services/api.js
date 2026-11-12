const getBackendBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const API_URL = getBackendBaseUrl();

export async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(
      `API ${endpoint} trả về HTML thay vì JSON (${response.status}). Hãy khởi động lại backend ExamGuard ở cổng 5000.`
    );
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Lỗi kết nối API Backend');
  }
  return data;
}
