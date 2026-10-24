/* =====================================================================
   PHÒNG ĐIỀU HÀNH: hàm tính thuần (không đụng giao diện), chị Hoa duyệt 24/10/2026.
   - Giá thành quản trị = theo giá nhập nguyên liệu MỚI NHẤT (để báo giá, quyết định bán);
     giá thành kế toán = theo giá BÌNH QUÂN (lên sổ). Giá nguyên liệu tăng quá ngưỡng thì báo, kéo theo giá bán / báo giá lỗ.
   - Tiền đủ chạy bao nhiêu ngày, lãi tạm tính hằng ngày, lãi theo kênh 3 tầng (chia lương, đóng gói, chi phí chung).
   ===================================================================== */
const DH_CH=[["tts","TikTok Shop"],["spe","Shopee"],["fb","Facebook"],["b2b","B2B / NPP"],["gc","Gia công"]];
const DH_CFG0=()=>({
  nguong:{nvlTang:0.05,bienTier:0.25,bienGC:0.15,runway:30,bienKenh:0.185},
  kenh:{tts:{thuan:0.9,gv:0.19,phi:0.3,dongGoi:0},spe:{thuan:0.9,gv:0.2,phi:0.25,dongGoi:0},fb:{thuan:0.85,gv:0.2,phi:0,dongGoi:0}},
  luong:[],chiNgay:0,tien:[]});
/* Gộp thiết lập đã lưu với mặc định (thiếu khoá nào thì lấy mặc định). */
function dhCfg(saved){const d=DH_CFG0(),s=saved||{};return {nguong:{...d.nguong,...(s.nguong||{})},kenh:Object.fromEntries(Object.keys(d.kenh).map(k=>[k,{...d.kenh[k],...((s.kenh||{})[k]||{})}])),luong:Array.isArray(s.luong)?s.luong:[],chiNgay:+s.chiNgay||0,tien:Array.isArray(s.tien)?s.tien:[]}}

/* ---------- Giá nguyên liệu ----------
   cur, prev: dòng "Giá nguyên vật liệu theo tháng" của tháng này và tháng trước
   ({item,name,unit,last_price,avg_price,in_qty,open_price}). Mức tăng = giá nhập mới nhất so với giá mới nhất tháng trước
   (chưa có tháng trước thì so với giá tồn đầu tháng). Chênh bình quân = giá mới so với giá bình quân kế toán. */
function dhNvl(cur,prev,thr){
  const pv=new Map((prev||[]).map(r=>[r.item,r]));
  return (cur||[]).filter(r=>r.last_price>0).map(r=>{const p=pv.get(r.item),base=p&&p.last_price>0?p.last_price:(r.open_price>0?r.open_price:0);
    const chg=base?(r.last_price-base)/base:0,gap=r.avg_price>0?(r.last_price-r.avg_price)/r.avg_price:0;
    return {item:r.item,name:r.name||r.item,unit:r.unit||"",last:r.last_price,base,avg:r.avg_price||r.last_price,chg,gap,up:chg>=thr}})
   .sort((a,b)=>b.chg-a.chg);
}
/* ---------- Giá thành theo định mức (bóc nhiều bậc) ----------
   bom: Map(mã sản phẩm → [{item, qty}]); price(mã) → giá 1 đơn vị hoặc null khi chưa có giá. */
function dhCost(code,bom,price,memo,path){
  memo=memo||new Map();path=path||[];if(memo.has(code))return memo.get(code);
  const B=bom.get(code)||[];let r;
  if(B.length&&!path.includes(code)){let cost=0;const miss=new Set();B.forEach(b=>{const c=dhCost(b.item,bom,price,memo,path.concat(code));cost+=(+b.qty||0)*c.cost;c.miss.forEach(x=>miss.add(x))});r={cost,miss:[...miss]}}
  else{const v=price(code);r=v>0?{cost:v,miss:[]}:{cost:0,miss:[code]}}
  memo.set(code,r);return r;
}
/* Giá thành từng sản phẩm có định mức: theo giá mới nhất và theo bình quân. */
function dhGiaThanh(codes,bom,pNew,pAvg){
  const m1=new Map(),m2=new Map();
  return codes.map(code=>{const a=dhCost(code,bom,pNew,m1),b=dhCost(code,bom,pAvg,m2);return {code,moi:a.cost,bq:b.cost,chenh:b.cost?(a.cost-b.cost)/b.cost:0,miss:a.miss}});
}
/* ---------- So giá bán với giá thành mới ----------
   lines: [{kind:"tier"|"kh", who, sku, name, price}] theo đơn vị bán trong CRM; map: crm_sku → {misa_code, factor}.
   costOf(mã kho) → {moi, miss}. Ngưỡng biên: bảng giá cấp = bienTier, giá riêng khách (gia công) = bienGC. */
