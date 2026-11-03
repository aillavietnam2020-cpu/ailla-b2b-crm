/* =====================================================================
   SỬA MỘT LẦN (chị Hoa 03/11/2026): 24 video tồn tháng 10 nhập Excel ngày 03/11 bị tạo thành thẻ
   "sản xuất trong tháng 11, đã duyệt, chờ đăng ở TikTok chính" (TT-0767 → TT-0790). Chuyển về Kho video tồn
   với ngày sản xuất thật (20–28/10) và trạng thái duyệt theo file đối chiếu của chị: 7 đã duyệt, 17 chờ Lead duyệt,
   chưa gắn kênh để Lead phân bổ. Chỉ chuyển thẻ chưa ai đụng tới (chưa có ngày đăng, link bài, lịch sử).
   ===================================================================== */
const T10TON={767:"20",768:"23",769:"23",770:"26",771:"26",772:"26",773:"26",774:"26",775:"26",776:"27+",777:"27+",778:"27",779:"27+",780:"27+",781:"27+",782:"27+",783:"27",784:"27",785:"27",786:"28",787:"28",788:"28",789:"28",790:"28+"};
function t10tonFix(){
  const d=typeof D==="function"?D():null;if(!d||d.fixT10ton||typeof ME==="undefined"||!ME)return;
  if(!(ME.role==="admin"||(typeof xvGive==="function"&&xvGive())))return;
  const hit=c=>{const n=+String(c.id||"").replace(/^TT-0*/,"");return /^TT-0\d{3}$/.test(c.id)&&T10TON[n]&&c.nguon==="Nhập Excel hàng loạt"&&c.thang==="2026-11"&&c.step==="dang"&&!c.linkDang&&!+c.day&&!(c.history||[]).length};
  if(!d.cards.some(hit)){DB.mutate(ME.name,"đánh dấu đã kiểm video tồn tháng 10",dt=>{dt.fixT10ton=new Date().toLocaleString("vi-VN")});return}
  let n=0;
  DB.mutate(ME.name,"chuyển 24 video tồn tháng 10 (nhập Excel 03/11) về Kho video tồn",dt=>{
    if(dt.fixT10ton)return;dt.kho=dt.kho||[];
    dt.cards.filter(hit).forEach(c=>{const v=T10TON[+c.id.replace(/^TT-0*/,"")],ok=v.endsWith("+"),ma="KHO-T10-"+c.id.slice(3);
      if(!dt.kho.some(k=>k.ma===ma))dt.kho.push({ma,skuText:sk(c.sku).n,sku:c.sku,nguoi:"",tuyen:"",duyet:ok?"Đã Duyệt":"Chưa duyệt",choDuyet:!ok,link:c.linkFinal||c.linkVideo||"",ten:c.hookText||"",kenhDeXuat:"",lyDo:"Video tồn tháng 10",ghiChu:"Nhập Excel 03/11, chuyển từ "+c.id+" về kho tồn",quyen:"Chưa kiểm",canSua:"Đăng nguyên",trangThai:"Chưa dùng",maDang:"",nguonFile:"Nhập Excel hàng loạt",caption:c.caption||"",ngaySX:"2026-10-"+parseInt(v,10)});
      n++});
    const ids=new Set(dt.cards.filter(hit).map(c=>c.id));dt.cards=dt.cards.filter(c=>!ids.has(c.id));
    dt.fixT10ton=new Date().toLocaleString("vi-VN")});
  if(n){toast("Đã chuyển "+n+" video tồn tháng 10 về Kho video tồn");renderMain()}
}
(function(){
  const _rm=renderMain;renderMain=function(){const r=_rm.apply(this,arguments);try{setTimeout(t10tonFix,0)}catch(e){}return r};
  const _r=render;render=function(){const r=_r.apply(this,arguments);try{setTimeout(t10tonFix,0)}catch(e){}return r};
})();
