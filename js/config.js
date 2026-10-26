/*
 * Cấu hình thu thập kết quả ẩn danh.
 *  collectUrl: địa chỉ nhận kết quả (POST JSON). Để '' để tắt thu thập.
 *    - Chạy bằng server.py: giữ '/api/results'
 *    - Host tĩnh (Netlify, GitHub Pages…): trỏ tới endpoint riêng, VD Google Apps Script (xem README)
 */
window.IQ_CONFIG = {
  collectUrl: '/api/results',
};
