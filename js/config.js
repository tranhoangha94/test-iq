/*
 * Cấu hình thu thập kết quả ẩn danh.
 *  collectUrl: địa chỉ nhận kết quả (POST JSON). Để '' để tắt thu thập.
 *
 * Backend (server.py) chạy trên Railway. Frontend có thể host ở nơi khác (VD Vercel):
 *  - Đang mở trên chính backend hoặc trên máy (localhost) → gửi cùng domain
 *  - Đang mở trên domain khác → gửi sang Railway (server đã cho phép CORS qua ALLOWED_ORIGINS)
 */
(function () {
  const API_ORIGIN = 'https://web-production-cd535.up.railway.app';
  const sameOrigin = location.origin === API_ORIGIN || ['localhost', '127.0.0.1'].includes(location.hostname);
  window.IQ_CONFIG = {
    collectUrl: (sameOrigin ? '' : API_ORIGIN) + '/api/results',
  };
})();
