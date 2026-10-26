# iq.test — Website trắc nghiệm IQ

Website HTML/CSS/JS thuần, không cần build. Phong cách thiết kế lấy cảm hứng từ obello.com.
Cơ sở khoa học và công thức tính: xem [RESEARCH.md](RESEARCH.md).

## Chạy thử

```bash
python server.py
```

Mở http://localhost:5173. Server vừa phục vụ website, vừa nhận kết quả ẩn danh và ghi vào `data/results.jsonl`.

## Cấu trúc

| File | Nội dung |
|---|---|
| `index.html` | 3 màn hình: giới thiệu, làm bài, kết quả |
| `css/style.css` | Giao diện |
| `js/config.js` | Cấu hình địa chỉ nhận kết quả ẩn danh (`collectUrl`) |
| `js/questions.js` | 45 **khuôn** câu hỏi (sinh biến thể mới mỗi lần làm), tham số IRT (`a`, `b`), phiên bản `QUESTION_BANK_VERSION` |
| `js/form.js` | Tạo bộ đề: chọn biến thể chưa gặp, cân bằng vị trí đáp án A/B/C… |
| `js/params.js` | Tham số đã chuẩn hoá từ dữ liệu thực (do `tools/calibrate.py` tạo; mặc định `null`) |
| `js/scoring.js` | Chấm điểm: IRT 3PL + EAP, chuẩn tuổi, IQ độ lệch (100 + 15z) |
| `js/app.js` | Luồng làm bài, đồng hồ, lưu tiến độ, gửi kết quả, vẽ trang kết quả |
| `server.py` | Server tĩnh + `POST /api/results` (chỉ dùng thư viện chuẩn Python) |
| `tools/calibrate.py` | Chuẩn hoá lại tham số IRT và chuẩn tuổi từ dữ liệu thu được |
| `tools/simulate.py` | Tạo dữ liệu giả lập để kiểm tra `calibrate.py` |
| `tools/validate_items.js` | Kiểm tra tự động độ chính xác và sai lệch của ngân hàng câu hỏi |
| `dev.html`, `js/dev/questions.js`, `js/dev/app.js` | Test thuật toán cho lập trình viên (30 khuôn, code JS/Python) |
| `tools/validate_dev.js` | Kiểm tra bài thuật toán: chạy thật code JS và Python, đo độ phức tạp, đo sai lệch |

## Thu thập kết quả ẩn danh

Khi bắt đầu làm bài, người dùng thấy ô **“Đóng góp kết quả ẩn danh”** (mặc định được tích sẵn, có thể bỏ tích).
Nếu đồng ý, khi nộp bài trình duyệt gửi:

```json
{ "bank": "v3", "age": 28, "attempt": 1, "elapsed": 1260, "timeLimit": 2700,
  "responses": { "n1": 1, "v1": 0, "m9": null },
  "choices":   { "n1": "10", "v1": "Gáy" },
  "variants":  { "n1": 2918374651, "v1": 88213 } }
```

- `responses`: 1 = đúng, 0 = sai, `null` = bỏ trống. `choices`: phương án đã chọn, dùng để phân tích phương án nhiễu.
- `variants`: seed của biến thể từng câu – tái tạo được đúng đề người đó đã làm, và kiểm tra các biến thể cùng khuôn có khó ngang nhau không.
- `attempt`: lần làm thứ mấy trên trình duyệt này. Khi chuẩn hoá chỉ dùng lần đầu, để tránh hiệu ứng luyện tập.
- **Không** gửi tên, email hay IP. Server cũng không ghi IP vào log, và thời gian chỉ lưu đến phút.
- Muốn tắt thu thập: đặt `collectUrl: ''` trong `js/config.js`. Khi đó ô đồng ý cũng ẩn đi.

### Deploy lên Railway (đang dùng)

`railway.json` chạy `python server.py`. Server tự nghe trên `$PORT`. Cấu hình service `web`:

| Biến / tài nguyên | Giá trị | Ý nghĩa |
|---|---|---|
| Volume | mount tại `/data` | Lưu `results.jsonl` bền vững qua các lần deploy |
| `DATA_DIR` | `/data` | Thư mục dữ liệu |
| `EXPORT_TOKEN` | chuỗi bí mật (xem tab Variables trên Railway) | Bật endpoint tải dữ liệu |
| `ALLOWED_ORIGINS` | `https://test-iq-soon.vercel.app` | Domain frontend khác được gửi kết quả (CORS), cách nhau bởi dấu phẩy |

