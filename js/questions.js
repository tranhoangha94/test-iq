/*
 * Ngân hàng câu hỏi.
 *  b  = độ khó (tham số IRT, thang logit; 0 = người trung bình có ~60% cơ hội đúng)
 *  a  = độ phân biệt (IRT)
 *  domain: number | verbal | logic | spatial
 * Với câu ma trận, gen(r, c) mô tả ô ở hàng r, cột c; đáp án đúng là gen(2, 2).
 */
(function () {
  'use strict';

  const ARROW = 'arrow';

  // Tăng phiên bản khi sửa nội dung hoặc đáp án câu hỏi, để dữ liệu cũ không bị trộn khi chuẩn hoá
  window.QUESTION_BANK_VERSION = 'v1';

  window.QUESTIONS = [
    // ───────── Suy luận số ─────────
    { id: 'n1', domain: 'number', b: -2.5, a: 1.5, prompt: 'Số tiếp theo của dãy là?', seq: [2, 4, 6, 8], options: [10, 9, 12, 11, 14], answer: 10 },
    { id: 'n2', domain: 'number', b: -1.5, a: 1.5, prompt: 'Số tiếp theo của dãy là?', seq: [3, 6, 12, 24], options: [48, 36, 42, 30, 50], answer: 48 },
    { id: 'n3', domain: 'number', b: -0.8, a: 1.5, prompt: 'Số tiếp theo của dãy là?', seq: [1, 4, 9, 16, 25], options: [36, 30, 35, 49, 32], answer: 36 },
    { id: 'n4', domain: 'number', b: -0.3, a: 1.5, prompt: 'Số tiếp theo của dãy là?', seq: [2, 3, 5, 8, 12, 17], options: [23, 21, 22, 24, 25], answer: 23 },
    { id: 'n5', domain: 'number', b: 0.3, a: 1.5, prompt: 'Số tiếp theo của dãy là?', seq: [4, 9, 7, 12, 10, 15], options: [13, 12, 17, 18, 20], answer: 13 },
    { id: 'n6', domain: 'number', b: 0.8, a: 1.6, prompt: 'Số tiếp theo của dãy là?', seq: [3, 5, 9, 17, 33], options: [65, 49, 57, 64, 66], answer: 65 },
    { id: 'n7', domain: 'number', b: 1.1, a: 1.6, prompt: 'Số tiếp theo của dãy là?', seq: [3, 4, 7, 11, 18, 29], options: [47, 40, 45, 48, 58], answer: 47 },
    { id: 'n8', domain: 'number', b: 1.6, a: 1.7, prompt: 'Số tiếp theo của dãy là?', seq: [8, 12, 10, 15, 12, 18], options: [14, 13, 15, 21, 16], answer: 14 },
    { id: 'n9', domain: 'number', b: 2.6, a: 1.8, prompt: 'Số tiếp theo của dãy là?', seq: [2, 12, 36, 80, 150], options: [252, 220, 236, 246, 264], answer: 252 },

    // ───────── Ngôn ngữ ─────────
    { id: 'v1', domain: 'verbal', b: -2.3, a: 1.4, prompt: '“Chó” đi với “sủa” như “mèo” đi với…', options: ['Kêu meo meo', 'Gáy', 'Hí', 'Rống'], answer: 'Kêu meo meo' },
    { id: 'v2', domain: 'verbal', b: -1.4, a: 1.4, prompt: 'Từ nào KHÁC LOẠI với các từ còn lại?', options: ['Cà rốt', 'Táo', 'Chuối', 'Xoài', 'Cam'], answer: 'Cà rốt' },
    { id: 'v3', domain: 'verbal', b: -0.9, a: 1.4, prompt: '“Bác sĩ” : “bệnh viện” = “giáo viên” : ?', options: ['Trường học', 'Học sinh', 'Sách vở', 'Bảng đen', 'Bài giảng'], answer: 'Trường học' },
    { id: 'v4', domain: 'verbal', b: -0.4, a: 1.4, prompt: 'Từ nào TRÁI NGHĨA với “khiêm tốn”?', options: ['Kiêu ngạo', 'Nhút nhát', 'Giản dị', 'Lễ phép', 'Tự tin'], answer: 'Kiêu ngạo' },
    { id: 'v5', domain: 'verbal', b: 0.0, a: 1.4, prompt: '“Chương” : “sách” = “khổ thơ” : ?', options: ['Bài thơ', 'Câu thơ', 'Nhà thơ', 'Vần', 'Trang'], answer: 'Bài thơ' },
    { id: 'v6', domain: 'verbal', b: 0.5, a: 1.5, prompt: 'Từ nào KHÁC NGHĨA với các từ còn lại?', options: ['Tin tưởng', 'Hồ nghi', 'Ngờ vực', 'Hoài nghi', 'Nghi ngại'], answer: 'Tin tưởng' },
    { id: 'v7', domain: 'verbal', b: 1.0, a: 1.5, prompt: 'Mẹ của bố tôi là gì đối với con trai tôi?', options: ['Cụ nội (bà cố)', 'Bà nội', 'Bà ngoại', 'Bác gái', 'Cô'], answer: 'Cụ nội (bà cố)' },
    { id: 'v8', domain: 'verbal', b: 1.8, a: 1.7, prompt: 'Một người đàn ông chỉ vào bức ảnh và nói: “Tôi không có anh chị em ruột. Bố của người trong ảnh là con trai của bố tôi.” Người trong ảnh là ai?', options: ['Con trai của ông ấy', 'Chính ông ấy', 'Bố của ông ấy', 'Cháu trai của ông ấy', 'Anh trai của ông ấy'], answer: 'Con trai của ông ấy' },

    // ───────── Logic ─────────
    { id: 'l1', domain: 'logic', b: -2.0, a: 1.4, prompt: 'An cao hơn Bình. Bình cao hơn Cường. Ai thấp nhất?', options: ['Cường', 'An', 'Bình', 'Không xác định được'], answer: 'Cường' },
    { id: 'l2', domain: 'logic', b: -1.1, a: 1.4, prompt: 'Nếu hôm qua là thứ Hai thì ngày kia là thứ mấy?', options: ['Thứ Năm', 'Thứ Tư', 'Thứ Sáu', 'Thứ Ba'], answer: 'Thứ Năm' },
    { id: 'l3', domain: 'logic', b: 0.6, a: 1.5, prompt: '5 máy làm được 5 sản phẩm trong 5 phút. Hỏi 100 máy làm 100 sản phẩm mất bao lâu?', options: ['5 phút', '100 phút', '20 phút', '1 phút', '50 phút'], answer: '5 phút' },
    { id: 'l4', domain: 'logic', b: 0.7, a: 1.5, prompt: 'Trong ngăn kéo có 10 chiếc tất đen và 10 chiếc tất trắng để lẫn lộn. Không nhìn, phải lấy ra ít nhất bao nhiêu chiếc để chắc chắn có 2 chiếc cùng màu?', options: ['3', '2', '11', '10', '21'], answer: '3' },
    { id: 'l5', domain: 'logic', b: 0.8, a: 1.5, prompt: 'Tất cả hoa hồng đều là hoa. Một số loài hoa tàn rất nhanh. Kết luận nào chắc chắn đúng?', options: ['Không thể kết luận hoa hồng có tàn nhanh hay không', 'Một số hoa hồng tàn rất nhanh', 'Tất cả hoa hồng đều tàn rất nhanh', 'Không có hoa hồng nào tàn nhanh'], answer: 'Không thể kết luận hoa hồng có tàn nhanh hay không' },
    { id: 'l6', domain: 'logic', b: 0.9, a: 1.6, prompt: 'Một cây bút và một cuốn vở có tổng giá 11.000đ. Cuốn vở đắt hơn cây bút đúng 10.000đ. Cây bút giá bao nhiêu?', options: ['500đ', '1.000đ', '1.500đ', '5.000đ', '10.000đ'], answer: '500đ' },
    { id: 'l7', domain: 'logic', b: 1.4, a: 1.6, prompt: 'Một số có hai chữ số, tổng hai chữ số bằng 9. Nếu đảo ngược thứ tự hai chữ số, số mới lớn hơn số cũ 27 đơn vị. Số đó là?', options: ['36', '27', '45', '63', '18'], answer: '36' },
    { id: 'l8', domain: 'logic', b: 2.1, a: 1.7, prompt: 'Trên đảo có người trung thực (luôn nói thật) và kẻ nói dối (luôn nói dối). A nói: “Ít nhất một trong hai chúng tôi là kẻ nói dối.” A và B là ai?', options: ['A trung thực, B nói dối', 'A nói dối, B trung thực', 'Cả hai đều trung thực', 'Cả hai đều nói dối', 'Không xác định được'], answer: 'A trung thực, B nói dối' },
    { id: 'l9', domain: 'logic', b: 2.5, a: 1.8, prompt: 'Ba hộp được dán nhãn “Táo”, “Cam” và “Táo và Cam”, nhưng TẤT CẢ nhãn đều sai. Bạn chỉ được lấy 1 quả từ 1 hộp (không nhìn vào trong). Lấy từ hộp nào để xác định đúng nội dung cả ba hộp?', options: ['Hộp dán nhãn “Táo và Cam”', 'Hộp dán nhãn “Táo”', 'Hộp dán nhãn “Cam”', 'Không thể xác định chỉ với 1 lần lấy'], answer: 'Hộp dán nhãn “Táo và Cam”' },

    // ───────── Ma trận hình (kiểu Raven) ─────────
    {
      id: 'm1', domain: 'spatial', type: 'matrix', b: -2.0, a: 1.5,
      gen: (r, c) => ({ shape: ['circle', 'square', 'triangle'][r], n: c + 1, fill: 'solid' }),
      distractors: [
        { shape: 'triangle', n: 2, fill: 'solid' }, { shape: 'circle', n: 3, fill: 'solid' },
        { shape: 'square', n: 3, fill: 'solid' }, { shape: 'triangle', n: 4, fill: 'solid' },
        { shape: 'triangle', n: 3, fill: 'none' },
      ],
    },
    {
      id: 'm2', domain: 'spatial', type: 'matrix', b: -1.2, a: 1.5,
      gen: (r, c) => ({ shape: ['circle', 'square', 'diamond'][c], fill: ['none', 'gray', 'solid'][r] }),
      distractors: [
        { shape: 'diamond', fill: 'none' }, { shape: 'diamond', fill: 'gray' },
        { shape: 'square', fill: 'solid' }, { shape: 'circle', fill: 'solid' },
        { shape: 'triangle', fill: 'solid' },
      ],
    },
    {
      id: 'm3', domain: 'spatial', type: 'matrix', b: -0.3, a: 1.6,
      gen: (r, c) => ({ shape: ARROW, rot: 90 * r + 45 * c, fill: 'solid' }),
      distractors: [225, 315, 180, 0, 90].map(rot => ({ shape: ARROW, rot, fill: 'solid' })),
    },
    {
      id: 'm4', domain: 'spatial', type: 'matrix', b: 0.4, a: 1.6,
      gen: (r, c) => ({ shape: ['circle', 'triangle', 'square'][(r + c) % 3], n: (r + 2 * c) % 3 + 1, fill: 'solid' }),
      distractors: [
        { shape: 'triangle', n: 2, fill: 'solid' }, { shape: 'triangle', n: 3, fill: 'solid' },
        { shape: 'circle', n: 1, fill: 'solid' }, { shape: 'square', n: 1, fill: 'solid' },
        { shape: 'square', n: 2, fill: 'solid' },
      ],
    },
    {
      id: 'm5', domain: 'spatial', type: 'matrix', b: 0.6, a: 1.6,
      // Cột 3 = cột 1 + cột 2 (số lượng hình)
      gen: (r, c) => ({ shape: ['circle', 'square', 'star'][r], n: [[1, 2, 3], [2, 2, 4], [2, 3, 5]][r][c], fill: 'solid' }),
      distractors: [
        { shape: 'star', n: 4, fill: 'solid' }, { shape: 'star', n: 6, fill: 'solid' },
        { shape: 'circle', n: 5, fill: 'solid' }, { shape: 'star', n: 3, fill: 'solid' },
        { shape: 'square', n: 5, fill: 'solid' },
      ],
    },
    {
      id: 'm6', domain: 'spatial', type: 'matrix', b: 1.0, a: 1.6,
      gen: (r, c) => ({
        shape: ['circle', 'square', 'diamond'][(r + c) % 3], fill: 'none',
        inner: { shape: ['circle', 'square', 'triangle'][(2 * r + c) % 3], fill: 'solid' },
      }),
      distractors: [
        { shape: 'square', fill: 'none', inner: { shape: 'square', fill: 'solid' } },
        { shape: 'square', fill: 'none', inner: { shape: 'triangle', fill: 'solid' } },
        { shape: 'circle', fill: 'none', inner: { shape: 'circle', fill: 'solid' } },
        { shape: 'diamond', fill: 'none', inner: { shape: 'circle', fill: 'solid' } },
        { shape: 'square', fill: 'none' },
      ],
    },
    {
      id: 'm7', domain: 'spatial', type: 'matrix', b: 1.7, a: 1.7,
      prompt: 'Gợi ý: hãy so sánh ô thứ ba của mỗi hàng với hai ô đầu.',
      gen: (r, c) => ({ lines: [
        [['top', 'left'], ['left', 'd1'], ['top', 'd1']],
        [['h', 'right'], ['v', 'right'], ['h', 'v']],
        [['bottom', 'd2', 'left'], ['d2', 'top'], ['bottom', 'left', 'top']],
      ][r][c] }),
      distractors: [
        { lines: ['bottom', 'd2', 'left', 'top'] }, { lines: ['d2'] },
        { lines: ['bottom', 'left'] }, { lines: ['top', 'bottom', 'left', 'right'] },
        { lines: ['top', 'left', 'd2'] },
      ],
    },
    {
      id: 'm8', domain: 'spatial', type: 'matrix', b: 2.2, a: 1.7,
      gen: (r, c) => ({ shape: ['circle', 'triangle', 'square'][(r + c) % 3], fill: ['none', 'gray', 'solid'][(2 * r + c) % 3], n: c + 1 }),
      distractors: [
        { shape: 'triangle', fill: 'none', n: 2 }, { shape: 'triangle', fill: 'solid', n: 3 },
        { shape: 'square', fill: 'none', n: 3 }, { shape: 'circle', fill: 'none', n: 3 },
        { shape: 'triangle', fill: 'gray', n: 3 },
      ],
    },
    {
      id: 'm9', domain: 'spatial', type: 'matrix', b: 2.9, a: 1.8,
      gen: (r, c) => { const i = 3 * r + c; return { shape: ARROW, rot: (45 * i) % 360, fill: i % 2 ? 'solid' : 'none' }; },
      distractors: [
        { shape: ARROW, rot: 315, fill: 'none' }, { shape: ARROW, rot: 0, fill: 'solid' },
        { shape: ARROW, rot: 45, fill: 'none' }, { shape: ARROW, rot: 270, fill: 'none' },
        { shape: ARROW, rot: 180, fill: 'solid' },
      ],
    },
  ];
})();
