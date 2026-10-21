#!/usr/bin/env python3
"""Kéo số liệu quảng cáo từng ngày rồi đẩy lên Trang quản trị Ailla (không dùng AI, không tốn token).
 - Facebook (chỉ đọc): chi phí, tin nhắn, lượt xem... theo chiến dịch, dùng khoá sẵn của lệnh fb-ads.
 - Pancake POS (chỉ đọc): đơn và doanh số theo Nguồn đơn (ví dụ "Thảo-TLG-Aibio"), dùng khoá sẵn poscake.env.
Cách chạy:  python3 ads-fb.py --dry   (chỉ in tóm tắt tên chiến dịch/nguồn đơn, không gửi)
            python3 ads-fb.py         (gửi lên web; cron 8h sáng)
Khoá gửi lên web: /root/.config/ailla/ingest.key. Script không in, không ghi lại khoá nào."""
import importlib.machinery, json, ssl, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

POS_ENV = Path("/root/.config/openclaw/poscake.env")
POS_BASE = "https://pos.pages.fm/api/v1"
WEB = "https://ailla-b2b-crm.aillavietnam2020.workers.dev/api/ingest/ads-fb"
KEY_FILE = Path("/root/.config/ailla/ingest.key")
VN = timezone(timedelta(hours=7))
ACCOUNTS = ["2438831049860777", "1721213761771236", "1056409566271847", "1498215448711810",
            "1340771911416054", "1979044982736581", "1354614543145294"]
DAYS_BACK = 75
POS_FIELDS = ["net_revenue", "total_order_count", "delivered_count", "delivered_revenue",
              "returned_revenue", "returned_order_count", "canceled_order_count"]
MSG_KEYS = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"]
BUY_KEYS = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"]


def env_file(path):
    out = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def action_value(row, keys):
    acts = {x.get("action_type"): num(x.get("value")) for x in row.get("actions", [])}
    for k in keys:
        if k in acts:
            return acts[k]
    return 0.0


def day_bounds(d):
    start = datetime.combine(d, datetime.min.time(), VN)
    end = datetime.combine(d, datetime.max.time(), VN)
    z = lambda t: t.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return z(start), z(end)


def pos_get(cfg, path, params):
    p = dict(params)
    p["api_key"] = cfg["POSCAKE_API_KEY"]
    url = POS_BASE + path.replace("{shop}", cfg["POSCAKE_SHOP_ID"]) + "?" + urllib.parse.urlencode(p, doseq=True)
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "ailla-ads-fb/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=ssl.create_default_context()) as r:
        return json.load(r)


def link_key(u):
    u = str(u or "").split("?")[0].split("#")[0].lower().replace("https://", "").replace("http://", "").replace("www.", "")
    return u.rstrip("/")


def pos_link_names(cfg):
    names = {}
    for x in pos_get(cfg, "/shops/{shop}/order_source", {}).get("data", []):
        if x.get("is_removed") or not x.get("link"):
            continue
        names[link_key(x["link"])] = (x.get("name") or "").strip()
    return names


def pos_source_names(cfg):
    names = {}
    for x in pos_get(cfg, "/shops/{shop}/order_source", {}).get("data", []):
        for k in (x.get("id"), x.get("custom_id")):
            if k is not None and x.get("name"):
                names[str(k)] = x["name"].strip()
    return names


def pos_split(cfg, d, dims):
    since, until = day_bounds(d)
    payload = pos_get(cfg, "/shops/{shop}/analytics/sale", {
        "since": since, "until": until, "success_status": "1", "success_record": "updated_at",
        "returned_record": "success_record", "select_fields[]": POS_FIELDS, "split_by[]": dims})
    out = []
    for row in payload.get("data", []):
        res = row.get("result", {})
        out.append((row, {"orders": num(res.get("total_order_count")), "revenue": num(res.get("net_revenue")),
                    "delivered": num(res.get("delivered_count")), "delivered_rev": num(res.get("delivered_revenue")),
                    "returned_rev": num(res.get("returned_revenue")), "canceled": num(res.get("canceled_order_count"))}))
    return out


