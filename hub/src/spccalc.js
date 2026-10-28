/* =====================================================================
   SẢN PHẨM & COMBO (Quản trị › Cấu hình, chị Hoa duyệt demo 28/10/2026): hàm thuần, không gọi máy chủ, không vẽ.
   Trang spcombo.js tải dữ liệu rồi đưa vào đây. Test: tests/unit/spccalc.test.ts.
     rows  : dòng bảng quy đổi /api/hub/sanpham/combos {channel, sku, variant, from_day, item_label, qty, kind, note, off_from, updated_at}
     sales : {channel, sku, variant, shop, orders, last_day}
   Giá vốn một combo = Σ giá vốn món × số lượng (sản phẩm + quà; bao bì có giá thì cộng, chưa có giá thì bỏ qua — giống ttMakeCostOf).
   Món sản phẩm / quà chưa có giá → combo "chưa tính được giá vốn", không ước số.
   ===================================================================== */
const SPC_CH=[["FACEBOOK","Facebook"],["SHOPEE","Shopee"],["TIKTOK","TikTok"]];
const SPC_CHN=c=>(SPC_CH.find(x=>x[0]===c)||[c,c])[1];
const SPC_KIND={sp:"Sản phẩm",gift:"Quà tặng",pack:"Bao bì đóng gói",skip:"Bỏ qua (không trừ kho)"};
const spcLow=s=>String(s||"").trim().toLowerCase();
const spcCode=l=>String(l||"").split(" - ")[0].trim();
/* Giá vốn từng mã: giá nhập kho bình quân, Giá vốn SKU (kế toán) đè lên; tháng giá vốn gần nhất không quá kỳ ky. */
function spcGvMap(skus,khoCost,ky){
  const g={};
  (khoCost||[]).forEach(c=>{if(+c.avg>0)g[spcLow(c.item)]={u:+c.avg,src:"Giá nhập kho bình quân"}});
  (skus||[]).forEach(s=>{const G=s.giaVon||{},ms=Object.keys(G).filter(m=>+G[m]>0).sort();if(!ms.length)return;
    const pick=(ky&&ms.filter(m=>m<=ky).pop())||ms[ms.length-1];g[spcLow(s.ma)]={u:+G[pick],src:"Giá vốn SKU "+pick.slice(5)+"/"+pick.slice(0,4)}});
  return g;
}
/* Gom dòng quy đổi thành combo: mỗi (kênh, mã, phân loại) một combo, nhiều bản theo ngày áp dụng; bản hiện hành = bản mới nhất đã tới ngày. */
function spcGroup(rows,sales,today){
  const by=new Map(),day=today||"9999-12-31";
  (rows||[]).forEach(r=>{const k=r.channel+"|"+r.sku+"|"+r.variant;let c=by.get(k);
    if(!c){c={key:k,ch:r.channel,sku:r.sku,variant:r.variant,versions:[],off:"",flag:"",upd:"",orders:0,shops:[],last:""};by.set(k,c)}
    let v=c.versions.find(x=>x.from===(r.from_day||""));if(!v){v={from:r.from_day||"",parts:[]};c.versions.push(v)}
    v.parts.push({label:r.item_label,code:r.code||spcCode(r.item_label),qty:+r.qty||0,kind:r.kind||"sp"});
    if(r.off_from&&(!c.off||r.off_from<c.off))c.off=r.off_from;
    if(/CẦN KẾ TOÁN/.test(r.note||""))c.flag=String(r.note).replace(/^\W*CẦN KẾ TOÁN XÁC NHẬN:\s*/,"");
    if((r.updated_at||"")>c.upd)c.upd=r.updated_at||""});
  const sv=new Map();(sales||[]).forEach(s=>{const k=s.channel+"|"+spcLow(s.sku)+"|"+spcLow(s.variant);const a=sv.get(k)||{orders:0,shops:[],last:""};
    a.orders+=+s.orders||0;if(s.shop&&!a.shops.includes(s.shop))a.shops.push(s.shop);if((s.last_day||"")>a.last)a.last=s.last_day;sv.set(k,a)});
  const ko={sp:0,gift:1,pack:2,skip:3};
  return [...by.values()].map(c=>{c.versions.sort((a,b)=>a.from.localeCompare(b.from));c.versions.forEach(v=>v.parts.sort((a,b)=>(ko[a.kind]??0)-(ko[b.kind]??0)));
    const cur=c.versions.filter(v=>v.from<=day).pop()||c.versions[0];c.cur=cur;c.parts=cur.parts;
    const s=sv.get(c.ch+"|"+spcLow(c.sku)+"|"+spcLow(c.variant));
    if(s){c.orders=s.orders;c.shops=s.shops;c.last=s.last}
    c.active=!c.off||c.off>day;return c});
}
/* Giá vốn một combo theo bảng giá g (spcGvMap). */
function spcCost(parts,g){
  let u=0;const miss=[],detail=[];
  (parts||[]).forEach(p=>{if(p.kind==="skip")return;const c=g[spcLow(p.code)];
    if(c){u+=c.u*p.qty;detail.push({code:p.code,u:c.u,q:p.qty,src:c.src})}else if(p.kind!=="pack")miss.push(p.code)});
  return {u:miss.length?null:u,miss,detail};
}
/* Trạng thái một combo: [màu, chữ]. items = Set mã kho (chữ thường); g = bảng giá (null = người xem không thấy giá vốn). */
function spcStatus(c,items,g){
  if(!c.active)return ["gry","Ngừng dùng từ "+c.off.slice(8,10)+"/"+c.off.slice(5,7)];
  if(c.parts.some(p=>p.kind!=="skip"&&!items.has(spcLow(p.code))))return ["red","Có món chưa có mã kho"];
  if(c.flag)return ["amb","Cần kế toán xác nhận"];
  if(g){const x=spcCost(c.parts,g);if(x.u==null)return ["amb","Thiếu giá vốn "+x.miss.length+" món"]}
  return ["grn","Đủ"];
}
/* Tóm tắt mã chưa quy đổi cho thông báo / Phê duyệt. */
function spcUnSum(un){
  const L=un||[],by={};L.forEach(u=>{by[u.channel]=(by[u.channel]||0)+1});
  return {codes:L.length,orders:L.reduce((s,u)=>s+(+u.orders||0),0),oldest:L.map(u=>u.first_day).filter(Boolean).sort()[0]||"",
    by:SPC_CH.filter(([k])=>by[k]).map(([k,n])=>n+" "+by[k]).join(", ")};
}
/* Gợi ý mã kho từ tên: bỏ dấu, viết hoa, AILLA + chữ đầu mỗi từ, giữ nguyên số (dung tích). */
function spcSuggestCode(name){
  const f=String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toUpperCase();
  const w=f.split(/[^A-Z0-9.]+/).filter(Boolean).filter(x=>x!=="AILLA");
  return ("AILLA"+w.map(x=>/\d/.test(x)?x:x[0]).join("")).slice(0,24);
}
