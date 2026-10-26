/*
 * Chấm điểm IQ theo chuẩn tâm trắc học hiện đại.
 *
 * 1) Ước lượng năng lực θ bằng Lý thuyết Ứng đáp Câu hỏi (IRT), mô hình 3 tham số (3PL):
 *      P(đúng | θ) = c + (1 − c) / (1 + e^(−a(θ − b)))
 *    a = độ phân biệt, b = độ khó, c = xác suất đoán mò (1 / số phương án).
 *    θ được ước lượng bằng EAP (Expected A Posteriori) với tiên nghiệm θ ~ N(0, 1).
 *
 * 2) Quy đổi sang IQ độ lệch (deviation IQ, chuẩn Wechsler / Stanford-Binet 5):
 *      IQ = 100 + 15 · z     (z = θ, vì θ đã chuẩn hoá theo dân số)
 */
(function (root) {
  'use strict';

  const MEAN = 100, SD = 15, IQ_MIN = 40, IQ_MAX = 160;

  const BANDS = [
    { min: -Infinity, max: 70, label: 'Rất thấp', sub: 'Thiểu năng trí tuệ', en: 'Extremely Low', color: '#FF5A3C',
      desc: 'Thấp hơn trung bình trên 2 độ lệch chuẩn. Trong lâm sàng, mức này cần chuyên gia đánh giá thêm về khả năng thích ứng.' },
    { min: 70, max: 80, label: 'Ranh giới', sub: 'Borderline', en: 'Borderline', color: '#FF8A3D',
      desc: 'Nằm giữa mức thấp và dưới trung bình. Có thể gặp khó khăn với các nhiệm vụ trừu tượng phức tạp.' },
    { min: 80, max: 90, label: 'Dưới trung bình', sub: 'Low Average', en: 'Low Average', color: '#FFC83D',
      desc: 'Hơi thấp hơn mức phổ biến nhưng vẫn hoạt động tốt trong hầu hết công việc thường ngày.' },
    { min: 90, max: 110, label: 'Trung bình', sub: 'Average', en: 'Average', color: '#FFEF0A',
      desc: 'Nhóm đông nhất – khoảng một nửa dân số. Khả năng suy luận ở mức phổ biến.' },
    { min: 110, max: 120, label: 'Trên trung bình', sub: 'High Average', en: 'High Average', color: '#B8F03C',
      desc: 'Suy luận nhanh và chính xác hơn phần lớn mọi người.' },
    { min: 120, max: 130, label: 'Thông minh', sub: 'Superior', en: 'Superior', color: '#3CD6A0',
      desc: 'Khả năng tư duy trừu tượng tốt, học nhanh, xử lý vấn đề phức tạp hiệu quả.' },
    { min: 130, max: 145, label: 'Rất thông minh', sub: 'Gifted · Ngưỡng Mensa', en: 'Very Superior / Gifted', color: '#3C7BFF',
      desc: 'Top ~2% dân số – đủ điều kiện gia nhập Mensa (IQ ≥ 130).' },
    { min: 145, max: Infinity, label: 'Thiên tài', sub: 'Highly Gifted', en: 'Genius', color: '#B45CFF',
      desc: 'Cao hơn trung bình trên 3 độ lệch chuẩn – khoảng 1 trên 740 người.' },
  ];

  // Hàm phân phối chuẩn tích luỹ Φ(z) (Abramowitz & Stegun 26.2.17, sai số < 7.5e-8)
  function normCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  }

  function pCorrect(theta, item) {
    const c = 1 / item.k;
    return c + (1 - c) / (1 + Math.exp(-item.a * (theta - item.b)));
  }

  /*
   * Chuẩn theo độ tuổi (age norms). Giống WAIS/WISC, IQ được so với người CÙNG NHÓM TUỔI.
   * Độ khó câu hỏi được hiệu chỉnh theo người trưởng thành 20–34 tuổi (đỉnh trí tuệ lưu động).
   * AGE_NORMS cho năng lực trung bình của từng độ tuổi (đơn vị: độ lệch chuẩn so với nhóm 20–34),
   * xấp xỉ theo đường cong phát triển và suy giảm của suy luận lưu động (Raven, WAIS PRI).
   */
  const AGE_MIN = 10, AGE_MAX = 90;
  // Nếu đã chạy tools/calibrate.py, js/params.js sẽ cung cấp chuẩn tuổi đo từ dữ liệu thực
  const calibrated = root.IQ_PARAMS && root.IQ_PARAMS.ageNorms;
  const AGE_NORMS = calibrated && calibrated.length >= 2 ? calibrated : [
    [10, -1.6], [12, -1.1], [14, -0.65], [16, -0.3], [18, -0.1], [20, 0], [34, 0],
    [45, -0.15], [55, -0.35], [65, -0.65], [75, -1.0], [90, -1.5],
  ];

  function ageMean(age) {
    const a = Math.min(AGE_MAX, Math.max(AGE_MIN, age));
    if (a <= AGE_NORMS[0][0]) return AGE_NORMS[0][1];
    for (let i = 1; i < AGE_NORMS.length; i++) {
      const [x0, y0] = AGE_NORMS[i - 1], [x1, y1] = AGE_NORMS[i];
      if (a <= x1) return y0 + ((a - x0) / (x1 - x0)) * (y1 - y0);
    }
    return AGE_NORMS[AGE_NORMS.length - 1][1];
  }

  function ageGroup(age) {
    if (age < 16) return `${age} tuổi`;
    const groups = [[16, 17], [18, 19], [20, 24], [25, 29], [30, 34], [35, 44], [45, 54], [55, 64], [65, 69], [70, 74], [75, 79], [80, 90]];
    const g = groups.find(([lo, hi]) => age >= lo && age <= hi) || groups[groups.length - 1];
    return `${g[0]}–${g[1]} tuổi`;
  }

  // items: [{a, b, k}], resp: [0|1], mu: năng lực trung bình của nhóm tuổi (tiên nghiệm N(mu, 1))
  function estimateTheta(items, resp, mu = 0) {
    let sw = 0, s1 = 0, s2 = 0;
    for (let t = -6; t <= 5.0001; t += 0.01) {
      let logL = -(t - mu) * (t - mu) / 2;
      for (let i = 0; i < items.length; i++) {
        const p = pCorrect(t, items[i]);
        logL += Math.log(resp[i] ? p : 1 - p);
      }
      const w = Math.exp(logL);
      sw += w; s1 += w * t; s2 += w * t * t;
    }
    const theta = s1 / sw;
    return { theta, se: Math.sqrt(Math.max(s2 / sw - theta * theta, 0)) };
  }

  function bandOf(iq) {
    return BANDS.find(b => iq >= b.min && iq < b.max);
  }

  function score(items, resp, age = 25) {
    const mu = ageMean(age);
    const { theta, se } = estimateTheta(items, resp, mu);
    // z so với nhóm cùng tuổi, rồi quy đổi IQ độ lệch
    const iq = Math.min(IQ_MAX, Math.max(IQ_MIN, Math.round(MEAN + SD * (theta - mu))));
    const z = (iq - MEAN) / SD;
    const pct = normCdf(z) * 100;
    const half = Math.round(1.96 * SD * se);
    return {
      theta, se, iq, z, percentile: pct, age, ageGroup: ageGroup(age),
      // IQ nếu so với người trưởng thành 20–34 tuổi (không hiệu chỉnh tuổi)
      adultIq: Math.min(IQ_MAX, Math.max(IQ_MIN, Math.round(MEAN + SD * theta))),
      ci: [Math.max(IQ_MIN, iq - half), Math.min(IQ_MAX, iq + half)],
      rarity: z >= 0 ? 1 / (1 - normCdf(z)) : 1 / normCdf(z),
      band: bandOf(iq),
      // Quy đổi sang các thang có độ lệch chuẩn khác
      sd16: Math.round(MEAN + 16 * z),
      sd24: Math.round(MEAN + 24 * z),
    };
  }

  function bandShare(band) {
    const lo = band.min === -Infinity ? 0 : normCdf((band.min - MEAN) / SD);
    const hi = band.max === Infinity ? 1 : normCdf((band.max - MEAN) / SD);
    return (hi - lo) * 100;
  }

  const api = { MEAN, SD, IQ_MIN, IQ_MAX, AGE_MIN, AGE_MAX, BANDS, normCdf, ageMean, ageGroup, estimateTheta, score, bandOf, bandShare };
  if (typeof module !== 'undefined') module.exports = api;
  else root.IQScore = api;
})(typeof window !== 'undefined' ? window : globalThis);
