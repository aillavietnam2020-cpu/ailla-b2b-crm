#!/usr/bin/env python3
"""abos-relay - cầu nối giữa web ABOS (Điều hành agent) và OpenClaw trên VPS.

Vòng lặp: hỏi web có tin mới của chị không -> với mỗi tin, nhờ đúng agent OpenClaw trả lời
(lệnh `openclaw agent`) -> gửi câu trả lời lên web. Nếu tin có đánh dấu "gửi cả Telegram" thì
OpenClaw tự gửi bản trả lời sang kênh Telegram của agent đó.

Cấu hình đọc từ /root/.config/abos-relay.env (chmod 600, chị tự dán khoá bằng lệnh abos-relay-khoa):
  ABOS_URL=https://ailla-b2b-crm.aillavietnam2020.workers.dev
  ABOS_RELAY_KEY=...            (khoá cầu nối, trùng secret AGENT_RELAY_KEY của web)
  ABOS_SESSION=agent:{id}:main  (phiên của agent; {id} là mã agent)
Chương trình này CHỈ chuyển lời. Nó không có quyền gì với dữ liệu thật của web.
"""
import json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error

URL = os.environ.get("ABOS_URL", "https://ailla-b2b-crm.aillavietnam2020.workers.dev").rstrip("/")
KEY = os.environ.get("ABOS_RELAY_KEY", "")
SESSION = os.environ.get("ABOS_SESSION", "agent:{id}:main")
TIMEOUT = int(os.environ.get("ABOS_AGENT_TIMEOUT", "600"))
POLL = float(os.environ.get("ABOS_POLL", "3"))


def log(*a):
    print(time.strftime("%F %T"), *a, flush=True)


def web(path, body):
    req = urllib.request.Request(URL + "/api/agent-relay" + path, data=json.dumps(body).encode(), method="POST")
    req.add_header("X-Relay-Key", KEY)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "abos-relay/1")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("data")


def texts(o, out):
    """Gom chữ trả lời từ kết quả JSON của openclaw (cấu trúc có thể khác nhau giữa các bản)."""
    if isinstance(o, dict):
        for k in ("payloads", "replies", "messages", "content", "result", "reply", "text", "message", "output"):
            if k in o:
                texts(o[k], out)
    elif isinstance(o, list):
        for x in o:
            texts(x, out)
    elif isinstance(o, str) and o.strip():
        out.append(o.strip())


def ask_agent(m):
    sess = SESSION.replace("{id}", m["agent"])
    # Tin từ web không mang tên người gửi như Telegram, nên báo rõ ai đang nhắn để agent xưng hô đúng.
    framed = (
        "[Tin nhắn từ web Điều hành agent của AILLA, KHÔNG phải Telegram. Người nhắn là chị Hoa (Quỳnh Hoa Nguyễn), "
        "CEO / chủ doanh nghiệp AILLA, cùng một người với chat Telegram chính. Giữ đúng cách xưng hô, tính cách, "
        "trí nhớ và quy tắc đã thiết lập cho bạn: bạn xưng em, gọi chị.]\n\n" + m["body"]
    )
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(framed)
        path = f.name
    cmd = ["openclaw", "agent", "--agent", m["agent"], "--session-key", sess,
           "--message-file", path, "--json", "--timeout", str(TIMEOUT)]
    if m.get("tg"):
        cmd += ["--deliver", "--channel", "last"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT + 60,
                           env={**os.environ, "XDG_RUNTIME_DIR": os.environ.get("XDG_RUNTIME_DIR", "/run/user/0")})
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "openclaw lỗi").strip()[-600:])
    out = p.stdout.strip()
    try:
        found = []
        texts(json.loads(out), found)
        reply = "\n\n".join(dict.fromkeys(found)) if found else out
    except ValueError:
        reply = out
    return reply[:20000]


def main():
    if not KEY:
        sys.exit("Thiếu ABOS_RELAY_KEY. Chạy abos-relay-khoa để dán khoá.")
    log("abos-relay chạy, web:", URL)
    while True:
        try:
            for m in web("/pull", {}) or []:
                log("tin", m["id"], "->", m["agent"], "(tg)" if m.get("tg") else "")
                try:
                    reply = ask_agent(m)
                    web("/push", {"id": m["id"], "reply": reply})
                except Exception as e:  # lỗi của riêng tin này: báo lên web, đi tiếp
                    log("lỗi tin", m["id"], e)
                    try:
                        web("/push", {"id": m["id"], "error": "Agent chưa trả lời được: " + str(e)[:500]})
                    except Exception as e2:
                        log("không báo được lỗi lên web:", e2)
        except urllib.error.HTTPError as e:
            log("web trả lỗi", e.code)
            time.sleep(15)
        except Exception as e:
            log("chưa nối được web:", e)
            time.sleep(15)
        time.sleep(POLL)


main()
