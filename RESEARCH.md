# Quy chuẩn trắc nghiệm IQ trên thế giới

Tài liệu này tóm tắt các chuẩn đang dùng trong tâm trắc học, và cách website áp dụng chúng.

## 1. Hai cách tính IQ

| Cách tính | Công thức | Tình trạng |
|---|---|---|
| **IQ tỷ lệ** (Ratio IQ, Stern 1912, Terman 1916) | IQ = Tuổi trí tuệ / Tuổi thật × 100 | **Đã bỏ.** Chỉ dùng được cho trẻ em, vì tuổi trí tuệ ngừng tăng ở người lớn. |
| **IQ độ lệch** (Deviation IQ, Wechsler 1939) | IQ = 100 + 15 × (X − μ) / σ | **Chuẩn hiện nay.** X là điểm thô, μ và σ là trung bình và độ lệch chuẩn của **nhóm cùng tuổi** trong mẫu chuẩn hoá. |

IQ độ lệch giả định điểm số trong dân số có phân phối chuẩn: **trung bình 100, độ lệch chuẩn (SD) 15**.

## 2. Các bài test chuẩn quốc tế

| Bài test | Độ tuổi | SD | Ghi chú |
|---|---|---|---|
| WAIS-IV (2008) / **WAIS-5** (2024) | 16–90 | 15 | Chuẩn vàng cho người lớn. 4–5 chỉ số: Ngôn ngữ, Suy luận lưu động, Thị giác–không gian, Trí nhớ làm việc, Tốc độ xử lý. |
| WISC-V | 6–16 | 15 | Phiên bản cho trẻ em của Wechsler. |
| Stanford-Binet 5 (2003) | 2–85+ | 15 | Các phiên bản cũ dùng SD 16. |
| Raven's Progressive Matrices | 5–80+ | — | Ma trận hình, không phụ thuộc ngôn ngữ; kết quả quy đổi theo bách phân vị. |
| Cattell Culture Fair III | 8+ | 15 / **24** | Thang SD 24 cho ra số "cao bất thường" (VD: 148 ≈ 130 trên SD 15). |

**Quy đổi giữa các thang:** cùng một điểm z → SD15: 100 + 15z · SD16: 100 + 16z · SD24: 100 + 24z.
Ngưỡng Mensa (top 2%): 130 (SD15) = 132 (SD16) = 148 (SD24).

## 3. Thang phân loại (dùng trên website)

Dựa trên phân loại của WAIS-IV/WAIS-5 và Stanford-Binet 5, có thêm mức "Thiên tài" (≥ 145, tức +3 SD).

| IQ | Phân loại | Tiếng Anh (WAIS) | % dân số |
|---|---|---|---|
| ≤ 69 | Rất thấp (thiểu năng trí tuệ) | Extremely Low | 2,3% |
| 70–79 | Ranh giới | Borderline / Very Low | 6,8% |
| 80–89 | Dưới trung bình | Low Average | 16,1% |
| 90–109 | Trung bình | Average | 49,5% |
| 110–119 | Trên trung bình | High Average | 16,1% |
| 120–129 | Thông minh | Superior / Very High | 6,8% |
| 130–144 | Rất thông minh (năng khiếu) | Very Superior / Extremely High | 2,1% |
| ≥ 145 | Thiên tài | Highly Gifted | 0,13% |

Ghi chú lâm sàng: theo DSM-5 và ICD-11, IQ < 70 chỉ là **một** tiêu chí của rối loạn phát triển trí tuệ; cần đánh giá thêm khả năng thích ứng. Website không dùng các nhãn mang tính xúc phạm.

## 4. Các nguyên tắc tâm trắc học

- **Chuẩn theo độ tuổi:** điểm luôn được so với người cùng nhóm tuổi (WAIS chia nhóm 16–17, 18–19, 20–24, 25–29, 30–34, 35–44, …).
- **Sai số đo lường (SEM):** WAIS có SEM khoảng 2–3 điểm. Kết quả nên được báo cáo kèm khoảng tin cậy 95%.
- **Hiệu ứng Flynn:** điểm thô trung bình tăng khoảng 3 IQ mỗi thập kỷ (thế kỷ 20), nên các bài test phải được chuẩn hoá lại định kỳ.
- **Trần đo (ceiling):** bài test có ít câu khó không phân biệt được người ở mức rất cao. WAIS có trần khoảng 160.
- **Lý thuyết Ứng đáp Câu hỏi (IRT):** chuẩn hiện đại (GRE, PISA, các bài test thích ứng) ước lượng năng lực θ từ độ khó của từng câu, thay vì chỉ đếm số câu đúng.