def pos_day(cfg, d, link_names, src_names):
    camps = []
    try:
        for row, m_ in pos_split(cfg, d, ["Order.p_utm_campaign", "Order.source"]):
            v = row.get("Order.p_utm_campaign")
            sid = row.get("Order.source", row.get("order_sources"))
            camps.append(dict(m_, campaign_id=str(v) if v else "", source=src_names.get(str(sid), "mã " + str(sid))))
    except Exception:
        camps = []
        for row, m_ in pos_split(cfg, d, ["Order.p_utm_campaign"]):
            v = row.get("Order.p_utm_campaign")
            camps.append(dict(m_, campaign_id=str(v) if v else "", source=""))
    links = {}
    for row, m_ in pos_split(cfg, d, ["Order.link"]):
        k = link_key(row.get("Order.link"))
        t = links.setdefault(k, {"link": k, "name": link_names.get(k, ""), "orders": 0, "revenue": 0, "delivered": 0,
                                 "delivered_rev": 0, "returned_rev": 0, "canceled": 0})
        for f in ("orders", "revenue", "delivered", "delivered_rev", "returned_rev", "canceled"):
            t[f] += m_[f]
    return camps, list(links.values())


def fb_rows(fb, account, since, until):
    rows = fb.all_pages(f"act_{account}/insights", {
        "level": "campaign", "time_increment": 1, "time_range": json.dumps({"since": since, "until": until}),
        "fields": "account_id,account_name,campaign_id,campaign_name,spend,impressions,clicks,actions"})
    out = []
    for r in rows:
        if num(r.get("spend")) <= 0:
            continue
        out.append({"day": r.get("date_start"), "account": account, "campaign_id": r.get("campaign_id"),
                    "campaign": r.get("campaign_name"), "spend": num(r.get("spend")),
                    "impressions": num(r.get("impressions")), "clicks": num(r.get("clicks")),
                    "messages": action_value(r, MSG_KEYS), "purchase": action_value(r, BUY_KEYS)})
    return out


BILL_FILE = Path("/opt/ailla/giaodich.json")


