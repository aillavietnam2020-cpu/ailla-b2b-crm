/* =====================================================================
   KẾ HOẠCH THÁNG — 3 tab thay cho 6 bước cố định:
   ① Mục tiêu tháng (hướng + chỉ tiêu sản phẩm, KPI, ghi chú tháng)
   ② Dự án (ra mắt sản phẩm, khuyến mãi, thử nghiệm… theo dõi tiến độ)
   ③ Kế hoạch triển khai (chọn kênh, mục tiêu, tuyến, giao người)
   Research không còn là bước bắt buộc: nút "Research" ở góc phải, mở khi cần.
   ===================================================================== */
const KH_TABS=[["mt","Mục tiêu tháng"],["da","Dự án"],["tk","Kế hoạch triển khai"]];
let KH_TAB="mt";
function khGhiChu(m){
  const ed=can(ME,"kehoach.sua");
  m.innerHTML=`<section class="card"><div class="card-h"><h2>Ghi chú tháng</h2><span class="hint">${ed?"Gõ trực tiếp, bấm ra ngoài là tự lưu":"Chỉ xem"}</span></div>
   <div class="grid cols3">${[["nhanDinh","Tháng trước làm tốt / chưa tốt điều gì"],["vanDe","Vấn đề phải giải quyết tháng này"],["nguonLuc","Nguồn lực thay đổi (người, ngân sách, video tồn…)"]].map(([k,l])=>`<label class="field">${l}<textarea rows="4" data-n1="${k}" ${ed?"":"disabled"}>${esc((D().plan.notes1||{})[k]||"")}</textarea></label>`).join("")}</div></section>`;
  m.querySelectorAll("[data-n1]").forEach(t=>t.onchange=()=>{DB.mutate(ME.name,"ghi chú tháng",d=>{d.plan.notes1=d.plan.notes1||{};d.plan.notes1[t.dataset.n1]=t.value});toast("Đã lưu")});
}
let KH_CNT={};
const KH_STEPS=[["tuan","① Kế hoạch"],["pc","② Điều phối"],["kho","③ Kho video"],["cal","④ Calendar"]];
function pKeHoachMoi(m){
  if(STEP>=7)KH_TAB="tk";else if(KH_TAB==="tk")KH_TAB="mt";
  LOCK=false;
  const nDa=(D().projects||[]).length;
  m.innerHTML=H("Kế hoạch tháng "+MONTH.mon)+`<div class="tabs khtabs" id="khbar"></div><div id="khb" class="khb"></div>`;
  const b=m.querySelector("#khb");
  if(KH_TAB==="mt"){b.innerHTML=`<div id="khs2"></div><div id="khgc"></div>`;s2(b.querySelector("#khs2"));khGhiChu(b.querySelector("#khgc"))}
  else if(KH_TAB==="da"){pCvDa(b);const ph=b.querySelector(".ph");if(ph)ph.remove();if(!nDa)b.insertAdjacentHTML("afterbegin",`<section class="card"><p class="empty">Chưa có dự án nào. Dự án là một việc lớn có thời hạn: ra mắt sản phẩm mới, khuyến mãi, thử nghiệm kênh… Thêm dự án đầu tiên ở khung bên dưới, rồi gắn việc vào dự án khi tạo việc ở mục Task.</p></section>`)}
  else{s7(b);b.querySelectorAll(".xvtabs [data-xvt]").forEach(x=>{const n=x.querySelector(".xbadge");KH_CNT[x.dataset.xvt]=n?n.textContent:""})}
  /* một hàng tab duy nhất: Mục tiêu · Dự án │ ① ② ③ ④ (các bước triển khai) */
  const tabB=(k,t,on,cnt)=>`<button type="button" data-kht="${k}" class="${on?"on":""}">${t}${cnt?` <span class="cnt">${cnt}</span>`:""}</button>`;
  const xv=typeof XV!=="undefined"?XV.tab:"tuan";
  $("#khbar").innerHTML=tabB("mt","Mục tiêu tháng",KH_TAB==="mt","")+tabB("da","Dự án",KH_TAB==="da",nDa||"")+`<i class="khsep"></i>`+KH_STEPS.map(([k,t])=>`<button type="button" data-khs="${k}" class="${KH_TAB==="tk"&&xv===k?"on":""}">${t}${KH_CNT[k]?` <span class="cnt">${KH_CNT[k]}</span>`:""}</button>`).join("")+`<span class="sp"></span><button type="button" class="btn sm" data-go="research" data-sub="q">Research</button>`;
  m.querySelectorAll("[data-kht]").forEach(x=>x.onclick=()=>{KH_TAB=x.dataset.kht;STEP=2;renderMain()});
  m.querySelectorAll("[data-khs]").forEach(x=>x.onclick=()=>{KH_TAB="tk";STEP=7;XV.tab=x.dataset.khs;XV.sel.clear();renderMain()});
  bindCommon(m);
}
PAGES.kehoach=pKeHoachMoi;
