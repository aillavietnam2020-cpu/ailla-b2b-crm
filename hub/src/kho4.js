/* =====================================================================
   KHO VẬT TƯ (phần 4): IN PHIẾU SẢN XUẤT (A4, logo Ailla, bảng kẻ tô màu).
   Phiếu sản xuất là LỆNH, không cộng trừ kho. Bản in kèm bảng vật tư cần dùng theo định mức để xưởng, kỹ thuật, thủ kho đối chiếu.
   Nạp SAU sanxuat.js, kho.js, kho2.js, kho3.js.
   ===================================================================== */
/* In: thử mở cửa sổ mới; nếu trình duyệt chặn cửa sổ bật lên thì in ngay trong trang (khung ẩn). Trả về đối tượng giống cửa sổ để dùng chung. */
function khoShowPrint(html){
  const w=window.open("","_blank");
  if(w){w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);return}
  const old=document.getElementById("khoprintfr");if(old)old.remove();
  const f=document.createElement("iframe");f.id="khoprintfr";f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  f.onload=()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast("Chưa in được, thử bấm lại")}};
  document.body.appendChild(f);f.srcdoc=html;
}
function khoPrintWin(){let buf="";return {document:{write:h=>{buf+=h},close:()=>khoShowPrint(buf)},focus(){},print(){}}}
function khoPsxNeeds(r){
  const misa=typeof khoMisaOf==="function"?khoMisaOf(r.sp):r.sp,B=(misa&&KHO.bom.get(misa))||[];
  const sl=+r.sl||0,perUnit=!sl;
  const nm=c=>KHO.items.get(c)||{name:c,unit:"",cls:""};
  // 1) vật tư đóng gói + bán thành phẩm cho thành phẩm
  const pack=B.map(b=>({code:b.item,name:nm(b.item).name,unit:nm(b.item).unit,cls:nm(b.item).cls,kind:b.kind,dm:b.qty,need:sl?Math.round(b.qty*sl*1000)/1000:null}));
  // 2) nguyên liệu pha chế cho từng bán thành phẩm
  const mix=[];
  pack.filter(p=>p.cls==="BTP").forEach(bt=>{
    (KHO.bom.get(bt.code)||[]).forEach(b=>mix.push({btp:bt.code,btpName:bt.name,code:b.item,name:nm(b.item).name,unit:nm(b.item).unit,dm:b.qty,need:bt.need!=null?Math.round(b.qty*bt.need*1000)/1000:null}));
  });
  return {misa,pack,mix,perUnit};
}
function khoPrintPsx(id){
  const r=(SX().requests||[]).find(x=>x.id===id);if(!r)return;
  if(!KHO.cat){toast("Đang tải danh mục kho, thử lại sau vài giây");khoLoad();return}
  const {misa,pack,mix,perUnit}=khoPsxNeeds(r),p=sxP(r.sp),fmt=n=>n==null?"—":knum(n);
  const meta=[["Số phiếu",r.id],["Ngày tạo phiếu",kDd(r.taoLuc)],["Sản phẩm",p.ten+(misa?" ("+misa+")":"")],["Số lượng yêu cầu",r.sl?knum(r.sl)+" "+(p.dvt&&p.dvt!=="sp"?p.dvt:""):"Chưa chốt"],
    ["Lý do sản xuất",r.nguon||"—"],["Ưu tiên",r.uu||"—"],["Hạn cần hàng",r.han?kDd(r.han):"—"],["Người tạo phiếu",r.tao||"—"]];
  const th=a=>"<tr>"+a.map(c=>"<th>"+c+"</th>").join("")+"</tr>";
  const t1=pack.length?"<h3>1. Vật tư theo định mức"+(perUnit?" (cho 1 đơn vị sản phẩm)":"")+"</h3><table><thead>"+th(["STT","Mã","Tên vật tư","ĐVT","Định mức / 1 sp",perUnit?"Cần dùng":"Tổng cần dùng","Loại"])+"</thead><tbody>"+
    pack.map((x,i)=>"<tr><td class=\"c\">"+(i+1)+"</td><td>"+esc(x.code)+"</td><td>"+esc(x.name)+"</td><td>"+esc(x.unit)+"</td><td class=\"n\">"+fmt(x.dm)+"</td><td class=\"n\"><b>"+fmt(perUnit?x.dm:x.need)+"</b></td><td>"+esc(x.kind||"")+"</td></tr>").join("")+"</tbody></table>":
    "<div class=\"note\">Sản phẩm này chưa có định mức trong danh mục kho"+(misa?"":" (chưa nối mã MISA)")+", nên chưa liệt kê được vật tư.</div>";
  const t2=mix.length?"<h3>2. Nguyên liệu pha chế bán thành phẩm"+(perUnit?" (cho 1 lít)":"")+"</h3><table><thead>"+th(["STT","Mã","Tên nguyên liệu","ĐVT","Định mức / 1 lít","Cần dùng","Bán thành phẩm","Thực tế ghi tay"])+"</thead><tbody>"+
    mix.map((x,i)=>"<tr><td class=\"c\">"+(i+1)+"</td><td>"+esc(x.code)+"</td><td>"+esc(x.name)+"</td><td>"+esc(x.unit)+"</td><td class=\"n\">"+fmt(x.dm)+"</td><td class=\"n\"><b>"+fmt(perUnit?x.dm:x.need)+"</b></td><td>"+esc(x.btp)+"</td><td class=\"fill\"></td></tr>").join("")+"</tbody></table>":"";
  const w=khoPrintWin();
  w.document.write("<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><title>"+esc(r.id)+"</title><style>"+
  "@page{size:A4 portrait;margin:12mm 12mm 14mm}*{box-sizing:border-box}body{font:12.5px/1.45 'Segoe UI',Arial,sans-serif;color:#1d2433;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}"+
  "@media screen{html{background:#dfe4f3}body{max-width:210mm;margin:12px auto;padding:12mm;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)}}@media print{body{max-width:none;padding:0;margin:0}}"+
  ".top{display:flex;align-items:center;gap:14px;border-bottom:3px solid #2b3a8c;padding-bottom:10px}.top img{height:54px}.co{flex:1}.co b{display:block;font-size:13px;color:#2b3a8c}.co span{font-size:11px;color:#667085}.no{text-align:right}.no b{display:block;font-size:15px;color:#e7357b}.no span{font-size:11px;color:#667085}"+
  "h1{margin:14px 0 10px;text-align:center;font-size:21px;letter-spacing:.8px;color:#2b3a8c;text-transform:uppercase}h3{margin:14px 0 6px;font-size:13px;color:#2b3a8c}"+
  ".meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c9d1ea;border-radius:8px;overflow:hidden;margin-bottom:8px}.meta div{padding:6px 12px;border-bottom:1px solid #e4e8f5;display:flex;gap:8px}.meta div:nth-child(4n+1),.meta div:nth-child(4n+2){background:#f5f7ff}.meta label{color:#667085;min-width:120px}"+
  "table{width:100%;border-collapse:collapse}th{background:#2b3a8c;color:#fff;font-weight:600;padding:6px 8px;border:1px solid #2b3a8c;font-size:12px;text-align:left}td{padding:5px 8px;border:1px solid #c9d1ea;vertical-align:top}tbody tr:nth-child(even) td{background:#f5f7ff}td.n{text-align:right}td.c{text-align:center;width:34px}td.fill{background:#fffbe0!important;min-width:70px}tr{page-break-inside:avoid}"+
  ".note{margin-top:10px;padding:8px 12px;border-left:4px solid #e7357b;background:#fff7fb;border-radius:4px}"+
  ".sig{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px;text-align:center;page-break-inside:avoid}.sig div{border-top:2px solid #2b3a8c;padding-top:6px}.sig b{display:block;color:#2b3a8c}.sig span{font-size:11px;color:#667085}"+
  ".foot{margin-top:16px;font-size:10.5px;color:#98a2b3;text-align:center}</style></head><body>"+
  "<div class=\"top\"><img src=\"data:image/png;base64,"+LOGO+"\" alt=\"Ailla\"><div class=\"co\"><b>CÔNG TY CỔ PHẦN THƯƠNG MẠI VÀ XNK AILLA VIỆT NAM</b><span>Phiếu kho – sản xuất nội bộ</span></div><div class=\"no\"><b>"+esc(r.id)+"</b><span>Ngày in: "+kDd(kToday())+"</span></div></div>"+
  "<h1>Phiếu sản xuất</h1><div class=\"meta\">"+meta.map(([a,b])=>"<div><label>"+esc(a)+":</label><b>"+esc(String(b))+"</b></div>").join("")+"</div>"+
  (r.ghiChu?"<div class=\"note\"><b>Ghi chú cho xưởng:</b> "+esc(r.ghiChu)+"</div>":"")+t1+t2+
  "<div class=\"note\">Phiếu sản xuất là lệnh giao việc, <b>không trừ hay cộng kho</b>. Kho chỉ thay đổi khi lập phiếu pha chế, phiếu kiểm kê đóng gói.</div>"+
  "<div class=\"sig\">"+["Người tạo phiếu","Quản lý sản xuất","Tổ trưởng xưởng"].map(x=>"<div><b>"+x+"</b><span>(ký, ghi rõ họ tên)</span></div>").join("")+"</div>"+
  "<div class=\"foot\">Phiếu in từ hệ thống quản trị Ailla · "+esc(r.id)+"</div></body></html>");
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}

/* Nút "In phiếu sản xuất" trong chi tiết phiếu */
const khoReqDetailOrig=sxReqDetail;
sxReqDetail=function(id){
  khoReqDetailOrig(id);
  const dr=$("#drawerIn");if(!dr)return;
  const b=document.createElement("button");b.className="btn";b.id="rq-print";b.textContent="In phiếu sản xuất";b.style.margin="4px 0 10px";
  b.onclick=()=>khoPrintPsx(id);
  const head=dr.querySelector("p.mono");if(head)head.after(b);else dr.appendChild(b);
  khoLoad();
};