def billing(fb, errors):
    """Lịch sử trừ tiền / nạp tiền từ nhật ký tài khoản quảng cáo. Facebook chỉ giữ khoảng 7 ngày nên dồn vào file trên máy."""
    try:
        keep = json.loads(BILL_FILE.read_text(encoding="utf-8")) if BILL_FILE.exists() else {}
    except Exception:
        keep = {}
    for acc in ACCOUNTS:
        try:
            rows = fb.all_pages(f"act_{acc}/activities", {"limit": 200, "fields": "event_type,event_time,extra_data,translated_event_type,object_name"})
        except BaseException as e:
            errors.append(f"GD {acc}: {str(e)[:100]}")
            continue
        for x in rows:
            t = x.get("event_type")
            if t not in ("ad_account_billing_charge", "funding_event_successful"):
                continue
            try:
                ex = json.loads(x.get("extra_data") or "{}")
            except Exception:
                ex = {}
            charge = t == "ad_account_billing_charge"
            amount = num(ex.get("new_value") if charge else ex.get("amount"))
            tx = str(ex.get("transaction_id") or "")
            key = f"{acc}|{t}|{tx or x.get('event_time')}|{int(amount)}"
            keep[key] = {"account": acc, "name": x.get("object_name") if charge else "", "kind": "tru" if charge else "nap",
                         "time": x.get("event_time"), "amount": amount, "currency": ex.get("currency", "VND"), "tx": tx}
        time.sleep(1)
    names = {}
    for v in keep.values():
        if v["name"]:
            names[v["account"]] = v["name"]
    for v in keep.values():
        v["name"] = names.get(v["account"], v["account"])
    try:
        BILL_FILE.write_text(json.dumps(keep, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        errors.append("GD lưu file: " + str(e)[:80])
    return sorted(keep.values(), key=lambda v: v["time"] or "", reverse=True)


def main():
    dry = "--dry" in sys.argv
    today = datetime.now(VN).date()
    days = [today - timedelta(days=i) for i in range(DAYS_BACK, -1, -1)]
    out = {str(d): {"fb": [], "pos": [], "link": []} for d in days}
    errors = []
    fb = importlib.machinery.SourceFileLoader("fbads", "/usr/local/bin/fb-ads").load_module()
    for acc in ACCOUNTS:
        # chia từng đoạn 10 ngày, nghỉ giữa các lần gọi; Facebook báo "quá nhiều lệnh" thì chờ rồi thử lại
        for i in range(0, len(days), 10):
            chunk = days[i:i + 10]
            for attempt in range(4):
                try:
                    for r in fb_rows(fb, acc, str(chunk[0]), str(chunk[-1])):
                        if r["day"] in out:
                            out[r["day"]]["fb"].append({k: v for k, v in r.items() if k != "day"})
                    break
                except BaseException as e:
                    msg = str(e)[:140]
                    if attempt < 3 and ("nhiều" in msg or "too many" in msg.lower() or "limit" in msg.lower()):
                        time.sleep(90)
                        continue
                    errors.append(f"FB {acc}: {msg}")
                    break
            time.sleep(2)
    bills = billing(fb, errors)
    cfg = env_file(POS_ENV)
    link_names = pos_link_names(cfg)
    src_names = pos_source_names(cfg)
    for d in days:
        try:
            out[str(d)]["pos"], out[str(d)]["link"] = pos_day(cfg, d, link_names, src_names)
        except Exception as e:
            errors.append(f"Pancake {d}: {type(e).__name__} {str(e)[:120]}")
        time.sleep(0.3)
    if dry:
        camps = {}
        fbname = {}
        for v in out.values():
            for r in v["fb"]:
                camps[r["campaign_id"]] = camps.get(r["campaign_id"], 0) + r["spend"]
                fbname[r["campaign_id"]] = r["campaign"]
        rev = {}
        norev = 0
        for v in out.values():
            for r in v["pos"]:
                if r["campaign_id"] in fbname:
                    rev[r["campaign_id"]] = rev.get(r["campaign_id"], 0) + r["revenue"]
                else:
                    norev += r["revenue"]
        tot = sum(rev.values()) + norev
        print("GHÉP ĐƠN PANCAKE VÀO CHIẾN DỊCH FACEBOOK (35 ngày):")
        print("  doanh số ghép được:", int(sum(rev.values())), "| không ghép được:", int(norev), "| tổng:", int(tot))
        print("TOP CHIẾN DỊCH (tên | chi | doanh số Pancake):")
        for k, v in sorted(camps.items(), key=lambda x: -x[1])[:12]:
            print(f"  {fbname[k][:45]} | {int(v):,} | {int(rev.get(k, 0)):,}")
        lk = {}
        for v in out.values():
            for r in v["link"]:
                key = r["name"] or "(link chưa có tên) " + r["link"][:40]
                lk[key] = lk.get(key, 0) + r["revenue"]
        print("TOP TRANG BÁN HÀNG (tên nguồn | doanh số):")
        for k, v in sorted(lk.items(), key=lambda x: -x[1])[:14]:
            print(f"  {k[:55]} | {int(v):,}")
        print("LỖI:", errors or "không")
        return
    if any(e.startswith("FB ") for e in errors):
        print("KHÔNG GỬI vì Facebook còn lỗi, giữ số cũ trên web. Lỗi:", errors)
        sys.exit(2)
    body = json.dumps({"days": out, "billing": bills}, ensure_ascii=False).encode()
    req = urllib.request.Request(WEB, data=body, method="POST", headers={
        "Content-Type": "application/json", "X-Ingest-Key": KEY_FILE.read_text().strip(), "User-Agent": "ailla-ads-fb/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        print(r.status, r.read().decode()[:200], "| lỗi:", errors or "không")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("LỖI:", e, file=sys.stderr)
        sys.exit(1)
