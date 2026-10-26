"""
Server cho website trắc nghiệm IQ: phục vụ file tĩnh và nhận kết quả ẩn danh.

    python server.py [--port 5173] [--host 127.0.0.1]

POST /api/results  → nối thêm 1 dòng JSON vào <DATA_DIR>/results.jsonl
GET  /api/export   → tải toàn bộ results.jsonl (cần header "Authorization: Bearer <EXPORT_TOKEN>")
Không lưu địa chỉ IP hay bất kỳ thông tin định danh nào.

Biến môi trường (dùng khi deploy, VD Railway):
  PORT          cổng lắng nghe (khi có, server nghe trên 0.0.0.0)
  DATA_DIR      thư mục lưu dữ liệu, nên trỏ vào volume bền vững (mặc định ./data)
  EXPORT_TOKEN  bật /api/export; để trống thì tắt
  ALLOWED_ORIGINS  domain frontend khác được phép gửi kết quả (CORS), VD https://test-iq-soon.vercel.app
"""
import argparse
import hmac
import json
import os
import sys
import re
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(os.environ.get("DATA_DIR") or os.path.join(ROOT, "data"), "results.jsonl")
EXPORT_TOKEN = os.environ.get("EXPORT_TOKEN", "")
# Các domain frontend được phép gửi kết quả (VD frontend host trên Vercel), cách nhau bởi dấu phẩy
ALLOWED_ORIGINS = {o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()}
MAX_BODY = 32 * 1024
ID_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
_write_lock = threading.Lock()


def clean_record(raw):
    """Kiểm tra và chuẩn hoá bản ghi. Trả về dict sạch, hoặc raise ValueError."""
    if not isinstance(raw, dict):
        raise ValueError("body must be an object")

    bank = raw.get("bank")
    if not isinstance(bank, str) or not ID_RE.match(bank):
        raise ValueError("invalid bank")

    age = raw.get("age")
    if not isinstance(age, int) or isinstance(age, bool) or not 10 <= age <= 90:
        raise ValueError("invalid age")

    responses = raw.get("responses")
    if not isinstance(responses, dict) or not 1 <= len(responses) <= 200:
        raise ValueError("invalid responses")
    for qid, v in responses.items():
        if not ID_RE.match(qid) or v not in (0, 1, None) or isinstance(v, bool):
            raise ValueError("invalid response entry")

    choices = raw.get("choices") or {}
    if not isinstance(choices, dict):
        raise ValueError("invalid choices")
    choices = {
        k: v[:120]
        for k, v in choices.items()
        if k in responses and isinstance(v, str)
    }

    def int_in(name, lo, hi, default=None):
        v = raw.get(name, default)
        if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
            raise ValueError(f"invalid {name}")
        return v

    return {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "bank": bank,
        "age": age,
        "attempt": int_in("attempt", 1, 10_000, 1),
        "elapsed": int_in("elapsed", 0, 24 * 3600, 0),
        "timeLimit": int_in("timeLimit", 1, 24 * 3600, 2100),
        "responses": responses,
        "choices": choices,
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Không cho tải dữ liệu thô và mã nguồn server qua web
        path = self.path.split("?", 1)[0]
        if path == "/api/export":
            self._export()
            return
        if path.startswith("/data") or path.startswith("/tools") or path.startswith("/.") or path.endswith(".py"):
            self.send_error(404)
            return
        super().do_GET()

    def _origin_allowed(self):
        """Không có Origin (curl, server khác) hoặc cùng domain, hoặc nằm trong ALLOWED_ORIGINS."""
        origin = self.headers.get("Origin")
        if not origin:
            return True
        return origin in ALLOWED_ORIGINS or urlsplit(origin).netloc == self.headers.get("Host", "")

    def end_headers(self):
        # send_error có thể gọi trước khi request được phân tích xong
        headers = getattr(self, "headers", None)
        origin = headers.get("Origin") if headers else None
        if origin and getattr(self, "path", "").startswith("/api/") and self._origin_allowed():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.split("?", 1)[0] != "/api/results" or not self._origin_allowed():
            self.send_error(404)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/results":
            self.send_error(404)
            return
        if not self._origin_allowed():
            self._reply(403, {"ok": False, "error": "origin not allowed"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY:
            self._reply(413 if length > MAX_BODY else 400, {"ok": False})
            return
        try:
            record = clean_record(json.loads(self.rfile.read(length).decode("utf-8")))
        except (ValueError, UnicodeDecodeError) as e:
            self._reply(400, {"ok": False, "error": str(e)})
            return

        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with _write_lock, open(DATA_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        self._reply(201, {"ok": True})

    def _export(self):
        auth = self.headers.get("Authorization", "")
        if not EXPORT_TOKEN or not hmac.compare_digest(auth.encode(), f"Bearer {EXPORT_TOKEN}".encode()):
            self.send_error(404)
            return
        body = b""
        if os.path.exists(DATA_FILE):
            with _write_lock, open(DATA_FILE, "rb") as f:
                body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="results.jsonl"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _reply(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Ghi log không kèm địa chỉ IP
        print(f"[{self.log_date_time_string()}] {fmt % args}", flush=True)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    env_port = os.environ.get("PORT")
    ap.add_argument("--host", default="0.0.0.0" if env_port else "127.0.0.1")
    ap.add_argument("--port", type=int, default=int(env_port or 5173))
    args = ap.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving on http://{args.host}:{args.port}  (dữ liệu: {DATA_FILE})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
