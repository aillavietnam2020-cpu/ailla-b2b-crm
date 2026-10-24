#!/usr/bin/env python3
"""Nghe ghi âm từ web Điều hành agent bằng Whisper large-v3 (whisper.cpp, card đồ họa) rồi trả chữ.
Lấy việc từ /api/stt-worker/pull, trả kết quả ở /push. Khóa và địa chỉ web đọc từ AillaWorker/data/hub.json (không in ra).
Dùng chung khóa "gpu" với Worker dựng video để hai bên không tranh card đồ họa."""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HOME = Path(r"C:\Users\ADMIN")
HUB = HOME / "AillaWorker" / "data" / "hub.json"
LOCK = HOME / "AillaWorker" / "data" / "locks" / "gpu.lock"
WCLI_GPU = HOME / "whisper-cpp" / "cuda" / "Release" / "whisper-cli.exe"
WCLI_CPU = HOME / "whisper-cpp" / "bin2" / "Release" / "whisper-cli.exe"
MODEL = HOME / "whisper-cpp" / "models" / "ggml-large-v3.bin"
FFMPEG = next(iter((HOME / "AppData/Local/Microsoft/WinGet/Packages").glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe")), None)
# Từ vựng của AILLA để Whisper bớt nghe sai tên riêng
PROMPT = ("AILLA, AiBio, ABOS, Tẩy lồng giặt, bột tẩy, lau sàn, công nợ, phiếu chi, phiếu thu, Pancake, TikTok, Shopee, "
          "Facebook, chị Hoa, chị Thảo, chị Huệ, kế toán trưởng, đại lý, nhà phân phối.")
POLL = 3
LOG = Path(__file__).with_name("stt-worker.log")


def log(*a):
    line = time.strftime("%d/%m %H:%M:%S ") + " ".join(str(x) for x in a)
    print(line, flush=True)
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
        if LOG.stat().st_size > 500_000:
            LOG.write_text("", encoding="utf-8")
    except OSError:
        pass


cfg = json.loads(HUB.read_text(encoding="utf-8"))
BASE = str(cfg["url"]).rstrip("/")


def api(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Worker-Key", cfg["key"])
    req.add_header("User-Agent", "AillaStt/1.0")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["data"]


def gpu_lock(wait=120):
    """Cùng cách khóa với auto_text.py của Worker dựng video."""
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    while time.time() - t0 < wait:
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return True
        except FileExistsError:
            try:
                if time.time() - LOCK.stat().st_mtime > 900:
                    LOCK.unlink()
                    continue
            except FileNotFoundError:
                continue
            time.sleep(1)
    return False


def gpu_unlock():
    try:
        LOCK.unlink()
    except FileNotFoundError:
        pass


def transcribe(audio: bytes, mime: str) -> str:
    ext = {"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/mpeg": ".mp3", "audio/aac": ".aac"}.get(mime, ".wav")
    with tempfile.TemporaryDirectory() as d:
        src, wav, out = Path(d) / ("src" + ext), Path(d) / "in.wav", Path(d) / "out"
        src.write_bytes(audio)
        subprocess.run([str(FFMPEG), "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(wav)], check=True, capture_output=True, timeout=120)
        args = ["-m", str(MODEL), "-f", str(wav), "-l", "vi", "-nt", "-np", "-otxt", "-of", str(out)]
        done = False
        if WCLI_GPU.exists() and gpu_lock():
            try:
                subprocess.run([str(WCLI_GPU), *args], check=True, capture_output=True, timeout=300)
                done = True
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
                log("card đồ họa lỗi, nghe bằng bộ xử lý:", type(e).__name__)
            finally:
                gpu_unlock()
        if not done:
            subprocess.run([str(WCLI_CPU), *args], check=True, capture_output=True, timeout=600)
        text = out.with_suffix(".txt").read_text(encoding="utf-8", errors="replace")
    return " ".join(text.split())


def main():
    if len(sys.argv) > 1:  # thử một file: python stt-worker.py file.wav
        t0 = time.time()
        print(transcribe(Path(sys.argv[1]).read_bytes(), "audio/" + Path(sys.argv[1]).suffix.lstrip(".")))
        print("mất %.1f giây" % (time.time() - t0))
        return
    log("bắt đầu nghe ghi âm từ", BASE)
    while True:
        try:
            job = api("/api/stt-worker/pull", {})
            if not job:
                time.sleep(POLL)
                continue
            t0 = time.time()
            try:
                text = transcribe(base64.b64decode(job["audio"]), job["mime"])
                api("/api/stt-worker/push", {"id": job["id"], "text": text})
                log("xong", job["id"], "%.1fs" % (time.time() - t0), len(text), "ký tự")
            except Exception as e:  # noqa: BLE001
                log("lỗi", job["id"], repr(e)[:200])
                api("/api/stt-worker/push", {"id": job["id"], "error": "Máy nghe gặp lỗi, thử lại"})
        except Exception as e:  # noqa: BLE001  (mất mạng, web đang cập nhật)
            log("chờ nối lại:", repr(e)[:120])
            time.sleep(10)


if __name__ == "__main__":
    main()
