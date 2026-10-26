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
| `js/questions.js` | Ngân hàng 35 câu, tham số IRT ban đầu (`a`, `b`), phiên bản `QUESTION_BANK_VERSION` |
| `js/params.js` | Tham số đã chuẩn hoá từ dữ liệu thực (do `tools/calibrate.py` tạo; mặc định `null`) |
| `js/scoring.js` | Chấm điểm: IRT 3PL + EAP, chuẩn tuổi, IQ độ lệch (100 + 15z) |
| `js/app.js` | Luồng làm bài, đồng hồ, lưu tiến độ, gửi kết quả, vẽ trang kết quả |
| `server.py` | Server tĩnh + `POST /api/results` (chỉ dùng thư viện chuẩn Python) |
| `tools/calibrate.py` | Chuẩn hoá lại tham số IRT và chuẩn tuổi từ dữ liệu thu được |
| `tools/simulate.py` | Tạo dữ liệu giả lập để kiểm tra `calibrate.py` |

## Thu thập kết quả ẩn danh

Khi bắt đầu làm bài, người dùng thấy ô **“Đóng góp kết quả ẩn danh”** (mặc định được tích sẵn, có thể bỏ tích).
Nếu đồng ý, khi nộp bài trình duyệt gửi:

```json
{ "bank": "v1", "age": 28, "attempt": 1, "elapsed": 1260, "timeLimit": 2100,
  "responses": { "n1": 1, "v1": 0, "m9": null },
  "choices":   { "n1": "10", "v1": "Gáy" } }
```

- `responses`: 1 = đúng, 0 = sai, `null` = bỏ trống. `choices`: phương án đã chọn, dùng để phân tích phương án nhiễu.
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

## Thêm câu hỏi

Thêm object vào `js/questions.js` với `id`, `domain`, `b` (độ khó, khoảng −3…3), `a` (độ phân biệt, khoảng 1,2–2), `options` và `answer`. Sau đó tăng `QUESTION_BANK_VERSION`.
