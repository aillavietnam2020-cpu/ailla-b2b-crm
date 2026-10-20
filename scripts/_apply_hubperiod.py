import os
b = r'G:\CODE\CRM\ailla-b2b-crm'

def rw(rel, pairs):
    p = os.path.join(b, rel)
    s = open(p, encoding='utf-8').read()
    for a, n in pairs:
        assert a in s, (rel, a[:90])
        s = s.replace(a, n, 1)
    open(p, 'w', encoding='utf-8').write(s)

# ---- Kho: Nhập – xuất – tồn và Chênh lệch theo bộ chọn thời gian trên cùng ----
rw(r'hub\src\kho.js', [
    ("const kMonth=()=>{const t=kToday();return {from:t.slice(0,8)+\"01\",to:t}};",
     "const kMonth=()=>{const t=kToday();return {from:t.slice(0,8)+\"01\",to:t}};\n"
     "/* Kỳ xem số liệu kho: theo bộ chọn thời gian ở thanh trên cùng, không có ô chọn ngày riêng. */\n"
     "const kPer=()=>typeof PERIOD!==\"undefined\"&&PERIOD&&PERIOD.from&&PERIOD.to?{from:PERIOD.from,to:PERIOD.to}:kMonth();\n"
     "const kPerLabel=P=>kDd(P.from)+(P.from===P.to?\"\":\" – \"+kDd(P.to));"),
    ("async function khoLoadNxt(){const P=KHO.period||(KHO.period=kMonth());KHO.nxt={busy:true,rows:null};",
     "async function khoLoadNxt(){const P=kPer();KHO.nxtKey=P.from+\"|\"+P.to;KHO.nxt={busy:true,rows:null};"),
    ("  const P=KHO.period||(KHO.period=kMonth());if(!KHO.nxt)khoLoadNxt();const R=(KHO.nxt&&KHO.nxt.rows)||null;",
     "  const P=kPer();if(!KHO.nxt||KHO.nxtKey!==P.from+\"|\"+P.to)khoLoadNxt();const R=(KHO.nxt&&KHO.nxt.rows)||null;"),
    ("Tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, theo từng mã. Chọn kỳ rồi bấm Xem.\",`<section class=\"card flush\"><div class=\"card-h pad\"><div class=\"filters\"><label class=\"inl\">Từ <input type=\"date\" id=\"nx-f\" value=\"${P.from}\"></label><label class=\"inl\">Đến <input type=\"date\" id=\"nx-t\" value=\"${P.to}\"></label><button class=\"btn\" id=\"nx-go\">Xem</button></div><button class=\"btn\" id=\"nx-x\">Tải Excel</button></div>",
     "Tồn đầu kỳ + nhập − xuất = tồn cuối kỳ, theo từng mã. Kỳ lấy theo bộ chọn thời gian ở trên cùng.\",`<section class=\"card flush\"><div class=\"card-h pad\"><div class=\"filters\"><b>Kỳ: ${kPerLabel(P)}</b></div><button class=\"btn\" id=\"nx-x\">Tải Excel</button></div>"),
    ("  if($(\"#nx-go\"))$(\"#nx-go\").onclick=()=>{KHO.period={from:$(\"#nx-f\").value,to:$(\"#nx-t\").value};khoLoadNxt();renderMain()};\n", ""),
    ("async function khoLoadCl(){const P=KHO.period||(KHO.period=kMonth());KHO.cl={busy:true};",
     "async function khoLoadCl(){const P=kPer();KHO.clKey=P.from+\"|\"+P.to;KHO.cl={busy:true};"),
    ("  const P=KHO.period||(KHO.period=kMonth());if(!KHO.cl)khoLoadCl();const V=KHO.cl&&KHO.cl.v",
     "  const P=kPer();if(!KHO.cl||KHO.clKey!==P.from+\"|\"+P.to)khoLoadCl();const V=KHO.cl&&KHO.cl.v"),
    ("<div class=\"filters\"><label class=\"inl\">Từ <input type=\"date\" id=\"cl-f\" value=\"${P.from}\"></label><label class=\"inl\">Đến <input type=\"date\" id=\"cl-t\" value=\"${P.to}\"></label><button class=\"btn\" id=\"cl-go\">Xem</button></div></div>",
     "<div class=\"filters\"><b>Kỳ: ${kPerLabel(P)}</b></div></div>"),
    ("  if($(\"#cl-go\"))$(\"#cl-go\").onclick=()=>{KHO.period={from:$(\"#cl-f\").value,to:$(\"#cl-t\").value};KHO.nxt=null;khoLoadCl();renderMain()};\n", ""),
])

# ---- Nhân sự: kỳ lương theo tháng của bộ chọn thời gian ----
rw(r'hub\src\hr.js', [
    ("function monthSel(id){return `<label class=\"inl\">Kỳ lương <input type=\"month\" id=\"${id}\" value=\"${HRM}\"></label>`}",
     "/* Kỳ lương / chấm công = tháng của bộ chọn thời gian ở thanh trên cùng (không còn ô chọn tháng riêng). */\n"
     "const hrmFromPeriod=()=>typeof PERIOD!==\"undefined\"&&PERIOD&&PERIOD.to?PERIOD.to.slice(0,7):HRM;\n"
     "function monthSel(id){return `<b id=\"${id}\">Kỳ: ${HRM.slice(5)}/${HRM.slice(0,4)}</b>`}"),
    ("  const h=HRD(),P=payPeriod(HRM),cs=csOf(HRM)", "  HRM=hrmFromPeriod();const h=HRD(),P=payPeriod(HRM),cs=csOf(HRM)"),
    ("  $(\"#bl-m\").onchange=e=>{HRM=e.target.value||HRM;renderMain()};\n", ""),
    ("  $(\"#cc-m\").onchange=e=>{HRM=e.target.value||HRM;renderMain()};\n", ""),
])
print('ok')
