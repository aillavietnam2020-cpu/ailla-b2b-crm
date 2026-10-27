/* =====================================================================
   PHÊ DUYỆT (trang quản trị): hàm thuần gom việc chờ duyệt từ các nguồn đang có + lọc theo quyền người xem.
   Không đụng giao diện, không gọi máy chủ (trang pheduyet.js tải dữ liệu rồi đưa vào đây). Test: tests/unit/pdcalc.test.ts.
   Quyền duyệt lấy ĐÚNG quy tắc máy chủ / trang gốc đang dùng, không đặt quy tắc mới:
     don    yêu cầu duyệt đơn, đổi giá, đổi cấp khách (bảng approvals) · services/approvals.ts: cấp Quản lý → CEO hoặc quản lý;
            cấp CEO → CEO hoặc người có quyền "duyệt ngoại lệ"; ai cũng cần quyền duyệt đơn (order.approve.normal / exception)
    xuat   sửa phiếu xuất kho · services/shipEdits.ts: CEO hoặc order.approve.normal
    dx     đề xuất của agent · máy chủ đã lọc theo người duyệt (services/proposals.ts canReview)
    thuong phiếu quà / phiếu chi thưởng NPP · routes/bonus.ts: CEO hoặc order.approve.normal; phiếu tiền: người lập không tự duyệt (trừ CEO)
    chi    phiếu chi chị Thảo ghi (Sổ chi phí D().pcCho, Chờ phân bổ cũ D().costsCho) · admin hoặc kế toán (order.accounting.confirm)
    thu    phiếu thu chờ xác nhận D().thuCho · như trên
    ns     đơn nghỉ phép / OT / tạm ứng D().hr · nhansu.duyet hoặc nhansu.quanly
    tien   tiền về chờ kế toán xác nhận (payments) · CEO hoặc order.accounting.confirm (POST /api/payments/:id/confirm)
    hoan   hàng trả lại kho đã nhận, chờ kế toán chốt giảm nợ · order.accounting.confirm (POST /api/returns/:id/confirm)
   NGƯỠNG CHI PHẢI CEO DUYỆT (chị Hoa chốt 27/10/2026, mặc định 5.000.000đ, đổi ở Ngưỡng cảnh báo; cùng quy tắc src/shared/ceoSpend.ts):
    khoản chi từ ngưỡng mà người duyệt/lập không phải CEO thì chờ CEO. Dòng "chờ CEO" chỉ CEO thấy; người duyệt trước không thấy lại.
   ===================================================================== */
const PD_KINDS=[["chi","Phiếu chi"],["thuong","Thưởng NPP"],["tien","Tiền về"],["thu","Phiếu thu"],["hoan","Hàng trả lại"],["don","Đơn & giá Kênh phân phối"],["xuat","Sửa phiếu xuất kho"],["dx","Đề xuất của agent"],["ns","Nhân sự"]];
/* Khoản chi này có phải chờ CEO duyệt không (giống needsCeo ở máy chủ). Ngưỡng 0 = tắt. */
const pdNeedCeo=(amount,th,isCeo)=>!isCeo&&th>0&&amount>=th;
const PD_KIND_N=k=>(PD_KINDS.find(x=>x[0]===k)||[k,k])[1];
/* Mốc thời gian (ms) từ số ms, chuỗi ISO / "YYYY-MM-DD HH:MM:SS" của SQLite; không đọc được thì 0. */
function pdTs(v){if(typeof v==="number")return v>0?v:0;if(!v)return 0;const s=String(v).trim(),vn=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(vn){const tm=s.match(/(\d{1,2}):(\d{2})/)||[0,0,0];return Date.UTC(+vn[3],+vn[2]-1,+vn[1],+tm[1]-7,+tm[2])}
  const t=Date.parse(/^\d{4}-\d{2}-\d{2} \d/.test(s)?s.replace(" ","T")+(/[zZ+]/.test(s.slice(10))?"":"Z"):s);return isNaN(t)?0:t}