## 5. Website áp dụng như thế nào

1. **45 câu, 4 lĩnh vực** (dãy số, ngôn ngữ, logic, ma trận kiểu Raven), sắp xếp từ dễ đến khó, giới hạn 45 phút. Có 15 câu khó (b ≥ 2) để phân biệt tốt ở mức IQ 125–160 (bài test năng lực, tương tự Raven APM 40 phút).
2. **IRT 3PL:** mỗi câu có độ khó `b`, độ phân biệt `a`, xác suất đoán mò `c = 1/số phương án`:
   `P(đúng | θ) = c + (1 − c) / (1 + e^(−a(θ − b)))`
3. **Ước lượng EAP** với tiên nghiệm theo nhóm tuổi `θ ~ N(μ_tuổi, 1)` → θ và sai số chuẩn SE.
4. **Chuẩn tuổi:** `z = θ − μ_tuổi`, trong đó μ_tuổi được nội suy từ đường cong phát triển và suy giảm của suy luận lưu động (đỉnh ở 20–34 tuổi).
5. **IQ = 100 + 15z**, giới hạn trong 40–160. Bách phân vị = Φ(z). Khoảng tin cậy 95% = IQ ± 1,96 × 15 × SE.
6. Quy đổi thêm sang thang SD 16 và SD 24.
7. **Sinh câu hỏi tự động** (Automatic Item Generation – Gierl & Haladyna 2013): mỗi câu là một khuôn có quy luật và độ khó cố định, mỗi lần làm sinh biến thể mới. Mọi biến thể của một khuôn dùng chung tham số IRT (giả định *đồng dạng* – isomorph). Mỗi bài nộp lưu seed của biến thể để kiểm chứng giả định này khi có dữ liệu.
8. **Kiểm soát sai lệch** (`tools/validate_items.js`): vị trí đáp án cân bằng trong từng bộ đề; phương án nhiễu của câu số được chọn để thứ hạng đáp án phân bố đều; phương án nhiễu của ma trận theo phương pháp RAVEN-FAIR (Benny và cộng sự, 2021) cộng thêm bước chọn tập phương án để mẹo "chọn hình giống nhất" chỉ đúng ở mức đoán mò.
9. **Hiệu ứng luyện tập:** làm lại thường cao hơn 5–8 điểm dù câu hỏi khác (Calamia và cộng sự, 2012). Trang kết quả cảnh báo từ lần làm thứ 2; khi chuẩn hoá chỉ dùng lần làm đầu.

Kiểm tra mô phỏng (người 22 tuổi, đúng N câu dễ nhất): 0 → 57 · 20 → 107 · 30 → 124 · 35 → 132 · 40 → 141 · 45 → 156.

## 6. Giới hạn cần nói rõ với người dùng

- Độ khó `b`, `a` và đường cong tuổi ban đầu là **ước lượng theo chuyên môn**. Website thu thập kết quả ẩn danh (khi người dùng đồng ý), và `tools/calibrate.py` dùng dữ liệu đó để chuẩn hoá lại:
  - Ước lượng tham số câu hỏi bằng MML-EM (Bock & Aitkin 1981), có tiên nghiệm nhẹ cho a và b như BILOG-MG.
  - Neo thang đo vào nhóm tham chiếu 20–34 tuổi (trung bình 0, SD 1), rồi tính chuẩn cho từng nhóm tuổi, có hiệu chỉnh độ co về trung bình của EAP.
  - Mẫu tự nguyện trên mạng không đại diện cho dân số (thường lệch về nhóm có học vấn cao). Vì vậy dù đã chuẩn hoá, điểm vẫn chỉ mang tính tham khảo.
- Không đo trí nhớ làm việc và tốc độ xử lý như WAIS, nên đây chủ yếu là thước đo **suy luận**.
- Kết quả chỉ để tham khảo, không có giá trị chẩn đoán.
