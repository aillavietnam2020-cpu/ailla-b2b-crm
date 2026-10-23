"""Doc kich ban Pancake V5 (file cua chi Hoa) thanh danh muc ma -> cac tin nhan nguyen van.
Agent chi duoc CHON ma; noi dung gui khach luon lay nguyen van tu file nay."""
from __future__ import annotations

import re
from pathlib import Path

SCRIPT = Path("/root/fb-ailla-tester/kich-ban-v5.md")
CODE_RE = re.compile(r"`(/BT_[A-Z0-9_]+)`")
MEDIA_RE = re.compile(r"`((?:MEDIA|HDSD|FB)-[A-Z0-9-]+)`")
TIN_RE = re.compile(r"^\*\*TIN\s*(\d+)\*\*\s*$")


def clean(text: str) -> str:
    t = text.replace("**", "").replace("`[ANH/CHỊ]`", "[ANH/CHỊ]")
    t = re.sub(r"[ \t]+\n", "\n", t)
    return t.strip()


def parse_v5(path: Path = SCRIPT) -> dict:
    """Tra ve {ma: {"title": ..., "msgs": [str], "media": [ma_media]}}"""
    cat: dict = {}
    title = ""
    cur = None          # ma hien tai
    msgs: list[list[str]] = []
    media: list[str] = []
    faq_n = 0
    collecting = False

    def flush():
        nonlocal cur, msgs, media
        if cur and any(m for m in msgs):
            cat[cur] = {"title": title_of[cur], "msgs": [clean("\n".join(m)) for m in msgs if any(x.strip() for x in m)],
                        "media": list(dict.fromkeys(media))}
        cur, msgs, media = None, [], []

    title_of: dict = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if line.startswith("#"):
            flush()
            collecting = False
            code = CODE_RE.search(line)
            head = CODE_RE.sub("", line).lstrip("# ").replace("Mã", "").strip(" —-:")
            if code:
                cur = code.group(1)
                title_of[cur] = head or title
                msgs = [[]]
                if line.startswith("##") and not line.startswith("###") or head:
                    title = head or title
            else:
                if line.startswith("## ") and ("“" in line or "?" in line) and not line.startswith("###"):
                    faq_n += 1
                    cur = f"FAQ_{faq_n}"
                    title_of[cur] = head
                    msgs = [[]]
                title = head if not line.startswith("###") else title
            continue
        if cur is None:
            continue
        m = TIN_RE.match(line.strip())
        if m:
            if msgs and any(x.strip() for x in msgs[-1]):
                msgs.append([])
            continue
        if line.startswith(">"):
            msgs[-1].append(line[1:].lstrip(" ") if line != ">" else "")
        elif line.startswith("**GỬI"):
            media.extend(MEDIA_RE.findall(line))
            collecting = True
        elif line.startswith("**NHÂN VIÊN CHỌN"):
            collecting = False  # nhanh nay agent tu chon dung 1 anh HDSD
        elif line.startswith("- ") and collecting:
            found = MEDIA_RE.findall(line)
            media.extend(found if found else ["NOTE:" + line[2:].strip()])
        elif line.strip() == "---":
            flush()
        elif line.strip():
            collecting = False
    flush()
    # Bo ma chi la bang media/nhan noi bo
    return cat


def catalog_for_agent(cat: dict) -> str:
    rows = []
    for k, v in cat.items():
        rows.append(f"{k} — {v['title']}")
    return "\n".join(rows)


def render(cat: dict, code: str, fills: list[str], xung: str) -> list[str]:
    ent = cat.get(code)
    if not ent:
        return []
    out = []
    fi = iter(fills)
    for m in ent["msgs"]:
        t = m.replace("[ANH/CHỊ]", xung)
        t = re.sub(r"#SEX\{[^}]*\}", xung, t)
        t = t.replace("#{FULL_NAME}", "").replace("  ", " ").replace(" ,", ",")
        while "…" in t:
            try:
                t = t.replace("…", next(fi), 1)
            except StopIteration:
                break
        t = t.strip()
        if t and t[0].islower():
            t = t[0].upper() + t[1:]
        out.append(t)
    return out


# ---- Mau tra loi nhanh Pancake cho TAY LONG / TAY MOC GIOANG (chi cac mau khong co gia; gia co nhieu bang khac nhau -> hoi chi) ----
QR_FILE = Path("/root/fb-ailla-tester/pancake-quick-replies.txt")
QR_WHITELIST = {
    8: ("/TL_HOI_QUANTAM", "Tẩy lồng: chào, hỏi khách có quan tâm tẩy lồng giặt và tẩy gioăng cao su Ailla không"),
    9: ("/TL_HOI_MAY", "Tẩy lồng: hỏi bao lâu chưa vệ sinh lồng, máy cửa đứng hay ngang, gioăng có mốc không"),
    10: ("/TL_MOC_NGUYENNHAN", "Tẩy lồng: giải thích vì sao gioăng cao su bị mốc"),
    14: ("/TL_MOC_XULY", "Tẩy lồng: gioăng mốc phải xử lý ngay, vệ sinh lồng định kỳ 2-3 tháng"),
    11: ("/TL_TEST_GIOANG", "Tẩy lồng: gửi ảnh/video test trực tiếp tẩy mốc gioăng"),
    12: ("/TL_KHONG_CAMKET_100", "Tẩy lồng: không khẳng định sạch 100%, sạch 80-90%"),
    13: ("/TL_SACH_HOANTOAN", "Tẩy lồng: còn mốc như ảnh thì sạch hoàn toàn"),
    25: ("/TL_HDSD_NGANG", "Tẩy lồng: hướng dẫn dùng cho máy giặt cửa NGANG"),
    26: ("/TL_HDSD_DUNG", "Tẩy lồng: hướng dẫn dùng cho máy giặt cửa ĐỨNG"),
}