function dhSellCheck(lines,map,costOf,ng){
  return lines.map(l=>{const mp=map.get(String(l.sku).toLowerCase());if(!mp)return {...l,code:"",why:"Chưa nối mã kho (Đồng bộ mã B2B)"};
    const g=costOf(mp.misa_code);if(!g)return {...l,code:mp.misa_code,why:"Mã chưa có định mức"};
    const f=+mp.factor||1,cost=g.moi*f,thr=l.kind==="kh"?ng.bienGC:ng.bienTier,bien=l.price?(l.price-cost)/l.price:0;
    if(g.miss.length)return {...l,code:mp.misa_code,cost,why:"Thiếu giá: "+g.miss.slice(0,4).join(", ")+(g.miss.length>4?"…":"")};
    return {...l,code:mp.misa_code,cost,bien,thr,min:Math.ceil(cost/(1-thr)/100)*100,red:bien<thr,lo:l.price<cost}})
   .sort((a,b)=>(a.why?1:0)-(b.why?1:0)||(a.bien??9)-(b.bien??9));
}
/* ---------- Tiền đủ chạy bao lâu ----------
   tien: số đang có (ngân hàng + tiền mặt), vi: tiền trên ví sàn, thu: khách nợ trong hạn, tra: phải trả sắp tới hạn, chiNgay: chi trung bình mỗi ngày. */
function dhRunway({tien,vi,thu,tra,chiNgay}){
  const co=(+tien||0)+(+vi||0),ngay=chiNgay>0?Math.floor(co/chiNgay):null,ngay2=chiNgay>0?Math.floor((co+(+thu||0)-(+tra||0))/chiNgay):null;
  return {co,ngay,ngay2};
}
/* ---------- Lãi tạm tính theo kênh trong một khoảng ngày ----------
   x: {ban (doanh số ghi nhận), don, ads (quảng cáo đã chi), gv?, phi?} — gv/phi có số thật thì dùng, không thì theo tỷ lệ của kênh;
   r: {thuan (phần còn lại sau hủy/hoàn), gv, phi, dongGoi (đ/đơn)}; luong: lương kênh gánh trong khoảng ngày. */
function dhTamTinh(x,r,luong){
  const dt=(+x.ban||0)*r.thuan,gv=x.gv!=null?x.gv*r.thuan:dt*r.gv,phi=x.phi!=null?x.phi*r.thuan:dt*r.phi,dg=(+x.don||0)*r.thuan*(+r.dongGoi||0),ads=+x.ads||0;
  const t1=dt-gv-phi,t2=t1-ads-dg-(+luong||0);
  return {dt,gv,phi,ads,dg,luong:+luong||0,t1,t2,bien:dt?t2/dt:0};
}
/* Lương kênh gánh trong n ngày: tổng lương tháng từng team × % gắn kênh, chia 30 ngày. */
function dhLuongKenh(luong,ch,n){return (luong||[]).reduce((a,t)=>a+(+t.tien||0)*((+((t.pt||{})[ch])||0)/100),0)/30*(n||30)}
/* ---------- Lãi theo kênh 3 tầng (một tháng) ----------
   rows: [{ch, dt, lai (lãi đóng góp trước lương, đóng gói), don}]; chung: chi phí dùng chung chia theo tỷ trọng doanh thu. */
function dhBaTang(rows,cfg,chung){
  const T=rows.reduce((a,r)=>a+(+r.dt||0),0);
  return rows.map(r=>{const k=cfg.kenh[r.ch]||{},luong=dhLuongKenh(cfg.luong,r.ch,30),dg=(+r.don||0)*(+k.dongGoi||0),t2=r.lai-luong-dg,pb=T?(chung||0)*(r.dt/T):0;
    return {...r,luong,dg,t2,pb,t3:t2-pb,bien2:r.dt?t2/r.dt:0,bien3:r.dt?(t2-pb)/r.dt:0}});
}