/* "Chờ bao lâu" bằng lời: 25 phút, 3 giờ, 2 ngày. */
function pdAge(at,now){if(!at)return "";const m=Math.max(0,Math.floor(((now||Date.now())-at)/60000));if(m<60)return Math.max(1,m)+" phút";const h=Math.floor(m/60);if(h<24)return h+" giờ";return Math.floor(h/24)+" ngày"}
/* Quyền của người xem. w = {role: vai CRM CEO|MANAGER|EMPLOYEE, uid, perms: quyền máy chủ, admin: tài khoản admin trang hub, ns: quyền duyệt nhân sự}. */
function pdRights(w){
  const P=n=>(w.perms||[]).includes(n),ceo=w.role==="CEO",apN=P("order.approve.normal"),apX=P("order.approve.exception");
  return {
    don:a=>(apN||apX)&&(a.required_role==="CEO"?ceo||apX:ceo||w.role==="MANAGER"),
    xuat:()=>ceo||apN,
    thuong:v=>(ceo||apN)&&!(v&&v.cash&&v.created_by&&v.created_by===w.uid&&!ceo),
    ketoan:()=>!!w.admin||P("order.accounting.confirm"),
    tien:()=>ceo||P("order.accounting.confirm"),
    hoan:()=>P("order.accounting.confirm"),
    ceo:()=>ceo,
    ns:()=>!!w.ns};
}
const pdItems=v=>{try{const L=typeof v==="string"?JSON.parse(v):v;return Array.isArray(L)?L.map(x=>(x.name||x.item||"")+(x.qty?" × "+x.qty:"")).filter(Boolean).join(", "):""}catch(e){return ""}};
const pdApLoai=a=>a.rule_code==="PRICE_VERSION"?"Đổi giá":a.entity_type==="CUSTOMER_TIER"||a.rule_code==="TIER_CHANGE"?"Đổi cấp khách":"Đơn hàng";
/* Gom mọi nguồn thành một danh sách dòng, chỉ giữ dòng người xem duyệt được. Chờ lâu nhất lên đầu.
   Mỗi dòng: {k, id, loai, nd, sub, tien, by, at, act, open}. act: "api" (gọi API duyệt của loại đó), "fn" (hàm duyệt của trang gốc), "" (chỉ mở trang gốc). */
