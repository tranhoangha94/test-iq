"""
Server cho website trắc nghiệm IQ: phục vụ file tĩnh và nhận kết quả ẩn danh.

    python server.py [--port 5173] [--host 127.0.0.1]

POST /api/results  → nối thêm 1 dòng JSON vào data/results.jsonl
Không lưu địa chỉ IP hay bất kỳ thông tin định danh nào.
"""
import argparse
import json
import os
import sys
import re
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(ROOT, "data", "results.jsonl")
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
        if path.startswith("/data") or path.startswith("/tools") or path.startswith("/.") or path.endswith(".py"):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/results":
            self.send_error(404)
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

    def _reply(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Ghi log không kèm địa chỉ IP
        print(f"[{self.log_date_time_string()}] {fmt % args}")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=5173)
    args = ap.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Serving on http://{args.host}:{args.port}  (dữ liệu: {DATA_FILE})")
    server.serve_forever()


if __name__ == "__main__":
    main()