QR_MEDIA = {"/TL_TEST_GIOANG": [f"PANCAKE-TL_TEST_GIOANG-{i}" for i in range(1, 7)]}


QR_LINE2 = {0: ("/CHUNG_HOI_SANPHAM", "Chung: khach chua noi ro san pham (vi du chi hoi gia) - hoi khach muon ve sinh luoi hut mui, tay long giat, xong noi hay quan ao", 1)}


def parse_qr(path: Path = QR_FILE) -> dict:
    out: dict = {}
    if not path.exists():
        return out
    for block in re.split(r"(?m)^### ", path.read_text(encoding="utf-8"))[1:]:
        head, _, body = block.partition("\n")
        m = re.match(r"#(\d+) \|", head)
        if m and int(m.group(1)) in QR_LINE2:
            code2, title2, li = QR_LINE2[int(m.group(1))]
            lines = [x for x in body.strip().splitlines() if x.strip()]
            if len(lines) > li:
                out[code2] = {"title": title2, "msgs": [lines[li].strip()], "media": []}
            continue
        if not m or int(m.group(1)) not in QR_WHITELIST:
            continue
        code, title = QR_WHITELIST[int(m.group(1))]
        text = body.strip()
        if not text:
            continue
        ph = re.search(r"photos=(\d+), files=(\d+)", head)
        media = [f"NOTE:mẫu Pancake này gửi kèm {ph.group(1)} ảnh/{ph.group(2)} file"] if ph and (ph.group(1) != "0" or ph.group(2) != "0") else []
        media = QR_MEDIA.get(code, media)
        out[code] = {"title": title, "msgs": [text], "media": media}
    return out


# ---- Báo giá Tẩy lồng / Tẩy mốc gioăng / Tẩy lồng Aibio: CHỈ theo "BẢNG GIÁ SP FACEBOOK" chị Hoa đưa (Google Sheet 1_zy-0gb9Auu0iCvdk4qRo99tH4SzkIFGuObBrz7Vqkk) ----
QR_STATIC = {
    "/TL_GIA_COMBO": {
        "title": "Tẩy lồng: báo giá 4 combo Tẩy lồng + Tẩy mốc gioăng cao su theo BẢNG GIÁ SP FACEBOOK (khách hỏi giá tẩy lồng hoặc combo)",
        "msgs": [
            "Bộ đôi Tẩy lồng - Tẩy mốc gioăng cao su Ailla bên em đang có giá ưu đãi ạ:\n"
            "✅ COMBO 1: 1 Tẩy lồng + 1 Tẩy mốc gioăng chỉ 145K. TẶNG 1 chổi quét, MIỄN PHÍ SHIP.\n"
            "✅ COMBO 2: 2 Tẩy lồng + 1 Tẩy mốc gioăng chỉ 205K. TẶNG 1 chổi quét + 1 tinh dầu tím, MIỄN PHÍ SHIP.\n"
            "✅ COMBO 3: 2 Tẩy lồng + 2 Tẩy mốc gioăng chỉ 269K. TẶNG 2 chổi quét + 1 nồi điện mini, MIỄN PHÍ SHIP.\n"
            "✅ COMBO 4: 2 Tẩy lồng + 2 Tẩy mốc gioăng chỉ 269K. TẶNG 2 chổi quét + 1 tinh dầu tím, MIỄN PHÍ SHIP.\n"
            "👉 [ANH/CHỊ] muốn lấy Combo nào ạ?"
        ],
        "media": [],
    },
    "/CHUNG_BAM_1": {
        "title": "BÁM ĐUỔI lần 1 (hệ thống tự gửi khi khách im lặng; agent KHÔNG chọn mã này)",
        "msgs": ["[ANH/CHỊ] ơi mình có đang online không ạ?\nMình còn băn khoăn gì đừng ngần ngại, em vẫn đợi mình phản hồi ạ ^^"],
        "media": [],
    },
    "/CHUNG_BAM_2": {
        "title": "BÁM ĐUỔI lần 2 (hệ thống tự gửi khi khách im lặng; agent KHÔNG chọn mã này)",
        "msgs": ["[ANH/CHỊ] ơi mình còn băn khoăn gì về sản phẩm hay giá thành k ạ. [ANH/CHỊ] cứ chia sẻ, e vẫn đang chờ phản hồi của mình để được tiếp tục hỗ trợ và tư vấn cho mình ạ."],
        "media": [],
    },
}


def parse() -> dict:
    cat = parse_v5()
    cat.update(parse_qr())
    cat.update(QR_STATIC)
    return cat
