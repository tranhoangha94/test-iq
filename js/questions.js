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
  window.QUESTION_BANK_VERSION = 'v2';

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
    // Hiệu là các số chính phương 1, 4, 9, 16 → +25
    { id: 'n10', domain: 'number', b: 2.2, a: 1.8, prompt: 'Số tiếp theo của dãy là?', seq: [1, 2, 6, 15, 31], options: [56, 47, 52, 62, 63], answer: 56 },
    // ×2+1, ×2+2, ×2+3, ×2+4 → ×2+5
    { id: 'n11', domain: 'number', b: 2.6, a: 1.8, prompt: 'Số tiếp theo của dãy là?', seq: [3, 7, 16, 35, 74], options: [153, 148, 149, 150, 151], answer: 153 },
    // n² + 1 với n lẻ, n² − 1 với n chẵn
    { id: 'n12', domain: 'number', b: 3.2, a: 1.9, prompt: 'Số tiếp theo của dãy là?', seq: [2, 3, 10, 15, 26, 35], options: [50, 48, 49, 51, 46], answer: 50 },

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
    // Lúc 3:15 kim giờ ở 97,5°, kim phút ở 90°
    { id: 'l10', domain: 'logic', b: 2.5, a: 1.8, prompt: 'Đồng hồ chỉ 3 giờ 15 phút. Góc nhỏ hơn tạo bởi kim giờ và kim phút là bao nhiêu độ?', options: ['7,5°', '0°', '5°', '12,5°', '15°'], answer: '7,5°' },
    // Chi là giáo viên (nhỏ tuổi nhất) → Bình lớn tuổi hơn kỹ sư nên Bình là bác sĩ
    { id: 'l11', domain: 'logic', b: 2.4, a: 1.8, prompt: 'An, Bình, Chi làm ba nghề khác nhau: bác sĩ, kỹ sư, giáo viên. Biết: (1) Người giáo viên nhỏ tuổi nhất. (2) Bình lớn tuổi hơn người kỹ sư. (3) An không phải giáo viên và An nhỏ tuổi hơn Bình. Ai là bác sĩ?', options: ['Bình', 'An', 'Chi', 'Không xác định được'], answer: 'Bình' },
    // 3 lần cân chia 3 nhóm: 3² = 9 < 12 ≤ 27 = 3³
    { id: 'l12', domain: 'logic', b: 2.7, a: 1.8, prompt: 'Có 12 đồng xu trông giống hệt nhau, trong đó đúng 1 đồng giả nhẹ hơn. Dùng cân hai đĩa (không có quả cân), cần ít nhất bao nhiêu lần cân để CHẮC CHẮN tìm ra đồng giả?', options: ['3', '2', '4', '6', '11'], answer: '3' },
    // A thật → B dối → A, C khác loại → C dối. A dối → B thật → A, C cùng loại → C dối.
    { id: 'l13', domain: 'logic', b: 3.1, a: 1.9, prompt: 'Trên đảo có người trung thực (luôn nói thật) và kẻ nói dối (luôn nói dối). A nói: “B là kẻ nói dối.” B nói: “A và C cùng một loại người.” Có thể kết luận gì về C?', options: ['C là kẻ nói dối', 'C là người trung thực', 'Không xác định được', 'Không thể có tình huống này'], answer: 'C là kẻ nói dối' },
    { id: 'l9', domain: 'logic', b: 2.5, a: 1.8, prompt: 'Có ba hộp: một hộp chỉ đựng táo, một hộp chỉ đựng cam, một hộp đựng cả táo và cam. Các hộp được dán nhãn “Táo”, “Cam”, “Táo và Cam”, nhưng TẤT CẢ nhãn đều dán sai. Bạn chỉ được lấy ra 1 quả từ 1 hộp (không nhìn vào trong). Lấy từ hộp nào để xác định đúng nội dung cả ba hộp?', options: ['Hộp dán nhãn “Táo và Cam”', 'Hộp dán nhãn “Táo”', 'Hộp dán nhãn “Cam”', 'Không thể xác định chỉ với 1 lần lấy'], answer: 'Hộp dán nhãn “Táo và Cam”' },

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
    {
      // Cột 3 = các nét có ở CẢ cột 1 và cột 2 (giao)
      id: 'm10', domain: 'spatial', type: 'matrix', b: 2.4, a: 1.8,
      gen: (r, c) => ({ lines: [
        [['top', 'left', 'd1', 'h'], ['top', 'd1', 'v', 'right'], ['top', 'd1']],
        [['h', 'v', 'bottom', 'd2'], ['h', 'd2', 'left', 'top'], ['h', 'd2']],
        [['left', 'right', 'top', 'd1', 'd2'], ['right', 'd1', 'bottom', 'v', 'left'], ['left', 'right', 'd1']],
      ][r][c] }),
      distractors: [
        { lines: ['left', 'right', 'top', 'd1', 'd2', 'bottom', 'v'] }, { lines: ['top', 'd2', 'bottom', 'v'] },
        { lines: ['left', 'right'] }, { lines: ['left', 'd1'] }, { lines: ['right', 'd1', 'top'] },
      ],
    },
    {
      // Mỗi hàng xoay đều một góc: hàng 1 +45°, hàng 2 +90°, hàng 3 +135°
      id: 'm11', domain: 'spatial', type: 'matrix', b: 2.8, a: 1.8,
      gen: (r, c) => ({ shape: ARROW, rot: (45 * (r + 1) * c) % 360, fill: 'solid' }),
      distractors: [180, 225, 315, 135, 90].map(rot => ({ shape: ARROW, rot, fill: 'solid' })),
    },
    {
      // Hình và tô màu theo hình vuông Latin; số lượng: cột 3 = cột 1 + cột 2
      id: 'm12', domain: 'spatial', type: 'matrix', b: 3.3, a: 1.9,
      gen: (r, c) => ({
        shape: ['diamond', 'circle', 'triangle'][(r + c) % 3],
        fill: ['solid', 'none', 'gray'][(r + 2 * c) % 3],
        n: [[1, 1, 2], [2, 1, 3], [1, 3, 4]][r][c],
      }),
      distractors: [
        { shape: 'circle', fill: 'solid', n: 3 }, { shape: 'circle', fill: 'none', n: 4 },
        { shape: 'triangle', fill: 'solid', n: 4 }, { shape: 'circle', fill: 'gray', n: 4 },
        { shape: 'diamond', fill: 'solid', n: 4 },
      ],
    },
  ];

  // Lời giải hiển thị ở phần "Xem đáp án" sau khi nộp bài
  const EXPLAIN = {
    n1: 'Mỗi số cộng thêm 2: 8 + 2 = 10.',
    n2: 'Mỗi số nhân 2: 24 × 2 = 48.',
    n3: 'Các số chính phương 1², 2², …, 5² → 6² = 36.',
    n4: 'Hiệu tăng dần 1, 2, 3, 4, 5 → 17 + 6 = 23.',
    n5: 'Xen kẽ +5 và −2: 15 − 2 = 13.',
    n6: 'Nhân 2 rồi trừ 1: 33 × 2 − 1 = 65.',
    n7: 'Mỗi số bằng tổng hai số liền trước: 18 + 29 = 47.',
    n8: 'Hai dãy xen kẽ: vị trí lẻ 8, 10, 12 (+2), vị trí chẵn 12, 15, 18 (+3). Số thứ 7 thuộc dãy lẻ → 14.',
    n9: 'Số thứ n bằng n² × (n + 1): 1·2, 4·3, 9·4, 16·5, 25·6 → 36·7 = 252.',
    n10: 'Hiệu giữa các số là 1, 4, 9, 16 (bình phương) → tiếp theo +25: 31 + 25 = 56.',
    n11: 'Nhân 2 rồi cộng lần lượt 1, 2, 3, 4 → 74 × 2 + 5 = 153.',
    n12: 'Số thứ n bằng n² + 1 nếu n lẻ, n² − 1 nếu n chẵn → 7² + 1 = 50.',
    v1: 'Tiếng kêu đặc trưng của con vật: chó sủa, mèo kêu meo meo.',
    v2: 'Cà rốt là rau củ, các từ còn lại là trái cây.',
    v3: 'Nơi làm việc: bác sĩ ở bệnh viện, giáo viên ở trường học.',
    v4: 'Khiêm tốn là không tự đề cao mình, trái nghĩa với kiêu ngạo.',
    v5: 'Quan hệ bộ phận – tổng thể: chương là một phần của sách, khổ thơ là một phần của bài thơ.',
    v6: 'Bốn từ còn lại đều chỉ sự nghi ngờ; “tin tưởng” mang nghĩa ngược lại.',
    v7: 'Mẹ của bố tôi là bà nội của tôi; đối với con trai tôi, bà là cụ nội (bà cố).',
    v8: 'Người đàn ông là con một nên “con trai của bố tôi” chính là ông ấy. Bố của người trong ảnh là ông ấy → người trong ảnh là con trai ông.',
    l1: 'An > Bình > Cường nên Cường thấp nhất.',
    l2: 'Hôm qua là thứ Hai → hôm nay thứ Ba → ngày kia (2 ngày sau) là thứ Năm.',
    l3: 'Mỗi máy làm 1 sản phẩm trong 5 phút. 100 máy làm song song 100 sản phẩm vẫn mất 5 phút.',
    l4: 'Chỉ có 2 màu, nên lấy 3 chiếc thì chắc chắn có 2 chiếc cùng màu (nguyên lý Dirichlet).',
    l5: '“Một số loài hoa tàn nhanh” có thể là các loài khác, không nhất thiết có hoa hồng → không kết luận được.',
    l6: 'Bút giá x, vở giá x + 10.000 → 2x + 10.000 = 11.000 → x = 500đ.',
    l7: 'Số có dạng 10a + b với a + b = 9. Đảo lại lớn hơn 27 → 9(b − a) = 27 → b − a = 3 → a = 3, b = 6 → 36.',
    l8: 'Nếu A nói dối thì câu “ít nhất một người nói dối” lại thành đúng – mâu thuẫn. Vậy A trung thực, câu nói đúng, nên B là kẻ nói dối.',
    l9: 'Hộp nhãn “Táo và Cam” bị dán sai nên chỉ chứa MỘT loại – lấy 1 quả là biết ngay (giả sử là cam → đây là hộp Cam). Hộp nhãn “Táo” không phải hộp Táo, mà hộp Cam đã tìm ra → nó là hộp Táo và Cam. Hộp còn lại (nhãn “Cam”) là hộp Táo. Lấy từ hộp khác thì không đủ: một quả cam từ hộp nhãn “Táo” có thể đến từ hộp Cam hoặc hộp hỗn hợp.',
    l10: 'Kim phút chỉ số 3 (90°). Kim giờ đã đi thêm 1/4 khoảng từ số 3 đến số 4: 90° + 30° × 1/4 = 97,5°. Góc giữa hai kim là 7,5°.',
    l11: 'An không phải giáo viên. Bình lớn tuổi hơn An nên không nhỏ tuổi nhất → cũng không phải giáo viên. Vậy Chi là giáo viên. Bình lớn tuổi hơn người kỹ sư nên Bình không phải kỹ sư → Bình là bác sĩ.',
    l12: 'Mỗi lần cân chia xu thành 3 nhóm (đĩa trái, đĩa phải, ngoài cân) và biết đồng giả nằm ở nhóm nào: 12 → 4 → 2 → 1, tức 3 lần. Cân 2 lần chỉ phân biệt được tối đa 3 × 3 = 9 đồng, không đủ cho 12.',
    l13: 'Nếu A trung thực: B nói dối → câu của B sai → A và C khác loại → C nói dối. Nếu A nói dối: B trung thực → A và C cùng loại → C nói dối. Cả hai trường hợp C đều là kẻ nói dối.',
    m1: 'Mỗi hàng một loại hình; số hình theo cột là 1, 2, 3 → 3 hình tam giác.',
    m2: 'Loại hình theo cột (tròn, vuông, thoi), màu theo hàng (trắng, xám, đen) → hình thoi màu đen.',
    m3: 'Mũi tên xoay thêm 45° mỗi cột, mỗi hàng bắt đầu lệch 90° → hàng 3: 180°, 225°, 270° (chỉ sang trái).',
    m4: 'Mỗi hàng có đủ 3 loại hình và đủ số lượng 1, 2, 3 → hàng cuối còn thiếu 1 hình tam giác.',
    m5: 'Số hình ở cột 3 = cột 1 + cột 2: 2 + 3 = 5 ngôi sao.',
    m6: 'Mỗi hàng có đủ 3 loại hình ngoài và 3 loại hình trong → còn thiếu hình vuông chứa hình tròn.',
    m7: 'Cột 3 giữ các nét chỉ có ở MỘT trong hai cột đầu, nét trùng nhau thì biến mất → hàng 3: nét trên, nét dưới, nét trái.',
    m8: 'Mỗi hàng đủ 3 loại hình và 3 màu; số hình theo cột là 1, 2, 3 → 3 tam giác màu trắng.',
    m9: 'Đọc từ trái sang phải, trên xuống dưới: mũi tên xoay thêm 45° mỗi ô, màu xen kẽ trắng/đen → ô thứ 9 xoay đủ 360° (chỉ lên) và màu trắng.',
    m10: 'Cột 3 chỉ giữ các nét có ở CẢ hai cột đầu → hàng 3: nét trái, nét phải, đường chéo.',
    m11: 'Mỗi hàng xoay đều một góc: hàng 1 +45°, hàng 2 +90°, hàng 3 +135° → 135° + 135° = 270° (chỉ sang trái).',
    m12: 'Mỗi hàng đủ 3 loại hình và 3 màu; số hình ở cột 3 = cột 1 + cột 2: 1 + 3 = 4 → 4 hình tròn màu đen.',
  };
  window.QUESTIONS.forEach(q => { q.explain = EXPLAIN[q.id]; });
})();
