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
ACCOUNTS_OPT = ["187878951968758"]  # Thảo Đỉnh: có quyền thì lấy, chưa có quyền thì bỏ qua, không chặn việc gửi
DAYS_BACK = 75
POS_FIELDS = ["net_revenue", "total_order_count", "delivered_count", "delivered_revenue",
              "returned_revenue", "returned_order_count", "canceled_order_count"]
MSG_KEYS = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"]
LEAD_KEYS = ["omni_complete_registration", "complete_registration", "offsite_conversion.fb_pixel_complete_registration"]
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


def pos_split(cfg, d, dims, extra=None):
    since, until = day_bounds(d)
    payload = pos_get(cfg, "/shops/{shop}/analytics/sale", {
        "since": since, "until": until, "success_status": "1", "success_record": "updated_at",
        "returned_record": "success_record", "select_fields[]": POS_FIELDS, "split_by[]": dims, **(extra or {})})
    out = []
    for row in payload.get("data", []):
        res = row.get("result", {})
        out.append((row, {"orders": num(res.get("total_order_count")), "revenue": num(res.get("net_revenue")),
                    "delivered": num(res.get("delivered_count")), "delivered_rev": num(res.get("delivered_revenue")),
                    "returned_rev": num(res.get("returned_revenue")), "canceled": num(res.get("canceled_order_count"))}))
    return out


def pos_user_names(cfg):
    names = {}
    try:
        for u in pos_get(cfg, "/shops/{shop}/users", {}).get("data", []):
            nm = u.get("name") or (u.get("user") or {}).get("name") or ""
            for v in list(u.values()) + list((u.get("user") or {}).values()):
                if isinstance(v, str) and len(v) == 36:
                    names[v] = nm
    except BaseException:
        pass
    return names


def pos_day(cfg, d, link_names, src_names, user_names):
    camps = []
    try:
        for row, m_ in pos_split(cfg, d, ["Order.p_utm_campaign", "Order.source"]):
            v = row.get("Order.p_utm_campaign")
            sid = row.get("Order.source", row.get("order_sources"))
            camps.append(dict(m_, campaign_id=str(v) if v else "", source=src_names.get(str(sid), "mã " + str(sid)), page=str(row.get("account") or row.get("page_id") or "")))
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
    fbp = []
    try:
        for row, m_ in pos_split(cfg, d, ["Order.source", "Variation.product_id"]):
            sid = str(row.get("Order.source", row.get("order_sources")))
            if src_names.get(sid, "") != "Facebook":
                continue
            pr = row.get("product") or {}
            cid = str(pr.get("custom_id") or "") if isinstance(pr, dict) else ""
            fbp.append({"page": str(row.get("account") or row.get("page_id") or ""), "code": cid,
                        "name": (pr.get("name") if isinstance(pr, dict) else "") or "",
                        "orders": m_["orders"], "revenue": m_["revenue"]})
    except BaseException:
        fbp = None
    return camps, list(links.values()), fbp


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
                    "messages": action_value(r, MSG_KEYS), "leads": action_value(r, LEAD_KEYS), "purchase": action_value(r, BUY_KEYS)})
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


def camp_pages(fb, ids_by_acc, errors):
    """Page mà từng chiến dịch tin nhắn cũ (tên không ghi người) đang chạy trên đó, để gán cho người phụ trách page."""
    out = {}
    for acc, ids in ids_by_acc.items():
        ids = sorted(ids)
        for i in range(0, len(ids), 40):
            chunk = ids[i:i + 40]
            try:
                rows = fb.all_pages(f"act_{acc}/adsets", {"limit": 200, "fields": "campaign_id,promoted_object",
                                                        "filtering": json.dumps([{"field": "campaign.id", "operator": "IN", "value": chunk}])})
            except BaseException as e:
                errors.append(f"PG {acc}: {str(e)[:80]}")
                continue
            for r in rows:
                pg = (r.get("promoted_object") or {}).get("page_id")
                if pg and r.get("campaign_id") not in out:
                    out[r["campaign_id"]] = str(pg)
            time.sleep(1.5)
    return out


def acc_info(fb, errors):
    """Tổng đã chi từ trước tới nay và dư nợ hiện tại của từng tài khoản quảng cáo, cho kế toán đối soát."""
    out = []
    for acc in ACCOUNTS + ACCOUNTS_OPT:
        try:
            r = fb.call("GET", f"act_{acc}", {"fields": "name,currency,amount_spent,balance,account_status"})
            out.append({"account": acc, "name": r.get("name"), "currency": r.get("currency"), "amount_spent": num(r.get("amount_spent")),
                        "balance": num(r.get("balance")), "status": r.get("account_status")})
        except BaseException as e:
            errors.append(f"INFO {acc}: {str(e)[:70]}")
        time.sleep(0.5)
    return out


def main():
    dry = "--dry" in sys.argv
    today = datetime.now(VN).date()
    days = [today - timedelta(days=i) for i in range(DAYS_BACK, -1, -1)]
    out = {str(d): {"fb": [], "pos": [], "link": []} for d in days}
    errors = []
    fb = importlib.machinery.SourceFileLoader("fbads", "/usr/local/bin/fb-ads").load_module()
    for acc in ACCOUNTS + ACCOUNTS_OPT:
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
                    errors.append(("FBopt " if acc in ACCOUNTS_OPT else "FB ") + f"{acc}: {msg}")
                    break
            time.sleep(2)
    mess_ids = {}
    for v in out.values():
        for r in v["fb"]:
            if str(r.get("campaign", "")).upper().startswith("MESS"):
                mess_ids.setdefault(r["account"], set()).add(r["campaign_id"])
    camp_page = camp_pages(fb, mess_ids, errors)
    bills = billing(fb, errors)
    info = acc_info(fb, errors)
    cfg = env_file(POS_ENV)
    link_names = pos_link_names(cfg)
    src_names = pos_source_names(cfg)
    user_names = pos_user_names(cfg)
    for d in days:
        try:
            out[str(d)]["pos"], out[str(d)]["link"], fbp_ = pos_day(cfg, d, link_names, src_names, user_names)
            if fbp_ is not None:
                out[str(d)]["fbp"] = fbp_
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
    body = json.dumps({"days": out, "billing": bills, "camp_page": camp_page, "acc_info": info}, ensure_ascii=False).encode()
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