function pdBuild(S,w){
  const R=pdRights(w||{}),L=[],add=r=>L.push({tien:null,sub:"",by:"",at:0,act:"",...r}),th=S.th==null?5e6:+S.th,ceo=R.ceo();
  const len=t=>pdNeedCeo(+t||0,th,ceo)?" · từ ngưỡng, duyệt xong chuyển CEO":"";
  (S.approvals||[]).filter(a=>(!a.status||a.status==="PENDING")&&R.don(a)).forEach(a=>add({k:"don",id:"ap:"+a.id,ref:a.id,src:"approval",loai:pdApLoai(a)+(a.required_role==="CEO"?" · CEO duyệt":""),
    nd:a.entity_label||String(a.entity_id||"").slice(0,8),sub:a.reason||"",tien:a.entity_type==="ORDER"&&+a.order_total>0?+a.order_total:null,by:a.requester_name||"",at:pdTs(a.created_at),act:"api",
    open:a.entity_type==="ORDER"?{page:"cr_dn",path:"/admin/orders/"+a.entity_id}:a.entity_type==="CUSTOMER_TIER"?{page:"cr_kh",path:"/admin/customers/"+a.entity_id}:{page:"cr_dn",path:"/admin/orders"}}));
  if(R.xuat())(S.shipEdits||[]).filter(e=>!e.status||e.status==="CHO_DUYET").forEach(e=>add({k:"xuat",id:"se:"+e.id,ref:e.id,src:"shipEdit",loai:"Sửa phiếu xuất",
    nd:[e.order_no,e.customer_name].filter(Boolean).join(" · "),sub:e.reason||"",by:e.requested_by_name||"",at:pdTs(e.requested_at),act:"api",open:{page:"cr_dn",path:"/admin/orders/"+e.order_id}}));
  (S.proposals||[]).filter(p=>!p.status||p.status==="PENDING").forEach(p=>add({k:"dx",id:"dx:"+p.id,ref:p.id,src:"proposal",loai:"Đề xuất agent",
    nd:p.title||"",sub:[p.entity_label,p.body].filter(Boolean).join(" · "),by:p.agent_name||"Agent",at:pdTs(p.created_at),act:"api",
    open:p.entity_type==="ORDER"&&p.entity_id?{page:"cr_dn",path:"/admin/orders/"+p.entity_id}:{page:"cr_dn",path:"/admin/orders"}}));
  (S.gifts||[]).filter(g=>g.status==="CHO_DUYET"&&R.thuong(g)).forEach(g=>add({k:"thuong",id:"gi:"+g.id,ref:g.id,src:"gift",loai:"Phiếu quà thưởng",
    nd:[g.voucher_no,g.customer_name].filter(Boolean).join(" · "),sub:[g.level_label,pdItems(g.items),g.month?"tháng "+g.month:""].filter(Boolean).join(" · "),at:pdTs(g.created_at),act:"api",open:{page:"cr_thuong",path:"/admin/bonus"}}));
  (S.cash||[]).filter(v=>v.status==="CHO_DUYET"&&R.thuong({...v,cash:true})&&(v.ceo_status!=="CHO"||ceo)).forEach(v=>add({k:"thuong",id:"ca:"+v.id,ref:v.id,src:"cash",loai:v.ceo_status==="CHO"?"Phiếu chi thưởng · chờ CEO":"Phiếu chi thưởng"+len(v.amount),ceoCho:v.ceo_status==="CHO",
    nd:[v.voucher_no,v.customer_name].filter(Boolean).join(" · "),sub:[v.note,v.month?"tháng "+v.month:""].filter(Boolean).join(" · "),tien:+v.amount||0,by:v.created_by_name||"",at:pdTs(v.created_at),act:"api",open:{page:"cr_thuong",path:"/admin/bonus"}}));
  if(R.ketoan()){
    (S.pcCho||[]).filter(x=>!x.ceoCho||ceo).forEach(x=>add({k:"chi",id:"pc:"+x.id,ref:x.id,src:"pcCho",loai:x.ceoCho?"Phiếu chi · chờ CEO"+(x.ktDuyet?" (đã qua "+x.ktDuyet+")":""):"Phiếu chi"+len(x.t),ceoCho:!!x.ceoCho,nd:x.dg||"",sub:[x.ct,x.k&&x.k!=="Chờ xác định"?"bổ vào "+x.k:""].filter(Boolean).join(" · "),tien:+x.t||0,by:x.by||x.dn||"",at:pdTs(x.at||x.d),act:"fn",open:{page:"so_cp"}}));
    (S.costsCho||[]).forEach(x=>add({k:"chi",id:"cp:"+x.id,ref:x.id,src:"costsCho",loai:"Chi phí chờ phân bổ",nd:x.note||"",sub:(x.de&&x.de.ly)||"",tien:+x.tien||0,by:x.by||"",at:pdTs(x.at||x.ngay),act:x.de&&x.de.chac&&x.de.cat!=="CHUA-ROAT"&&!pdNeedCeo(+x.tien||0,th,ceo)?"fn":"",open:{page:"cp_duyet"}}));
    (S.thuCho||[]).forEach(x=>add({k:"thu",id:"th:"+x.id,ref:x.id,src:"thuCho",loai:"Phiếu thu chờ xác nhận",nd:x.note||"",sub:x.acct||"",tien:+x.tien||0,by:x.by||"",at:pdTs(x.at||x.ngay),act:"fn",ok:"Xác nhận",open:{page:"cp_duyet"}}));
  }
  /* Phiếu chi vận chuyển, phiếu chi nhà cung cấp từ ngưỡng: tiền đã chi, chờ CEO duyệt (máy chủ chỉ trả cho CEO). */
  if(ceo)(S.ceoSpend||[]).forEach(x=>add({k:"chi",id:"cs:"+x.kind+":"+x.id,ref:x.id,src:"ceo_"+x.kind,loai:(x.kind==="ship"?"Phiếu chi vận chuyển":"Phiếu chi nhà cung cấp")+" · chờ CEO",ceoCho:true,
    nd:[x.no,x.title].filter(Boolean).join(" · "),sub:[x.day,x.sub].filter(Boolean).join(" · "),tien:+x.amount||0,by:x.created_by_name||"",at:pdTs(x.created_at),act:"api",
    open:x.kind==="ship"?{page:"cr_vc",path:"/admin/shipping-vouchers"}:{page:"mh_chi"}}));
  if(R.tien())(S.payConfirm||[]).forEach(x=>add({k:"tien",id:"pm:"+x.id,ref:x.id,src:"payment",loai:"Tiền về chờ xác nhận",ok:"Xác nhận",
    nd:x.customer_name||"",sub:[x.day,x.method==="TIEN_MAT"?"tiền mặt":x.method==="CHUYEN_KHOAN"?"chuyển khoản":x.method,x.bank_ref,x.bill_order_no?"đơn "+x.bill_order_no:"",x.note].filter(Boolean).join(" · "),
    tien:+x.amount||0,by:x.entered_by||"",at:pdTs(x.entered_at||x.day),act:"api",open:{page:"cr_bill",path:"/admin/bills"}}));
  if(R.hoan())(S.returns||[]).filter(x=>!x.status||x.status==="DA_NHAN_KHO").forEach(x=>add({k:"hoan",id:"rt:"+x.id,ref:x.id,src:"return",loai:"Hàng trả lại · chờ chốt giảm nợ",ok:"Xác nhận",
    nd:[x.return_no,x.customer_name].filter(Boolean).join(" · "),sub:[x.order_no?"đơn "+x.order_no:"",x.reason].filter(Boolean).join(" · "),tien:+x.credit_amount||0,by:x.created_by_name||"",at:pdTs(x.kho_at||x.created_at),act:"api",open:{page:"cr_ret",path:"/admin/returns"}}));
  if(R.ns()){
    const ten=S.staffName||(m=>m);
    (S.hrDon||[]).filter(x=>x.tt==="cho").forEach(x=>add({k:"ns",id:"dn:"+x.id,ref:x.id,src:"hrDon",loai:x.loai||"Đơn nhân sự",nd:ten(x.ma),sub:[x.tu&&x.den&&x.den!==x.tu?x.tu+" → "+x.den:x.tu,x.ly].filter(Boolean).join(" · "),
      tien:x.loai==="Tạm ứng lương"?+x.sl||0:null,by:x.by||"",at:pdTs(x.at||x.gui),act:"",open:{page:"hr_nghi"}}));
    (S.hrTu||[]).filter(x=>x.tt==="cho").forEach(x=>add({k:"ns",id:"tu:"+x.id,ref:x.id,src:"hrTu",loai:"Tạm ứng lương",nd:ten(x.ma),sub:x.lyDo||"",tien:+x.tien||0,at:pdTs(x.ngay),act:"",open:{page:"hr_nghi"}}));
  }
  return L.sort((a,b)=>(a.at||Infinity)-(b.at||Infinity));
}
/* Lọc theo loại ("" = tất cả) và đếm từng loại để hiện ở nút lọc. */
const pdFilter=(rows,k)=>k?rows.filter(r=>r.k===k):rows;
function pdCounts(rows){const c={};rows.forEach(r=>{c[r.k]=(c[r.k]||0)+1});return c}