Frontend cũng được host trên Vercel (https://test-iq-soon.vercel.app). `js/config.js` tự gửi kết quả sang Railway khi trang không chạy trên chính domain Railway. Khi đổi domain Railway, sửa `API_ORIGIN` trong `js/config.js`. Khi thêm domain frontend mới, thêm nó vào `ALLOWED_ORIGINS`.

Deploy lại sau khi sửa code:

```bash
railway up
```

Tải dữ liệu về máy rồi chuẩn hoá (thay `<TOKEN>` và `<domain>`):

```bash
curl -H "Authorization: Bearer <TOKEN>" https://<domain>/api/export -o data/results.jsonl
```

```bash
python tools/calibrate.py
```

Sau đó commit `js/params.js` và chạy `railway up`.

### Khi host tĩnh (Netlify, Vercel, GitHub Pages)

Các host tĩnh không chạy được `server.py`, nên cần trỏ `collectUrl` tới một endpoint nhận POST. Đơn giản nhất là dùng **Google Apps Script** gắn với một Google Sheet:

```js
function doPost(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('results');
  sheet.appendRow([new Date(), e.postData.contents]);
  return ContentService.createTextOutput('ok');
}
```

Deploy dưới dạng Web app (quyền truy cập “Anyone”), rồi dán URL vào `collectUrl`. Trình duyệt gửi với `Content-Type: text/plain`, nên không bị chặn CORS. Khi chuẩn hoá, xuất cột JSON ra file `.jsonl` (mỗi dòng một JSON).

## Chuẩn hoá lại tham số (khi đã có dữ liệu)

```bash
python tools/calibrate.py --dry-run
```

Lệnh này in báo cáo cho từng câu: tỷ lệ đúng, `a`/`b` cũ → mới, và cảnh báo câu có độ phân biệt thấp hoặc nghi sai đáp án. Nó cũng in chuẩn theo từng nhóm tuổi.

```bash
python tools/calibrate.py
```

Lệnh này ghi `js/params.js`; website tự dùng tham số mới khi tải lại. Mặc định cần **ít nhất 500 bài** (đổi bằng `--min-sample`), và mỗi nhóm tuổi cần ít nhất 30 người. Cần Node.js để đọc `js/questions.js`.

Kiểm tra trên dữ liệu giả lập (1.500 bài): sai số độ khó khoảng 0,23 logit, tương đương khoảng 3,5 điểm IQ.

```bash
python tools/simulate.py --n 1500 --out data/sim.jsonl
python tools/calibrate.py --input data/sim.jsonl --output data/params.sim.js --min-sample 100
```

**Quan trọng:** khi sửa nội dung hoặc đáp án một câu, hãy tăng `QUESTION_BANK_VERSION` trong `js/questions.js`. Như vậy dữ liệu cũ không bị trộn với dữ liệu mới, và `params.js` của phiên bản cũ tự động bị bỏ qua.

## Ngân hàng câu hỏi và kiểm tra tự động

Mỗi câu trong `js/questions.js` là một **khuôn** `make(rng)`: giữ nguyên quy luật và độ khó, nhưng mỗi lần làm bài sinh ra số liệu, hình, tên khác nhau. Dãy số, logic và ma trận hình được sinh ngẫu nhiên; ngôn ngữ chọn từ 8 phiên bản viết sẵn. Trình duyệt nhớ những biến thể đã gặp để lần sau không ra lại. Trang kết quả **không** hiện đáp án.

**Bắt buộc chạy trước mỗi lần deploy khi sửa câu hỏi:**

```bash
node tools/validate_items.js --n 10000 --forms 5000
```

Công cụ sinh hàng chục nghìn biến thể và hàng nghìn bộ đề, rồi kiểm tra:

| Nhóm | Kiểm tra |
|---|---|
| Độ chính xác | Bộ giải **độc lập** đọc đề hiển thị và tự tìm đáp án (dãy số theo quy luật; logic bằng vét cạn bảng chân trị / hoán vị; ma trận suy từ 8 ô). Dãy số còn được thử với 12 quy luật phổ biến khác – nếu quy luật khác cũng khớp và ra một phương án nhiễu thì báo **mơ hồ**. |
| Cấu trúc | Số phương án, không trùng, đáp án nằm trong phương án, hình hợp lệ |
| Vị trí đáp án | A/B/C… phân bố đều trên toàn bộ; trong một bộ đề chênh lệch ≤ 4, không 3 câu liền cùng vị trí |
| Giá trị đáp án | Không giá trị nào chiếm quá nhiều trong một khuôn; ít bộ đề có cùng đáp án số lặp ≥ 3 lần |
| Mẹo đoán | Thứ hạng đáp án số (không thường là lớn/nhỏ nhất), mẹo "chọn số ở giữa", "chọn câu dài nhất", "chọn hình giống các hình khác nhất", phương án "không xác định" không được luôn sai |
| Làm lại | 3 lần làm liên tiếp không gặp lại câu y hệt |

Thoát với mã 1 nếu có lỗi.

**Thêm khuôn mới:** thêm object có `id`, `domain`, `b`, `a`, `make(rng)` vào `js/questions.js`. Thêm bộ giải tương ứng vào `tools/validate_items.js`, chạy công cụ kiểm tra cho tới khi không còn lỗi, rồi tăng `QUESTION_BANK_VERSION`.

## Test thuật toán cho developer (`dev.html`)

30 câu, 40 phút, 6 chủ đề: độ phức tạp, cấu trúc dữ liệu, đọc code, sắp xếp & tìm kiếm, đệ quy & quy hoạch động, đồ thị. Code hiển thị bằng JavaScript hoặc Python (người làm tự chọn). Mỗi câu là một khuôn sinh mới mỗi lần làm; vị trí đáp án cân bằng bằng cùng module `js/form.js`. Kết quả là cấp độ Intern / Junior / Mid-level / Senior / Expert (theo năng lực IRT θ), kèm điểm theo chủ đề và lời giải từng câu.

Kiểm tra trước mỗi lần deploy khi sửa câu hỏi (cần Node.js và Python):

```bash
node tools/validate_dev.js --n 2000 --forms 3000 --py 40
```

- Câu "code in ra gì": chạy thật bản JavaScript và so với đáp án; chạy thật bản Python (mẫu) và so với kết quả JS.
- Câu độ phức tạp: chạy f(n) với n = 256…4096 (và n = 12, 18 để nhận ra hàm mũ), tìm lớp Big-O khớp nhất với số thao tác đo được.
- Câu heap, BST, đồ thị: giải lại bằng cách cài đặt khác (heap nhị phân thật, DFS bằng ngăn xếp, Bellman-Ford thay cho Dijkstra…).
- Sai lệch: vị trí đáp án, giá trị đáp án lặp lại, thứ hạng đáp án số, đáp án dài nhất.

Bài thuật toán hiện chưa thu thập kết quả, nên cấp độ dựa trên độ khó dự kiến của từng câu.
