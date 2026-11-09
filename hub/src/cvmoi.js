/* =====================================================================
   CÔNG VIỆC — BỐ CỤC MỚI (chị Hoa duyệt bản demo 04/11/2026, giai đoạn 1)
   5 mục ở thanh bên: Tổng quan · Việc của tôi · Phòng ban · Dự án · Nhật ký (nhân sự không quản lý: không có Phòng ban).
   Mỗi trang: tiêu đề + một dòng mô tả, hàng tab ngang bên dưới, rồi nội dung.
   "Kiểu xem" (Danh sách · Bảng · Lịch tháng · Tuần · Ngày theo giờ · Ưu tiên) ở Việc của tôi và Phòng ban: cùng một bộ việc, trình bày cách khác.
   Dùng lại dữ liệu và thao tác cũ (cvItems, cvAutoMk/cvAutoDg, rvQueue, openTask, tkSetSt, tkApprove, tkReturn).
   Giai đoạn 2 (04/11): người theo dõi riêng (t.theoDoi, chỉ được báo, không tính là việc của mình), giờ làm (t.gio),
   cờ Gấp (t.gap: tên có "gấp"/"khẩn" tự gắn; kéo ở Ưu tiên để đổi), trạng thái Tạm dừng (pause: vẫn tính trễ nếu quá hạn),
   kéo thả: Ngày theo giờ (xếp giờ), Lịch tháng / Tuần (đổi hạn), Bảng (đổi trạng thái), Ưu tiên (đổi ưu tiên + Gấp),
   Hôm nay › Làm hôm nay (giữ ⋮⋮ kéo xếp thứ tự, lưu theo người ở D().cwOrd[mã người]). Việc video, đơn hàng không kéo được.
   Tên toàn cục trong file này đều bắt đầu bằng "cw" để không trùng file khác.
   ===================================================================== */
const CW_IC={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
 cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
 cc:'<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
 rep:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',chk:'<path d="M20 6 9 17l-5-5"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',kb:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
 mx:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 week:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M7.5 14v4M12 14v4M16.5 14v4"/>',hist:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
 flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',plus:'<path d="M12 5v14M5 12h14"/>',
 srch:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
 alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
 arr:'<path d="m9 18 6-6-6-6"/>',sub:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
 hour:'<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
 up:'<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',task:'<rect x="4" y="3" width="18" height="18" rx="2"/><path d="m8 12 2.5 2.5L16 9"/>',
 fold:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',filter:'<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',video:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
 pin:'<path d="M12 17v5M9 10.8V4h6v6.8l3 3.2H6z"/>',msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
 grip:'<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'};
const cwI=(n,s)=>`<svg class="cwi" viewBox="0 0 24 24"${s?` style="width:${s}px;height:${s}px"`:""} aria-hidden="true">${CW_IC[n]||""}</svg>`;
const CW_CSS=`.cwhd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 4px}.cwht h1{font-size:20px;margin:0;line-height:1.3}.cwht small{color:var(--muted,#6b7385);font-size:13px}
.cwhd>.sp{flex:1}.cwhd>.kdstrip,.cwhd>.odcard{order:9;flex-basis:100%;margin:6px 0 0}
.cwph{margin:0 0 6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cwph h1{margin:0}.cwtop>.cvbar.cwtopbar{margin:0 0 0 auto;padding:0;border:0;background:none;box-shadow:none;flex-wrap:wrap;justify-content:flex-end}.cwtop{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line,#e7e9f0);margin:0 0 12px;flex-wrap:wrap}
.cwtop>.cwtabs{flex:1;min-width:0;border-bottom:0;margin:0}.cwtop>.cwhd{margin:0;flex-wrap:nowrap}.cwtop>.cwhd .btn,.cwtop>.cvbar.cwtopbar .btn,.cwtop>.cvbar.cwtopbar select,.cwtop>.cvbar.cwtopbar input{font:inherit;font-size:13px;font-weight:600;padding:6px 12px;min-height:34px;border-radius:9px;line-height:1.2}.cwtop>.cwhd .btn{display:inline-flex;align-items:center;gap:6px}.cwtop>.cwhd .cwbar{flex-wrap:nowrap;margin:0!important}
.cwtb>.cwbar2{flex-wrap:nowrap;margin-left:4px}.cwtb>.cwbar2 .btn,.cwtb>.cwbar2 button{font:inherit;font-size:13px;font-weight:600;padding:6px 12px;min-height:34px;border-radius:9px;line-height:1.2}.topbar .cwsrch-tb{margin-right:6px}.cwattl{max-height:60vh;overflow:auto;margin:8px 0;border:1px solid var(--line,#e6e8ef);border-radius:10px}.cwatt{display:flex!important;gap:10px;align-items:flex-start;padding:9px 12px;border-bottom:1px solid #f0f1f5;cursor:pointer}.cwatt[hidden]{display:none!important}.cwatt span{display:flex;flex-direction:column}.cwatt small{color:var(--muted,#6b7385);font-size:12px}#cw-attq{width:100%}.cwdasel{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e6e8ef);border-radius:9px;padding:0 4px 0 10px;background:#fff;color:#3a4256}.cwdasel.on{background:#eef0ff;border-color:#c9ccf5;color:var(--pri,#5b50d6)}.cwdasel select{border:0;background:transparent;font:inherit;font-size:13px;font-weight:600;color:inherit;padding:6px 4px;max-width:260px;width:auto}.cwvid{position:fixed;inset:0;background:rgba(15,20,35,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}.cwvidb{background:#fff;border-radius:12px;width:min(480px,100%);height:min(88vh,860px);display:flex;flex-direction:column;overflow:hidden}.cwvidh{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #e6e8ef}.cwvidh b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.cwvidh a{font-size:12.5px;white-space:nowrap}.cwvidv{flex:1;min-height:0;display:flex;background:#000}.cwvidv video,.cwvidv iframe{flex:1;width:100%;height:100%;border:0;background:#000;object-fit:contain}.cwviderr{margin:auto;color:#fff;padding:20px;text-align:center}.cwviderr a{color:#9db4ff}.cwvidf{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #e6e8ef}.cwfixin{flex:1;min-width:0;height:32px;border:1px solid #d5d9e3;border-radius:8px;padding:0 10px;font:inherit;font-size:13px}.cwact .cwfixin{width:100%}.cwsoonh{display:flex;align-items:center;gap:8px;margin:18px 0 8px;font-size:14px;color:#3a4256}.cwsoonh span{font-weight:500;color:var(--muted,#6b7385);font-size:12.5px}.tknhac{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}.tknhac .hint{font-size:12.5px}.tknhac.lt .hint{color:#d93a3a}.cwrvseg{margin:0 0 12px}.cwrv{display:grid;grid-template-columns:118px minmax(0,1fr) 120px 150px 190px;gap:12px;align-items:center;padding:10px 16px;border-top:1px solid #f0f1f5;cursor:pointer}.cwrv:hover{background:#fafbff}.cwrv .tt b{display:block;font-weight:600}.cwrv .tt small,.cwrv .who small{display:block;color:var(--muted,#6b7385);font-size:12px}.cwrv .who{font-size:13px}.cwrv .who .late{color:#d93a3a}.cwrv .mn{font-weight:700;text-align:right}.cwrv .mn.big{color:#d93a3a}.cwrv .ac{display:flex;gap:6px;justify-content:flex-end}.cwrvc{font-size:12px;font-weight:600;border-radius:7px;padding:3px 8px;text-align:center;white-space:nowrap;background:#eef0f5;color:#3a4256}.cwrvc.c-chi{background:#fdeeee;color:#b42323}.cwrvc.c-thu{background:#e7f6ed;color:#1f7a45}.cwrvc.c-tra{background:#fff4e0;color:#a86a12}.cwrvc.c-kho{background:#e8f1fc;color:#1d5fae}.cwrvc.c-cb{background:#eef7f7;color:#0e7c7c}.cwrvst{font-size:12.5px;font-weight:600;border-radius:7px;padding:4px 9px;white-space:nowrap}.cwrvst.cho{background:#fff4e0;color:#a86a12}.cwrvst.ok{background:#e7f6ed;color:#2f9e5b}.cwrvst.sua{background:#fdeeee;color:#d93a3a}@media(max-width:900px){.cwrv{grid-template-columns:96px minmax(0,1fr)}.cwrv .mn,.cwrv .who{grid-column:2;text-align:left}.cwrv .ac{grid-column:1/-1;justify-content:flex-start}}#tkf2.cwself #t-cdw{display:none!important}.topbar.cwsq .pp{display:none!important}.cwhd.cwhdr{justify-content:flex-end;flex-wrap:nowrap;margin:0 0 2px}.cwhd.cwhdr .cwbar{flex-wrap:nowrap}
.cwtop+.kdstrip,.cwtop+.odcard,.kdstrip+.odcard{margin:0 0 12px}
svg.cwi{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-2px}
.cwbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cwbar .btn{display:inline-flex;align-items:center;gap:6px}
.cwsrch{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e7e9f0);border-radius:9px;padding:6px 10px;background:#fff;color:var(--muted,#6b7385)}.cwsrch input{border:0;outline:0;font:inherit;width:160px;background:none;padding:0}
.cwtabs{display:flex;gap:2px;border-bottom:1px solid var(--line,#e7e9f0);margin:6px 0 12px;overflow-x:auto;scrollbar-width:none}
.cwtabs button{border:0;background:none;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;color:var(--muted,#6b7385);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.cwtabs button.on{color:var(--nv-active,#4b54d1);border-color:var(--nv-active,#4b54d1)}.cwtabs .n{font-size:11px;background:#eff0f4;color:var(--muted,#6b7385);border-radius:20px;padding:0 7px;font-weight:600}.cwtabs .n.r{background:#fdeeee;color:#d93a3a}
.cwtb{display:flex;gap:8px;align-items:center;margin:0 0 12px;flex-wrap:wrap}.cwtb>.sp{flex:1}
.cwseg{display:inline-flex;background:#fff;border:1px solid var(--line,#e7e9f0);border-radius:9px;padding:2px;flex-wrap:wrap}
.cwseg button{border:0;background:none;padding:5px 10px;border-radius:7px;font:inherit;font-size:13px;font-weight:600;color:var(--muted,#6b7385);cursor:pointer;display:inline-flex;gap:5px;align-items:center}.cwseg button.on{background:#eef0ff;color:var(--nv-active,#4b54d1)}
@media(max-width:1250px){.cwkx span{display:none}}
.cwfsel{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line,#e7e9f0);border-radius:9px;padding:0 4px 0 10px;background:#fff;color:var(--muted,#6b7385);font-size:12.5px}.cwfsel select{border:0;outline:0;font:inherit;font-weight:600;color:#3a4256;padding:7px 4px;background:none;cursor:pointer;max-width:240px}
.cwchip{display:inline-flex;align-items:center;gap:6px;background:#eef0ff;color:var(--nv-active,#4b54d1);border-radius:20px;padding:4px 6px 4px 12px;font-size:12.5px;font-weight:600}.cwchip button{border:0;background:none;color:inherit;cursor:pointer;padding:0 4px;display:inline-flex}
.cwcard{background:#fff;border:1px solid var(--line,#e7e9f0);border-radius:12px;margin-bottom:12px;overflow:hidden}
.cwcard>h3{margin:0;padding:11px 14px;font-size:13.5px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--line,#e7e9f0)}.cwcard>h3 .c{font-size:12px;color:var(--muted,#6b7385);font-weight:500}.cwcard>h3 .sp{flex:1}
.cwrow{display:grid;grid-template-columns:20px minmax(0,1fr) 170px 96px 132px;column-gap:10px;align-items:center;padding:9px 14px;border-bottom:1px solid #f0f1f5;cursor:pointer;background:#fff}
.cwlist.hasact .cwrow{grid-template-columns:20px minmax(0,1fr) 170px 96px 132px 220px}
.cwlist>.cwrow:last-child,.cwsub>.cwrow:last-child{border-bottom:0}.cwrow:hover{background:#fafaff}
.cwwho{display:flex;align-items:center;gap:6px;font-size:12.5px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cwwho i.av{width:22px;height:22px;font-size:10px;margin:0;flex:none}
.cwdue{font-size:12.5px;color:#3a4256}.cwdue.r{color:#d93a3a;font-weight:600}.cwst{display:flex;min-width:0}.cwst .pill{overflow:hidden;text-overflow:ellipsis}.cwact{display:flex;gap:5px;justify-content:flex-end}
.cwtt{min-width:0}.cwtt b{font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cwtt small{color:var(--muted,#6b7385);font-size:11.5px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}.cwtt small span{display:inline-flex;gap:3px;align-items:center}.cwtt small svg.cwi{width:12px;height:12px}.cwtt small .r{color:#d93a3a}
.cwck{width:18px;height:18px;border:1.6px solid #bfc4d2;border-radius:50%;cursor:pointer;display:grid;place-items:center;background:#fff;padding:0}.cwck:hover{border-color:#2f9e5b}
.cwrow.done .cwck{background:#2f9e5b;border-color:#2f9e5b}.cwrow.done .cwck:after{content:"";width:8px;height:4px;border:2px solid #fff;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px)}
.cwrow.done .cwtt b{text-decoration:line-through;color:var(--muted,#6b7385)}.cwdot{color:#9aa0ae;display:grid;place-items:center}
.cwarr{color:var(--muted,#6b7385);display:grid;place-items:center;transition:.15s}.cwgrp.open .cwarr{transform:rotate(90deg)}
.cwsub{display:none;background:#fbfbfe}.cwsub.open{display:block}.cwsub .cwrow{background:#fbfbfe}.cwsub .cwtt{padding-left:12px;border-left:2px solid #e3defd}
.cwrow{padding:5px 12px;column-gap:8px}.cwtt b{font-size:13.5px;line-height:1.3}.cwtt small{font-size:11px;line-height:1.25;gap:8px}.cwwho,.cwdue{font-size:12px}.cwst .pill{font-size:11px;padding:1px 8px}.cwck{width:16px;height:16px}.cwwho i.av{width:20px;height:20px;font-size:9px}.cwcard>h3,.cwcard h3{padding-top:8px;padding-bottom:8px}
@media(min-width:1100px){.cwtb{flex-wrap:nowrap}.cwtb .cwkx button{padding:6px 8px;font-size:12.5px;gap:4px}.cwtb .cwdasel select{max-width:128px;font-size:12.5px}.cwtb>.cwbar2 .btn,.cwtb>.cwbar2 button{padding:6px 9px;font-size:12.5px;white-space:nowrap}}
.cwsel{width:16px;height:16px;margin:0}
.cwempty{padding:14px;color:var(--muted,#6b7385);margin:0}
.cwbulk{background:var(--nv-active,#4b54d1);color:#fff;padding:8px 14px;gap:6px;align-items:center;flex-wrap:wrap;display:flex}
.cwbulk button{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;border-radius:7px;padding:4px 10px;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.cwbulk .sp{flex:1}
.cwflt{display:flex;gap:8px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--line,#e7e9f0);align-items:center;font-size:12.5px;color:var(--muted,#6b7385)}.cwflt label{display:flex;gap:6px;align-items:center;color:#3a4256}
.cwkb{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.cwkc{background:#f0f1f6;border-radius:12px;padding:8px;min-height:220px}.cwkc.ov{outline:2px dashed var(--nv-active,#4b54d1)}
.cwkc h5{margin:4px 4px 8px;font-size:12.5px;display:flex;gap:6px;color:#3a4256}.cwkc h5 span{color:var(--muted,#6b7385);font-weight:500}.cwkc h5 small{font-weight:500;color:var(--muted,#6b7385)}
.cwkt{border:1px solid var(--line,#e7e9f0);border-radius:9px;padding:8px;margin-bottom:6px;font-size:12px;background:#fff;cursor:pointer}.cwkt[draggable=true]{cursor:grab}.cwkt.late{border-left:3px solid #d93a3a}
.cwkt b{display:block;margin-bottom:5px;font-weight:600}.cwkt .m{display:flex;align-items:center;gap:6px;color:var(--muted,#6b7385)}.cwkt .m .sp{flex:1}.cwkt i.av{width:18px;height:18px;font-size:9px;margin:0}
.cwmx{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cwmx .cwkc{min-height:180px}
.cwwk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.cwwk .cwkc{min-height:300px}.cwwk .today{background:#e9e6fd}
.cwcal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line,#e7e9f0);border-left:1px solid var(--line,#e7e9f0)}
.cwcal>div{min-height:92px;border-right:1px solid var(--line,#e7e9f0);border-bottom:1px solid var(--line,#e7e9f0);padding:4px;font-size:11px;background:#fff;min-width:0}
.cwcal .wh{min-height:0;background:#fafbfd;font-weight:600;color:var(--muted,#6b7385);padding:6px;font-size:11.5px}.cwcal .off{background:#fafbfd}
.cwcal .dn{color:var(--muted,#6b7385);font-weight:600;margin-bottom:3px}.cwcal .td .dn{color:#fff;background:var(--nv-active,#4b54d1);border-radius:10px;padding:0 6px;display:inline-block}
.cwcal .cwev{background:#eef0ff;color:#3b2fa0;border-radius:5px;padding:1px 5px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.cwcal .cwev.me{background:var(--nv-active,#4b54d1);color:#fff}.cwcal .cwev.r{background:#fdeeee;color:#d93a3a}.cwcal .cwev.g{background:#e7f6ed;color:#2f9e5b}.cwcal .more{color:var(--muted,#6b7385)}
.cwlg{display:flex;gap:14px;font-size:11.5px;color:var(--muted,#6b7385);flex-wrap:wrap;margin:0 0 8px}.cwlg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.cwday{display:grid;grid-template-columns:290px 1fr;gap:12px}
.cwslot{display:flex;border-bottom:1px solid #f0f1f5;min-height:44px}.cwslot .h{width:56px;flex:none;color:var(--muted,#6b7385);font-size:11.5px;padding:6px 8px;border-right:1px solid #f0f1f5}.cwslot .h.now{color:var(--nv-active,#4b54d1);font-weight:700}
.cwslot .b{flex:1;padding:4px 6px;display:flex;flex-direction:column;gap:4px}.cwslot .cwkt{margin:0;display:flex;align-items:center;gap:8px}.cwslot .cwkt b{margin:0;flex:1}
.cwkp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}.cwkp.k4{grid-template-columns:repeat(4,minmax(0,1fr))}
.cwkp>div{background:#fff;border:1px solid var(--line,#e7e9f0);border-radius:12px;padding:10px 12px}.cwkp small{color:var(--muted,#6b7385);font-size:11.5px;display:flex;align-items:center;gap:5px}.cwkp b{display:block;font-size:22px;margin-top:2px}.cwkp i{font-style:normal;font-size:11.5px;color:var(--muted,#6b7385)}
.cwhero{background:linear-gradient(135deg,#f6f3ff,#fdf4f8);border:1px solid #ece6fb;border-radius:12px;padding:16px 18px;margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap;align-items:center}
.cwhero .big{font-size:40px;font-weight:700;line-height:1}.cwhero .bar{height:7px;background:#e6e1f6;border-radius:6px;overflow:hidden;width:100%;margin:10px 0 4px}.cwhero .bar i{display:block;height:100%;background:var(--nv-active,#4b54d1)}.cwhero small{color:var(--muted,#6b7385)}
.cwtwo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cwtbl{width:100%;border-collapse:collapse;font-size:12.5px}.cwtbl th{text-align:left;color:var(--muted,#6b7385);font-weight:600;font-size:11.5px;padding:8px 12px;border-bottom:1px solid var(--line,#e7e9f0);background:#fafbfd}.cwtbl td{padding:8px 12px;border-bottom:1px solid #f0f1f5}.cwtbl .n{text-align:right}.cwtbl tr.clk{cursor:pointer}.cwtbl tr.clk:hover td{background:#fafaff}
.cwtbl i.av{width:20px;height:20px;font-size:9.5px}
.cwmini{display:inline-block;width:70px;height:5px;background:#eef0f5;border-radius:4px;overflow:hidden;vertical-align:middle;margin-right:6px}.cwmini i{display:block;height:100%}
.cwchart{padding:10px 14px 14px;position:relative}.cwtip{position:absolute;background:#1d2433;color:#fff;font-size:11.5px;padding:6px 9px;border-radius:7px;pointer-events:none;display:none;white-space:nowrap}
.cwcmp{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:12.5px}.cwcmp span{width:140px}.cwcmp em{flex:1;height:8px;background:#eef0f5;border-radius:5px;overflow:hidden}.cwcmp em i{display:block;height:100%}.cwcmp b{width:44px;text-align:right}
.cwpad{padding:12px 14px}.cwnote{background:#fbfaff;border:1px solid #e3defd;border-radius:10px;padding:9px 13px;margin-bottom:12px;color:#4a3fa8;font-size:12.5px;display:flex;gap:8px}
.cwlog>div{display:flex;gap:10px;padding:8px 14px;border-bottom:1px solid #f0f1f5;font-size:12.5px;cursor:pointer;align-items:baseline}.cwlog>div:hover{background:#fafaff}.cwlog time{color:var(--muted,#6b7385);width:118px;flex:none}.cwlog em{font-style:normal;color:var(--muted,#6b7385)}
.cwpins{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 12px;font-size:12.5px;color:var(--muted,#6b7385)}.cwpins button{border:1px solid var(--line,#e7e9f0);background:#fff;border-radius:20px;padding:4px 11px;font:inherit;font-size:12.5px;cursor:pointer;color:#3a4256}
.cwother{margin-bottom:12px}.cwother>summary{cursor:pointer;padding:11px 14px;font-weight:600;font-size:13.5px;display:flex;gap:8px;align-items:center;list-style:none}.cwother>summary::-webkit-details-marker{display:none}.cwother>summary small{color:var(--muted,#6b7385);font-weight:500}
.cwlist.ord .cwrow{grid-template-columns:14px 20px minmax(0,1fr) 170px 96px 132px}.cwlist.ord.hasact .cwrow{grid-template-columns:14px 20px minmax(0,1fr) 170px 96px 132px 150px}
.cwgrip{color:#b5b9c6;cursor:grab;display:grid;place-items:center;width:14px}.cwgrip:hover{color:var(--nv-active,#4b54d1)}.cwrow.drg{opacity:.45}
.cwgap{display:inline-flex;align-items:center;gap:2px;background:#fdeeee;color:#d93a3a;border-radius:5px;padding:0 5px;margin-right:5px;font-size:10.5px;font-weight:700;vertical-align:1px}.cwgap svg.cwi{width:11px;height:11px}
.cwkb.k5{grid-template-columns:repeat(5,minmax(0,1fr))}.cwcal>div.ov,.cwslot.ov,.cwdz.ov{outline:2px dashed var(--nv-active,#4b54d1);outline-offset:-2px;background:#f6f5ff}
.cwcal .cwev[draggable=true],.cwslot .cwkt[draggable=true]{cursor:grab}.cwdz{min-height:120px}
.cwhc{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.cwhcb{border:1px solid var(--line,#e7e9f0);background:#fff;border-radius:20px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer;color:#3a4256}.cwhcb.on{background:#eef0ff;border-color:#cfd2fb;color:var(--nv-active,#4b54d1);font-weight:600}
.cwnv{background:#fbfbfe;border:1px solid var(--line,#e7e9f0);border-radius:10px;padding:10px 12px;font-size:12.5px;white-space:pre-wrap;line-height:1.55;max-width:520px}
@media(max-width:900px){.cwlist.ord .cwrow,.cwlist.ord.hasact .cwrow{grid-template-columns:14px 20px minmax(0,1fr) 72px auto}.cwkb.k5{grid-template-columns:1fr 1fr}
.cwrow,.cwlist.hasact .cwrow{grid-template-columns:20px minmax(0,1fr) 72px auto}.cwwho{display:none}.cwact{grid-column:2/-1;justify-content:flex-start}
.cwkb,.cwwk{grid-template-columns:1fr 1fr}.cwkp,.cwkp.k4{grid-template-columns:1fr 1fr}.cwtwo,.cwday,.cwmx{grid-template-columns:1fr}.cwsrch input{width:110px}.cwcal>div{min-height:56px}}`;
function cwCss(){if(document.getElementById("cw-css"))return;const s=document.createElement("style");s.id="cw-css";s.textContent=CW_CSS;document.head.appendChild(s)}

/* ---------- trạng thái xem (chỉ trên máy này, không ghi dữ liệu) ---------- */
const CWS={my:"today",pb:"open",ov:"me",kx:"list",rl:"mine",per:"thang",pbT:null,pbW:"",ovT:null,ovW:"",q:"",da:"",sel:new Set(),open:new Set(),nk:"all"};
try{const k=localStorage.getItem("ailla_cw_kx");if(k)CWS.kx=k}catch(e){}
const CW_KX=[["list","list","Danh sách"],["board","kb","Bảng"],["cal","cal","Lịch tháng"],["week","week","Tuần"],["day","clock","Ngày theo giờ"],["mx","mx","Ưu tiên"]];
const CW_DATEKX=["cal","week","day"];
const cwTd=()=>D().settings.today;
/* ai thấy gì: Phòng ban cho người quản lý (CEO, Lead, trưởng phòng, người được giao việc); Tổng quan cả công ty cho CEO / người giao việc toàn công ty */
const cwMgr=()=>!!ME&&typeof cvMgrView==="function"&&cvMgrView()&&!cvSummaryOnly();
const cwBoss=()=>!!ME&&(ME.role==="admin"||can(ME,"viec.giao")||(typeof cvSummaryOnly==="function"&&cvSummaryOnly()));
const cwDashOk=()=>!!ME&&typeof cvMgrView==="function"&&cvMgrView();
const cwTeamOfU=u=>u?cvTeamNorm(teamOf(u)):"";
const cwUsers=()=>(D().users||[]).filter(u=>u.active!==false&&u.name&&!CV_TEST.includes(u.id));
/* Phòng Marketing gồm các nhóm Content, Digital – Ads, KOC: lọc được cả phòng hoặc từng nhóm */
const CW_MKT=["content","digital","koc"],cwIsMkt=k=>k==="mkt"||CW_MKT.includes(k),cwPhKey=k=>cwIsMkt(k)?"mkt":k;
function cwTeams(){const t=teamOf(ME),ks=[];cwUsers().forEach(u=>{if(u.role==="admin")return;const k=cwTeamOfU(u);if(k&&k!=="all"&&!ks.includes(k)&&(cwBoss()||cvTeamSee(t,k)||k===cvTeamNorm(t)))ks.push(k)});
  const sub=CW_MKT.filter(k=>ks.includes(k)),hasM=ks.includes("mkt")||(sub.length&&(cwBoss()||t==="mkt")),oth=ks.filter(k=>!cwIsMkt(k));
  if(hasM)oth.push("mkt");oth.sort((a,b)=>String(cvTeamName(a)).localeCompare(String(cvTeamName(b))));
  const i=oth.indexOf("mkt");return i<0?sub.concat(oth):oth.slice(0,i+1).concat(sub,oth.slice(i+1))}
const cwMembers=k=>cwUsers().filter(u=>u.role!=="admin"&&(k==="mkt"?cwIsMkt(cwTeamOfU(u)):cwTeamOfU(u)===k)).sort((a,b)=>a.name.localeCompare(b.name));
const cwPhong=k=>CW_MKT.includes(k)?"Marketing · "+cvTeamName(k):"Phòng "+cvTeamName(k);
const cwPhongOpt=(k,T)=>CW_MKT.includes(k)&&T.includes("mkt")?"   · "+cvTeamName(k):cwPhong(k);

/* ---------- gom mọi việc về một dạng dòng ---------- */
/* Gộp việc giống nhau: phần tên trước dấu " · ", hoặc phần chữ trước mã (vd "Sửa video tồn KHO-T10-0789" → "Sửa video tồn") */
function cwGKey(x){if(x.src!=="task")return "";const lo=String(x.loai||"");if(lo&&!/^(việc|moi|kho)$/i.test(lo))return lo;
  const s=String(x.ten||"").trim();if(s.includes(" · ")){const p=s.split(" · ")[0].trim();return p.split(/\s+/).length>=2?p:""}
  const w=s.split(/\s+/),o=[];for(const t of w){if(/\d/.test(t)&&/[A-Za-zĐđ_.#\/-]/.test(t))break;o.push(t)}
  return o.length>=2&&o.length<w.length?o.join(" "):""}
let CW_C=null;
function cwRows(){if(CW_C)return CW_C;const d=D(),td=d.settings.today,T={},out=[];(d.tasks||[]).forEach(t=>T[t.id]=t);
  cvItems().filter(x=>x.src!=="card"&&!CV_TEST.includes(x.nguoi)).forEach(x=>{const t=x.src==="task"?T[x.id]:null,han=+x.han||0,late=x.st!=="done"&&x.st!=="review"&&!!han&&han<td;
    out.push({k:x.src+":"+x.id,src:x.src,id:x.id,ten:String(x.ten||""),mo:x.src==="order"?x.mo:"",loai:x.loai,nguoi:x.nguoi||"",tao:x.tao||"",phoi:x.phoi||[],han,gio:x.gio||"",st:x.st,late,lateD:late?td-han:0,da:x.da||"",uu:x.uu||"",
      ck:x.ck||[],cd:t&&t.cd&&t.cd.length?t.cd:null,tl:!!(t&&t.tlNote),vong:t?+t.vong||0:0,tpl:t?t.tpl||"":"",tu:!!t&&(!!t.tuThem||(!!t.tao&&t.tao===t.nguoi)),xong:t?+t.xongNgay||0:0,
      tc:!!(t&&t.tuChoi&&t.tuChoi.st==="cho"),rv:!!t&&((typeof tkMyTurn==="function"&&tkMyTurn(t))||(!!t.tuChoi&&t.tuChoi.st==="cho"&&typeof tkTcCan==="function"&&tkTcCan(t))),v2:!!t&&typeof tkV2==="function"&&tkV2(t),g:cwGKey(x),
      theoDoi:t&&Array.isArray(t.theoDoi)?t.theoDoi:[],gap:!!t&&(t.gap===true||(t.gap===undefined&&cwGapT(t.ten)))})});
  /* việc làm video, đăng bài (thẻ video gom theo người · kênh · sản phẩm · hạn, như trang cũ) */
  try{[].concat(cvAutoMk(true)||[],cvAutoDg(true)||[]).forEach(g=>{if(CV_TEST.includes(g.nguoi))return;
    out.push({k:g.kind+":"+g.key,src:g.kind,id:g.key,ag:g,ten:g.ten,mo:g.mo,nguoi:g.nguoi||"",tao:"",phoi:[],han:+g.han||0,gio:"",st:g.st,late:!!g.late,lateD:g.lateD||0,da:"",uu:"",ck:[],n:g.n,done:g.done||0,g:"",theoDoi:[],gap:false})})}catch(e){console.error("việc video",e)}
  /* video, kịch bản chờ mình duyệt (chỉ hiện ở chỗ "của tôi", không tính vào việc của phòng để khỏi đếm hai lần) */
  /* Duyệt V1 (kịch bản, video) là việc của Lead Content; CEO chỉ duyệt V2 (chị Hoa 07/11) */
  try{if(typeof rvQueue==="function")rvQueue().filter(c=>!(ME.role==="admin"&&(c.step==="dkb"||c.step==="dvd"))).forEach(c=>{if(CV_TEST.includes(c.nguoi))return;
    out.push({k:"card:"+c.id,src:"card",id:c.id,rvOnly:true,cardStep:c.step,ten:(c.step==="dkb"?"Duyệt kịch bản · ":"Duyệt video · ")+String(c.hookText||c.yTuong||c.tuyen||c.id),mo:c.id+" · "+chOf(c.kenh).short,
      nguoi:c.nguoi||"",tao:"",phoi:[],han:+((c.han&&WORK_STEPS.includes(c.step))?c.han:c.day)||0,gio:"",st:"review",late:false,lateD:0,da:"",uu:c.uuTien||"",ck:[],rv:true,g:c.step==="dkb"?"Duyệt kịch bản":"Duyệt video",theoDoi:[],gap:false})})}catch(e){console.error("video chờ duyệt",e)}
  CW_C=out;Promise.resolve().then(()=>{CW_C=null});return out}
const cwOpen=r=>r.st!=="done";
const cwMine=r=>r.nguoi===ME.id&&!r.rvOnly;
const cwGiao=r=>r.src==="task"&&!!r.tao&&r.tao===ME.id&&r.nguoi!==ME.id;
/* "Tôi theo dõi": việc có mình trong ô Người theo dõi (t.theoDoi). Chỉ để biết tiến độ: không vào Hôm nay, không tính trễ / hiệu suất của mình */
const cwFollow=r=>(r.theoDoi||[]).includes(ME.id)&&r.nguoi!==ME.id&&!r.rvOnly;
const cwQ=L=>{const q=CWS.q.trim().toLowerCase();if(!q)return L;return L.filter(r=>(r.ten+" "+(r.mo||"")+" "+(PAGE==="cv_v"?"":userName(r.nguoi))+" "+(r.da?prjN(r.da):"")).toLowerCase().includes(q))};
const cwDaF=L=>CWS.da?L.filter(r=>r.da===CWS.da):L;
const cwTask=r=>r&&r.src==="task"?(D().tasks||[]).find(t=>t.id===r.id):null;
const cwCanDo=r=>{const t=cwTask(r);return !!t&&!(t.cd&&t.cd.length)&&(t.nguoi===ME.id||(t.phoi||[]).includes(ME.id)||tkMgr(t))};
const cwCanEdit=r=>{const t=cwTask(r);return !!t&&(t.tao===ME.id||tkMgr(t))};

/* ---------- một dòng việc ---------- */
const cwDueN=h=>{const td=cwTd();return h===td?"Hôm nay":h===td+1?"Mai":h===td-1?"Hôm qua":dd(h)};
const cwDue=r=>r.han?cwDueN(r.han)+(r.gio?" · "+esc(r.gio):""):"Chưa có hạn";
function cwStPill(r){if(r.st==="done")return pill("Xong","grn");if(r.tc)return pill("Xin từ chối","red");
  if(r.st==="review"){const l=r.src==="card"?(r.cardStep==="dceo"?"Chờ duyệt V2":r.cardStep==="dkb"?"Chờ duyệt kịch bản":"Chờ duyệt V1"):r.vong===2?"Chờ duyệt V2":r.v2?"Chờ duyệt V1":"Chờ duyệt";return pill(r.late?l+" · trễ":l,r.late?"red":"amb")}
  if(r.late)return pill("Trễ "+r.lateD+" ngày","red");if(r.tl)return pill("Cần sửa","red");
  return r.st==="doing"?pill("Đang làm","blu"):r.st==="pause"?pill("Tạm dừng","gry"):r.st==="nhan"?pill("Đã nhận việc","blu"):r.st==="cg"?pill("Chưa giao","gry"):pill("Cần làm","gry")}
function cwMeta(r,sub){const a=[];
  if(r.src==="task"&&!sub){if(r.tu)a.push("<span>Tự thêm</span>");else if(r.tao&&r.tao!==r.nguoi)a.push(`<span>Giao bởi ${esc(userName(r.tao)||"—")}</span>`)}
  if(r.src!=="task"&&r.mo)a.push(`<span>${esc(String(r.mo).replace(/<[^>]*>/g,""))}</span>`);
  if(r.gio)a.push(`<span>${cwI("clock")}${esc(r.gio)}</span>`);
  if(r.da&&prjN(r.da))a.push(`<span>${cwI("fold")}${esc(prjN(r.da))}</span>`);
  if(r.cd)a.push(`<span>${cwI("sub")}${r.cd.filter(s=>s.st==="xong").length}/${r.cd.length} công đoạn</span>`);else if(r.ck&&r.ck.length)a.push(`<span>${cwI("sub")}${r.ck.filter(c=>c.x).length}/${r.ck.length}</span>`);
  if(r.tpl)a.push(`<span>${cwI("rep")}Định kỳ</span>`);
  if(r.phoi&&r.phoi.length){const n=r.phoi.map(userName).filter(Boolean);if(n.length)a.push(`<span>${cwI("users")}${esc(n.slice(0,2).join(", "))}${n.length>2?" +"+(n.length-2):""}</span>`)}
  if(r.tl&&r.st!=="done"&&r.st!=="review")a.push('<span class="r">bị trả lại, cần sửa</span>');
  return a.join("")}
const cwUu=r=>r.gap?`<span class="cwgap" title="Việc gấp">${cwI("flag",11)}GẤP</span>`:r.uu==="Cao"?`<span class="t-red" title="Ưu tiên cao" style="display:inline-flex;margin-right:4px;vertical-align:-2px">${cwI("flag",13)}</span>`:"";
/* việc đang "Chờ duyệt" nhưng người làm chưa nộp gì (vd. bấm nhầm): không có nút Duyệt, chỉ trả về Cần làm */
const cwChuaNop=r=>{const t=cwTask(r);return !!t&&t.st==="review"&&!(t.nopAt||t.kq||t.kqNote||(t.kqFiles||[]).length)};
/* link video của thẻ đang chờ duyệt */
const cwVidLk=r=>{if(!r||r.src!=="card")return "";const c=(D().cards||[]).find(x=>x.id===r.id);return c?String(c.linkFinal||c.linkVideo||"").trim():""};
/* mở video ngay trên trang: Drive dùng khung xem trước, link nội bộ / link khác mở trong khung */
/* duyệt / trả sửa thẻ video ngay tại chỗ, không mở cửa sổ thẻ (chị Hoa 07/11) */
function cwCardOk(id){const c=(D().cards||[]).find(x=>x.id===id);if(!c)return false;const nx=typeof nextAct==="function"?nextAct(c):null;const e=nx?moveCard(ME,c.id,nx[1]):"Không chuyển được";if(e){toast(e);return false}toast("Đã duyệt "+c.id);renderMain();return true}
function cwCardFix(id,note){if(!note){toast("Ghi rõ cần sửa gì");return false}sendBack(ME,id,note);toast("Đã trả về để sửa "+id);renderMain();return true}
/* xem video ngay trên trang: video Drive phát qua máy chủ web (Drive không cho nhúng file riêng tư); link khác mở trong khung */
function cwPlay(lk,ten,cid){if(!lk)return;const m=lk.match(/[/]d[/]([A-Za-z0-9_-]{10,})/)||lk.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  const ext=m?"https://drive.google.com/file/d/"+m[1]+"/view":(lk.startsWith("/")||/^https?:/i.test(lk)?lk:"https://"+lk);
  const body=m?`<video src="/api/drive/video/${esc(m[1])}" controls autoplay playsinline></video><div class="cwviderr" hidden>Web chưa phát được video này. <a href="${esc(ext)}" target="_blank" rel="noopener">Mở trên Drive ↗</a></div>`:`<iframe src="${esc(ext)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  const o=document.createElement("div");o.className="cwvid";o.innerHTML=`<div class="cwvidb"><div class="cwvidh"><b>${esc(ten||"Xem video")}</b><a href="${esc(ext)}" target="_blank" rel="noopener">Mở Drive ↗</a><button type="button" class="btn sm" data-x>Đóng</button></div><div class="cwvidv">${body}</div>${cid?`<div class="cwvidf"><button type="button" class="btn sm pri" data-ok>Duyệt</button><input class="cwfixin" placeholder="Cần sửa gì… (gõ rồi bấm Cần sửa)"><button type="button" class="btn sm" data-fix>Cần sửa</button></div>`:""}</div>`;
  const close=()=>{const v=o.querySelector("video");if(v){v.pause();v.removeAttribute("src");v.load()}o.remove();document.removeEventListener("keydown",k)},k=e=>{if(e.key==="Escape"&&!e.target.closest("input"))close()};
  const v=o.querySelector("video");if(v)v.onerror=()=>{v.hidden=true;o.querySelector(".cwviderr").hidden=false};
  o.onclick=e=>{if(e.target===o||e.target.closest("[data-x]"))close();else if(e.target.closest("[data-ok]")){if(cwCardOk(cid))close()}else if(e.target.closest("[data-fix]")){const n=o.querySelector(".cwfixin");if(cwCardFix(cid,n.value.trim()))close();else n.focus()}};
  const fi=o.querySelector(".cwfixin");if(fi)fi.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();if(cwCardFix(cid,fi.value.trim()))close()}};
  document.addEventListener("keydown",k);document.body.appendChild(o)}
const cwXemB=r=>r.cardStep&&r.cardStep!=="dkb"&&cwVidLk(r)?`<button type="button" class="btn sm" data-cwxem="${esc(r.k)}">▶ Xem</button>`:"";
const cwAct=r=>{if(!r.rv)return "<div></div>";if(r.tc)return `<div class="cwact"><button type="button" class="btn sm pri" data-cwtc="${esc(r.k)}">Xử lý</button></div>`;if(cwChuaNop(r))return `<div class="cwact"><button type="button" class="btn sm" data-cwback="${esc(r.k)}">Trả về Cần làm</button></div>`;return `<div class="cwact">${cwXemB(r)}<button type="button" class="btn sm pri" data-cwok="${esc(r.k)}">Duyệt</button><button type="button" class="btn sm" data-cwfix="${esc(r.k)}">Cần sửa</button></div>`};
function cwRow(r,o){o=o||{};const done=r.st==="done";
  const lead=o.sel?(r.src==="task"?`<input type="checkbox" class="cwsel" data-cwsel="${esc(r.k)}"${CWS.sel.has(r.k)?" checked":""} aria-label="Chọn việc">`:`<span class="cwdot">${cwI(r.src==="order"?"inbox":"video")}</span>`)
    :(r.src==="task"&&cwCanDo(r)?`<button type="button" class="cwck" data-cwck="${esc(r.k)}" title="${done?"Bỏ đánh dấu xong":"Bấm là xong"}" aria-label="${done?"Bỏ đánh dấu xong":"Đánh dấu xong"}"></button>`
    :`<span class="cwdot">${cwI(r.src==="mk"?"video":r.src==="dg"?"send":r.src==="order"?"inbox":r.src==="card"?"cc":"task")}</span>`);
  return `<div class="cwrow${done?" done":""}" data-cwo="${esc(r.k)}" data-cwrk="${esc(r.k)}">${o.ord?cwGrip(r.k):o.ordSp?"<span></span>":""}${lead}<div class="cwtt"><b>${cwUu(r)}${esc(r.ten)}</b><small>${cwMeta(r,o.sub)}</small></div>
   <div class="cwwho">${r.nguoi?avatar(r.nguoi)+esc(userName(r.nguoi)||"—"):"Chưa giao"}</div><div class="cwdue${r.late||!r.han?" r":""}">${cwDue(r)}</div><div class="cwst">${cwStPill(r)}</div>${o.act?cwAct(r):""}</div>`}
function cwGrow(G,o){o=o||{};const n=G.a.length,ok=G.a.filter(r=>r.st==="done").length,lt=G.a.some(r=>r.late),hs=G.a.filter(r=>r.st!=="done"&&r.han).map(r=>r.han),h=hs.length?Math.min(...hs):0,op=CWS.open.has(G.k);
  return `<div class="cwrow cwgrp${op?" open":""}" data-cwg="${esc(G.k)}" data-cwrk="g:${esc(G.k)}">${o.ord?cwGrip("g:"+G.k):""}<span class="cwarr">${cwI("arr")}</span><div class="cwtt"><b>${esc(G.ten)} · ${n} việc</b><small><span>Bấm để xem từng việc</span></small></div>
   <div class="cwwho">${G.nguoi?avatar(G.nguoi)+esc(userName(G.nguoi)||"—"):"Chưa giao"}</div><div class="cwdue${lt?" r":""}">${h?cwDueN(h):"—"}</div><div class="cwst">${pill(ok+"/"+n+" xong",lt?"red":ok===n?"grn":"gry")}</div>${o.act?"<div></div>":""}</div>
   <div class="cwsub${op?" open":""}" data-cwsub="${esc(G.k)}">${G.a.map(r=>cwRow(r,{act:o.act,sub:1,ordSp:o.ord})).join("")}</div>`}
function cwGroupRows(L){const out=[],G={};L.forEach(r=>{if(!r.g){out.push(r);return}const k=r.g+"|"+r.nguoi;if(!G[k]){G[k]={grp:1,k,ten:r.g,nguoi:r.nguoi,a:[]};out.push(G[k])}G[k].a.push(r)});return out.map(x=>x.grp&&x.a.length===1?x.a[0]:x)}
const cwGrip=k=>`<span class="cwgrip" draggable="true" data-cwreo="${esc(k)}" title="Giữ để kéo xếp thứ tự" aria-label="Kéo xếp thứ tự">${cwI("grip",14)}</span>`;
/* thứ tự "Làm hôm nay" của từng người (kéo ⋮⋮): việc chưa xếp nằm sau, việc Gấp chưa xếp lên đầu */
const cwOrdGet=()=>{const o=(D().cwOrd||{})[ME.id];return Array.isArray(o)?o:[]};
function cwOrdApply(items){const O=cwOrdGet();if(!O.length)return items;const ix=(x,i)=>{const k=x.grp?"g:"+x.k:x.k,j=O.indexOf(k);return j>=0?j:(x.gap?-1:1e6)};
  return items.map((x,i)=>[x,ix(x,i),i]).sort((a,b)=>(a[1]-b[1])||(a[2]-b[2])).map(z=>z[0])}
const cwSort=L=>L.slice().sort((a,b)=>(!!b.gap-!!a.gap)||(b.late-a.late)||(b.lateD-a.lateD)||((b.uu==="Cao")-(a.uu==="Cao"))||((a.han||999)-(b.han||999))||String(a.gio||"99").localeCompare(String(b.gio||"99")));
function cwList(L,o){o=o||{};if(!L.length)return `<p class="cwempty">${o.empty||"Không có việc nào."}</p>`;
  const S=o.sort?o.sort(L):cwSort(L),act=!o.sel&&S.some(r=>r.rv),lim=o.lim||300,ord=!!o.ord&&!o.sel;let items=o.flat?S:cwGroupRows(S);if(ord)items=cwOrdApply(items);
  return `<div class="cwlist${act?" hasact":""}${ord?" ord":""}"${ord?' data-cword="1"':""}>${items.slice(0,lim).map(x=>x.grp?cwGrow(x,{act,ord}):cwRow(x,{act,sel:o.sel,ord})).join("")}</div>${items.length>lim?`<p class="cwempty">Còn ${items.length-lim} dòng nữa chưa hiện. Gõ vào ô tìm hoặc chọn phòng, người để lọc bớt.</p>`:""}`}
const cwSec=(t,L,o)=>`<section class="cwcard"><h3>${t}<span class="c">${(o&&o.c)||L.length+" việc"}</span></h3>${cwList(L,o)}</section>`;
const cwDragOk=r=>r.src==="task"&&(cwCanDo(r)||cwCanEdit(r));
const cwDragA=r=>cwDragOk(r)?` draggable="true" data-cwdrag="${esc(r.k)}"`:"";
const cwKt=r=>`<div class="cwkt${r.late?" late":""}" data-cwo="${esc(r.k)}"${cwDragA(r)}><b>${cwUu(r)}${esc(r.ten)}</b><div class="m">${r.nguoi?avatar(r.nguoi)+esc(userName(r.nguoi)||""):"Chưa giao"}<span class="sp"></span>${r.ck&&r.ck.length?cwI("sub")+r.ck.filter(c=>c.x).length+"/"+r.ck.length+" ":""}${r.han?cwDueN(r.han):""}</div></div>`;

/* ---------- các kiểu xem khác: cùng bộ việc ---------- */
function cwBoard(L){const C=[["todo","Cần làm",r=>["cg","todo","nhan"].includes(r.st)],["doing","Đang làm",r=>r.st==="doing"],["pause","Tạm dừng",r=>r.st==="pause"],["review","Chờ duyệt",r=>r.st==="review"],["done","Xong",r=>r.st==="done"]];
  return `<p class="hint" style="margin:0 0 8px">Kéo thẻ việc sang cột khác để đổi trạng thái (chỉ việc bạn làm hoặc quản lý). Việc cần duyệt kéo vào Xong sẽ sang Chờ duyệt. Việc video đổi ở thẻ video.</p><div class="cwkb k5">${C.map(([k,l,f])=>{const X=cwSort(L.filter(f));return `<div class="cwkc" data-cwdrop="st:${k}"><h5>${l}<span>${X.length}</span></h5>${X.slice(0,60).map(cwKt).join("")}${X.length>60?`<p class="hint">+${X.length-60} việc nữa</p>`:""}</div>`}).join("")}</div>`}
const CW_MXQ=[["Làm ngay","quan trọng · gấp",(q,g)=>q&&g],["Lên lịch","quan trọng · chưa gấp",(q,g)=>q&&!g],["Giao người khác","gấp · ít quan trọng",(q,g)=>!q&&g],["Để sau","không gấp · ít quan trọng",(q,g)=>!q&&!g]];
const cwMxQ=r=>r.uu==="Cao";
const cwMxG=r=>{const t=cwTask(r);if(t&&typeof t.gap==="boolean")return t.gap;return !!r.gap||r.late||(!!r.han&&r.han<=cwTd()+1)};
function cwMx(L){const O=L.filter(cwOpen);
  return `<p class="hint" style="margin:0 0 8px">Quan trọng = ưu tiên Cao. Gấp = có cờ Gấp; việc chưa đặt thì tính theo trễ, hạn hôm nay / mai. Kéo thẻ sang ô khác để đổi.</p><div class="cwmx">${CW_MXQ.map(([l,s,f],i)=>{const X=cwSort(O.filter(r=>f(cwMxQ(r),cwMxG(r))));return `<div class="cwkc" data-cwdrop="mx:${i}"><h5>${l} <small>${s}</small><span>${X.length}</span></h5>${X.slice(0,40).map(cwKt).join("")}${X.length>40?`<p class="hint">+${X.length-40} việc nữa</p>`:""}</div>`}).join("")}</div>`}
const cwWd=day=>((MONTH.first+day-1)%7+7)%7; /* 0 = Thứ 2 */
const CW_THU=["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","CN"];
function cwWeek(L){const td=cwTd(),mon=td-cwWd(td);return `<div class="cwwk">${[0,1,2,3,4,5,6].map(i=>{const d=mon+i,X=cwSort(L.filter(r=>r.han===d));return `<div class="cwkc${d===td?" today":""}" data-cwdrop="day:${d}"><h5>${CW_THU[i]} ${dd(d)}<span>${X.length}</span></h5>${X.slice(0,30).map(cwKt).join("")}${X.length>30?`<p class="hint">+${X.length-30} việc nữa</p>`:""}</div>`}).join("")}</div>`}
function cwCal(L){const td=cwTd(),cells=[];for(let i=0;i<MONTH.first;i++)cells.push(0);for(let i=1;i<=MONTH.ndays;i++)cells.push(i);while(cells.length%7)cells.push(0);
  return `<div class="cwlg"><span><i style="background:var(--nv-active,#4b54d1)"></i>Việc tôi làm</span><span><i style="background:#eef0ff;border:1px solid #d6d0fa"></i>Việc người khác làm</span><span><i style="background:#fdeeee"></i>Trễ</span><span><i style="background:#e7f6ed"></i>Xong</span><span>· kéo việc sang ngày khác để đổi hạn</span></div>
  <section class="cwcard"><div class="cwcal">${CW_THU.map(x=>`<div class="wh">${x}</div>`).join("")}${cells.map(d=>{if(!d)return '<div class="off"></div>';const X=cwSort(L.filter(r=>r.han===d)).sort((a,b)=>(b.nguoi===ME.id)-(a.nguoi===ME.id));
    return `<div class="${d===td?"td":""}" data-cwdrop="day:${d}"><div class="dn">${d}</div>${X.slice(0,4).map(r=>`<div class="cwev${r.late?" r":r.st==="done"?" g":r.nguoi===ME.id?" me":""}" data-cwo="${esc(r.k)}"${cwDragA(r)} title="${esc(r.ten)} · ${esc(userName(r.nguoi)||"")}">${r.gio?esc(r.gio)+" ":""}${esc(r.ten)}</div>`).join("")}${X.length>4?`<div class="more">+${X.length-4} việc</div>`:""}</div>`}).join("")}</div></section>`}
function cwDay(L0){const td=cwTd(),L=cwSort(L0.filter(r=>cwOpen(r)&&(r.han===td||r.late))),no=L.filter(r=>!r.gio),nh=new Date().getHours(),hr=[];for(let h=7;h<=21;h++)hr.push(h);
  const other=L.filter(r=>r.gio&&(+String(r.gio).slice(0,2)<7||+String(r.gio).slice(0,2)>21));
  return `<div class="cwday"><section class="cwcard" style="align-self:start"><h3>${cwI("inbox")}Chưa xếp giờ<span class="c">${no.length+other.length} việc</span></h3><div class="cwpad cwdz" data-cwdrop="gio:">${no.concat(other).map(cwKt).join("")||'<p class="cwempty">Đã xếp giờ hết.</p>'}</div></section>
  <section class="cwcard">${hr.map(h=>{const hh=String(h).padStart(2,"0"),X=L.filter(r=>r.gio&&String(r.gio).slice(0,2)===hh);return `<div class="cwslot" data-cwdrop="gio:${hh}:00"><div class="h${h===nh?" now":""}">${hh}:00</div><div class="b">${X.map(r=>`<div class="cwkt" data-cwo="${esc(r.k)}"${cwDragA(r)}><b>${cwUu(r)}${esc(r.ten)}</b><span class="hint">${r.tpl?cwI("rep",12)+" ":""}${esc(r.gio)}${r.nguoi!==ME.id?" · "+esc(userName(r.nguoi)||""):""}</span></div>`).join("")}</div></div>`}).join("")}</section></div>
  <p class="hint">Kéo việc vào khung giờ để xếp giờ làm, kéo về "Chưa xếp giờ" để bỏ giờ. Giờ cũng đặt được ở ô "giờ" khi giao việc.</p>`}
const cwKxSel=()=>`<div class="cwseg cwkx" role="group" aria-label="Kiểu xem">${CW_KX.map(([k,i,l])=>`<button type="button" class="${CWS.kx===k?"on":""}" data-cwkx="${k}" title="${l}">${cwI(i)}<span>${l}</span></button>`).join("")}</div>`;
const cwView=L=>CWS.kx==="board"?cwBoard(L):CWS.kx==="cal"?cwCal(L):CWS.kx==="week"?cwWeek(L):CWS.kx==="day"?cwDay(L):CWS.kx==="mx"?cwMx(L):"";

/* ---------- khung trang: tiêu đề + mô tả, hàng tab, nội dung ---------- */
/* tiêu đề trang: khối .ph được modTabs (setup.js) đưa lên thanh trên cùng, bên trái (như Tổng quan công ty); không còn dòng mô tả dưới tiêu đề.
   Nút thao tác (Tìm, Thêm việc, Giao việc, Phê duyệt, Order quản lý) nằm cùng hàng tab, bên phải (cwTop). */
function cwHead(title,desc,o){o=o||{};return `<div class="ph cwph"><h1>${title}</h1></div><div class="cwhd">${o.btns===false?"":`<div class="cvvbar cwbar">${o.search===false?"":`<label class="cwsrch">${cwI("srch")}<input id="cw-q" placeholder="${PAGE==="cv_v"?"Tìm việc":"Tìm việc, tên người"}" value="${esc(CWS.q)}" autocomplete="off"></label>`}<button type="button" class="btn" data-cwadd="1">${cwI("plus")}Thêm việc</button>${typeof bvNhapNhanh==="function"&&typeof teamOf==="function"&&teamOf(ME)==="content"?`<button type="button" class="btn" data-cwnhap="1" title="Dán một lượt link Drive của video làm xong: web tự xếp vào đúng dòng ở ② Điều phối và gửi Lead duyệt">⬆ Nhập link video</button>`:""}${tkGiver()?`<button type="button" class="btn pri" id="cv-new">${cwI("send")}Giao việc</button>`:""}</div>`}</div>`}
/* gom hàng tab và nút thao tác vào một hàng */
function cwTop(m){cwTbSearch(m);const hd=m.querySelector(":scope>.cwhd"),nv=m.querySelector(":scope>.cwtabs");if(!hd)return;if(!nv||!hd.children.length){if(!hd.children.length)hd.remove();return}
  const w=document.createElement("div");w.className="cwtop";nv.before(w);w.append(nv,hd);
  /* hàng tab dài (Việc của tôi, Phòng ban): hàng tab giữ ở trên, nút thao tác xuống cùng hàng với Kiểu xem, bên phải */
  if(nv.scrollWidth>nv.clientWidth+4){const tb=m.querySelector(":scope>.cwtb"),bar=hd.querySelector(".cwbar");
    if(tb&&bar){bar.classList.add("cwbar2");tb.append(bar);hd.remove()}else{w.after(hd);hd.classList.add("cwhdr")}}}
/* ô Tìm việc nằm trên thanh trên cùng, thay chỗ ô chọn ngày (trang Công việc không dùng ô chọn ngày) */
function cwTbSearch(m){const top=document.querySelector(".topbar");if(!top)return;top.querySelectorAll(".cwsrch").forEach(x=>x.remove());
  const q=m.querySelector(".cwsrch"),pp=top.querySelector(".pp");top.classList.toggle("cwsq",!!q);if(!q)return;
  q.classList.add("cwsrch-tb");if(pp){pp.before(q)}else{const sp=top.querySelector(".sp");if(sp)sp.after(q);else top.append(q)}}
if(typeof renderMain==="function"){const _cwRM=renderMain;renderMain=function(){const r=_cwRM.apply(this,arguments);if(MOD!=="cv"){const top=document.querySelector(".topbar");if(top){top.querySelectorAll(".cwsrch-tb").forEach(x=>x.remove());top.classList.remove("cwsq")}}return r}}
const cwTabs=L=>`<nav class="cwtabs" role="tablist">${L.map(t=>`<button type="button" role="tab" class="${t.on?"on":""}" ${t.attr}>${t.ic?cwI(t.ic):""}${t.l}${t.n?`<span class="n${t.r?" r":""}">${t.n}</span>`:""}</button>`).join("")}</nav>`;
const cwGo=(page)=>{PAGE=page;MOD="cv";try{localStorage.setItem(SKEY+"_p",PAGE)}catch(e){}render();scrollTo(0,0)};
/* ô chọn dự án: xem việc trong một dự án, chọn "Mọi dự án" để bỏ lọc */
function cwDaSel(){const P=(D().projects||[]).filter(p=>p.id===CWS.da||p.st!=="done");if(!P.length&&!CWS.da)return "";
  return `<label class="cwdasel${CWS.da?" on":""}">${cwI("fold")}<select data-cwda aria-label="Xem việc theo dự án">${opt([["","Mọi dự án"]].concat(P.map(p=>[p.id,"Dự án: "+p.ten])),CWS.da)}</select></label>`}
/* Giao việc khi đang xem một dự án: điền sẵn dự án đó */
if(typeof openTask==="function"){const _cwOT=openTask;openTask=function(id){const r=_cwOT.apply(this,arguments);try{if(!id&&MOD==="cv"&&CWS.da){const da=document.querySelector("#tkf2 #t-da");if(da&&!da.value&&[...da.options].some(o=>o.value===CWS.da)){da.value=CWS.da;da.dispatchEvent(new Event("change"))}}}catch(e){}return r}}
function cwAddSelf(){openTask(null);const di=$("#drawerIn");if(!di)return;const h=di.querySelector("h2");if(h)h.textContent="Thêm việc cho mình";
  const ng=$("#t-ng");if(ng&&[...ng.options].some(o=>o.value===ME.id))ng.value=ME.id;const hn=$("#t-han");if(hn)hn.value=tkIso(cwTd());
  const b=di.querySelector("#tkf2 .acts .btn.pri");if(b)b.textContent="Thêm việc";
  /* tự thêm việc cho mình: tên, mô tả, hạn hoàn thành (ngày + giờ), ưu tiên, link đính kèm, các bước nhỏ — ẩn các ô giao việc khác */
  const f=di.querySelector("#tkf2"),keep=["t-ten","t-mo","t-han","t-gio","t-uu","t-da","t-dk","t-ck","t-ckn"],has=el=>keep.some(id=>el.querySelector("#"+id)||el.id===id);
  const prune=el=>[...el.children].forEach(c=>{if(c.matches(".acts,input[type=hidden],script"))return;if(!has(c)){c.hidden=true;c.style.display="none";return}if(!c.matches(".field"))prune(c)});
  if(f){prune(f);f.classList.add("cwself");const da=f.querySelector("#t-da");if(da){da.disabled=false;if(CWS.da&&[...da.options].some(o=>o.value===CWS.da))da.value=CWS.da}}
  /* không cần ai duyệt; muốn có người duyệt thì chọn ở "Đề xuất người duyệt" */
  let duyet="";const uu=f&&f.querySelector("#t-uu"),fu=uu&&uu.closest(".field");
  if(fu){const ceo=D().users.filter(u=>u.active!==false&&u.role==="admin"&&u.id!==ME.id),us=cwUsers().filter(u=>u.id!==ME.id&&u.role!=="admin").sort((a,b)=>a.name.localeCompare(b.name));fu.insertAdjacentHTML("afterend",`<label class="field">Đề xuất người duyệt <small class="hint">(không bắt buộc)</small><select id="cw-duyet">${opt([["","Không cần duyệt"]].concat(ceo.map(u=>[u.id,"CEO · "+u.name]),us.map(u=>[u.id,u.name])),"")}</select></label>`);
    const sd=f.querySelector("#cw-duyet");if(sd)sd.onchange=()=>{duyet=sd.value}}
  TK_AFTER_NEW=nid=>{DB.mutate(ME.name,"tự thêm việc",dt=>{const x=(dt.tasks||[]).find(y=>y.id===nid);if(x&&x.nguoi===ME.id&&x.tao===ME.id){x.tuThem=true;if(duyet)x.duyet=duyet}})}}
/* thao tác dùng chung cho mọi trang trong mục */
function cwBind(m,list){const by={};(list||cwRows()).forEach(r=>by[r.k]=r);const R=k=>by[k]||cwRows().find(r=>r.k===k);
  const q=m.querySelector("#cw-q")||document.querySelector(".topbar #cw-q");if(q){let tm=0;q.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{CWS.q=q.value;renderMain();const q2=$("#cw-q");if(q2){q2.focus();const n=q2.value.length;try{q2.setSelectionRange(n,n)}catch(e){}}},300)}}
  m.querySelectorAll("[data-cwadd]").forEach(b=>b.onclick=()=>cwAddSelf());
  m.querySelectorAll("[data-cwnhap]").forEach(b=>b.onclick=()=>bvNhapNhanh(""));
  const nb=m.querySelector("#cv-new");if(nb)nb.onclick=()=>openTask(null);
  m.querySelectorAll("[data-cwkx]").forEach(b=>b.onclick=()=>{CWS.kx=b.dataset.cwkx;CWS.sel.clear();try{localStorage.setItem("ailla_cw_kx",CWS.kx)}catch(e){}renderMain()});
  m.querySelectorAll("[data-cwg]").forEach(r=>r.onclick=()=>{const k=r.dataset.cwg,s=m.querySelector(`[data-cwsub="${CSS.escape(k)}"]`);r.classList.toggle("open");if(s)s.classList.toggle("open");if(CWS.open.has(k))CWS.open.delete(k);else CWS.open.add(k)});
  m.querySelectorAll("[data-cwo]").forEach(e=>e.onclick=ev=>{if(ev.target.closest("button,input,select,a"))return;ev.stopPropagation();cwOpenRow(R(e.dataset.cwo))});
  m.querySelectorAll("[data-cwck]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();cwToggleDone(R(b.dataset.cwck))});
  m.querySelectorAll("[data-cwtc]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();cwOpenRow(R(b.dataset.cwtc))});
  m.querySelectorAll("[data-cwback]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const t=cwTask(R(b.dataset.cwback));if(t)tkBackTodo(t)});
  m.querySelectorAll("[data-cwxem]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const r=R(b.dataset.cwxem);if(r)cwPlay(cwVidLk(r),r.ten,r.cardStep&&r.cardStep!=="dkb"?r.id:"")});
  m.querySelectorAll("[data-cwok]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const r=R(b.dataset.cwok);if(!r)return;if(r.src==="card"){cwCardOk(r.id);return}
    const v=tkApprove(r.id);if(v!==false||!(cwTask(r)||{}).cd){toast(v?"Đã duyệt vòng 1, chuyển CEO duyệt V2":"Đã duyệt");renderMain()}});
  m.querySelectorAll("[data-cwfix]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const r=R(b.dataset.cwfix);if(!r)return;if(r.src==="card"){const box=b.closest(".cwact");box.innerHTML=`<input class="cwfixin" placeholder="Cần sửa gì…"><button type="button" class="btn sm pri">Gửi</button><button type="button" class="btn sm">Hủy</button>`;const [inp,go,no]=box.children;
      box.onclick=e=>e.stopPropagation();inp.focus();const send=()=>cwCardFix(r.id,inp.value.trim())||inp.focus();go.onclick=send;no.onclick=()=>renderMain();inp.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();send()}else if(e.key==="Escape")renderMain()};return}const t=cwTask(r);if(t&&t.cd&&t.cd.length){openTask(t.id);return}
    const note=prompt("Cần sửa gì? (người làm sẽ thấy ghi chú này)");if(note===null)return;if(!note.trim()){toast("Ghi rõ cần sửa gì");return}tkReturn(r.id,note.trim());toast("Đã trả lại để sửa");renderMain()});
  /* kéo thả: Bảng (trạng thái) · Lịch tháng, Tuần (hạn) · Ngày theo giờ (giờ) · Ưu tiên (ưu tiên + Gấp) */
  m.querySelectorAll("[data-cwdrag]").forEach(c=>c.ondragstart=e=>{e.stopPropagation();CWS.drag=c.dataset.cwdrag;e.dataTransfer.setData("text/plain",c.dataset.cwdrag);e.dataTransfer.effectAllowed="move"});
  m.querySelectorAll("[data-cwdrop]").forEach(z=>{z.ondragover=e=>{if(!CWS.drag)return;e.preventDefault();z.classList.add("ov")};z.ondragleave=e=>{if(!z.contains(e.relatedTarget))z.classList.remove("ov")};
    z.ondrop=e=>{e.preventDefault();e.stopPropagation();z.classList.remove("ov");const k=CWS.drag||e.dataTransfer.getData("text/plain");CWS.drag="";const r=R(k);if(r)cwDrop(r,z.dataset.cwdrop)}});
  m.ondragend=()=>{CWS.drag="";m.querySelectorAll(".ov").forEach(x=>x.classList.remove("ov"))};
  cwReoBind(m);
  const tp=m.querySelector(".cwtip");if(tp)m.querySelectorAll("[data-cwbar]").forEach(g=>{g.onmousemove=e=>{const bx=tp.parentElement.getBoundingClientRect();tp.style.display="block";tp.textContent=g.dataset.cwbar;tp.style.left=(e.clientX-bx.left+12)+"px";tp.style.top=(e.clientY-bx.top-10)+"px"};g.onmouseleave=()=>tp.style.display="none"});
  m.querySelectorAll("[data-cwpin]").forEach(b=>b.onclick=()=>openTask(b.dataset.cwpin));
  const dx=m.querySelector("[data-cwdax]");if(dx)dx.onclick=()=>{CWS.da="";renderMain()};
  m.querySelectorAll("[data-cwda]").forEach(x=>x.onchange=()=>{CWS.da=x.value;renderMain()});
}
function cwOpenRow(r){if(!r)return;if(r.src==="task")openTask(r.id);else if(r.src==="card")openCard(r.id);else if(r.src==="mk")cvOpenMk(r.ag);else if(r.src==="dg")cvOpenDg(r.ag);else if(r.src==="order"){PAGE="order";MOD="";render();scrollTo(0,0)}}
function cwToggleDone(r){const t=cwTask(r);if(!t)return;if(t.st==="done"){if(!tkMgr(t)&&t.tao!==ME.id){toast("Việc đã duyệt xong, nhờ người giao mở lại");return}tkSetSt(t.id,"todo");toast("Đã mở lại việc");renderMain();return}
  const er=tkDoneErr(t);if(er){if(t.st==="review"){toast("Việc đang chờ duyệt");return}if(confirm(er+"\n\nMở việc để nộp kết quả?"))openTask(t.id);return}tkSetSt(t.id,"done");toast("Đã xong");renderMain()}

/* thả một việc vào ô: st:<trạng thái> · day:<ngày> · gio:<HH:MM | trống> · mx:<0..3> (ô Ưu tiên) */
function cwDrop(r,z){const t=cwTask(r);if(!t){toast("Việc video, đơn hàng đổi ở trang của việc đó");return}
  const i=z.indexOf(":"),kind=z.slice(0,i),val=z.slice(i+1),N=(dt,x,txt)=>{if(typeof notifyU==="function"&&x.nguoi)notifyU(dt,[x.nguoi],txt,"task:"+x.id)};
  if(kind==="st"){const to=val;if(t.st===to)return;if(!cwCanDo(r)){toast("Bạn không phụ trách việc này");return}
    if(t.st==="done"&&!tkMgr(t)&&t.tao!==ME.id){toast("Việc đã duyệt xong, nhờ người giao mở lại");return}
    if(to==="done"){if(t.st==="review"&&tkMyTurn(t)){const v=tkApprove(t.id);toast(v?"Đã duyệt vòng 1, chuyển CEO duyệt V2":"Đã duyệt");renderMain();return}
      if(tkDoneErr(t)){if(t.st==="review"){toast("Việc đang chờ duyệt");return}tkSetSt(t.id,"review",null,"Kéo sang Xong");toast("Việc này cần duyệt: đã chuyển sang Chờ duyệt");renderMain();return}}
    tkSetSt(t.id,to);toast("Đã chuyển sang "+cvStN(to));renderMain();return}
  if(kind==="gio"){if(!cwCanDo(r)&&!cwCanEdit(r)){toast("Bạn không phụ trách việc này");return}if((t.gio||"")===val)return;
    DB.mutate(ME.name,val?`xếp giờ "${t.ten}" lúc ${val}`:`bỏ giờ "${t.ten}"`,dt=>{const x=(dt.tasks||[]).find(y=>y.id===t.id);if(!x)return;tkLog(x,val?"Xếp giờ làm "+val+(x.gio?" (trước: "+x.gio+")":""):"Bỏ giờ làm (trước: "+(x.gio||"—")+")");x.gio=val});
    toast(val?"Đã xếp lúc "+val:"Đã bỏ giờ");renderMain();return}
  if(kind==="day"){const d=+val;if(!d||t.han===d)return;if(!cwCanEdit(r)||(t.cd&&t.cd.length)){toast(t.cd&&t.cd.length?"Việc nhiều công đoạn: đổi hạn ở từng công đoạn":"Chỉ người giao hoặc quản lý đổi được hạn việc này");return}
    if(t.st==="done"){toast("Việc đã xong, không đổi hạn");return}
    DB.mutate(ME.name,`đổi hạn "${t.ten}" → ${dd(d)}`,dt=>{const x=(dt.tasks||[]).find(y=>y.id===t.id);if(!x)return;const old=+x.han||0;tkLog(x,"Đổi hạn (kéo trên lịch): "+(old?dd(old):"chưa có hạn")+" → "+dd(d));if(old&&!x.hanCu)x.hanCu=old;x.han=d;
      if(x.nguoi!==ME.id)N(dt,x,`${ME.name} đổi hạn việc "${x.ten}" thành ${dd(d)}`)});
    toast("Đã đổi hạn sang "+dd(d));renderMain();return}
  if(kind==="mx"){const q=+val<2,g=+val===0||+val===2;if(!cwCanEdit(r)&&t.nguoi!==ME.id){toast("Bạn không sửa được việc này");return}
    const uu=q?"Cao":(t.uu==="Cao"?"Trung bình":(t.uu||"Trung bình"));if(t.uu===uu&&t.gap===g)return;
    DB.mutate(ME.name,`đổi ưu tiên "${t.ten}"`,dt=>{const x=(dt.tasks||[]).find(y=>y.id===t.id);if(!x)return;tkLog(x,"Ưu tiên: "+(x.uu||"Trung bình")+(x.gap?" · Gấp":"")+" → "+uu+(g?" · Gấp":""));x.uu=uu;x.gap=g});
    toast("Đã chuyển sang "+CW_MXQ[+val][0]);renderMain()}}
/* Làm hôm nay: giữ ⋮⋮ kéo lên xuống, thả ra là lưu thứ tự của mình */
function cwReoBind(m){m.querySelectorAll("[data-cword]").forEach(list=>{let el=null;
  const sub=x=>x&&x.nextElementSibling&&x.nextElementSibling.classList.contains("cwsub")?x.nextElementSibling:null;
  list.querySelectorAll("[data-cwreo]").forEach(h=>{h.ondragstart=e=>{e.stopPropagation();el=h.closest(".cwrow");CWS.drag="";e.dataTransfer.setData("text/plain","reo:"+h.dataset.cwreo);e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setDragImage(el,10,10)}catch(er){}setTimeout(()=>el&&el.classList.add("drg"),0)}});
  list.ondragover=e=>{if(!el)return;e.preventDefault();const row=e.target.closest(".cwlist[data-cword]>.cwrow");if(!row||row===el||row.parentElement!==list)return;
    const b=row.getBoundingClientRect(),after=e.clientY>b.top+b.height/2,s=sub(el);if(after){const ref=sub(row)||row;ref.after(el)}else row.before(el);if(s)el.after(s)};
  list.ondrop=e=>{if(el)e.preventDefault()};
  list.ondragend=()=>{if(!el)return;el.classList.remove("drg");el=null;const keys=[...list.querySelectorAll(":scope>.cwrow[data-cwrk]")].map(x=>x.dataset.cwrk);
    const old=cwOrdGet();if(keys.join("|")===old.slice(0,keys.length).join("|"))return;const rest=old.filter(k=>!keys.includes(k));
    DB.mutate(ME.name,"xếp thứ tự việc hôm nay",dt=>{dt.cwOrd=dt.cwOrd||{};dt.cwOrd[ME.id]=keys.concat(rest).slice(0,200)});toast("Đã lưu thứ tự")}})}

/* ---------- 2. VIỆC CỦA TÔI ---------- */
const CW_MY=[
  /* "Cần làm" (chị Hoa 07/11: gộp Hôm nay + Sắp tới): trên là việc hôm nay, quá hạn, đang làm; dưới là việc sắp tới */
  ["today","sun","Cần làm",R=>cwTodayL(R).concat(cwSoonL(R))],
  ["giao","send","Tôi giao",R=>R.filter(r=>cwOpen(r)&&cwGiao(r))],
  ["rv","cc","Chờ duyệt",R=>R.filter(r=>r.rv)],
  ["td","eye","Tôi theo dõi",R=>R.filter(r=>cwOpen(r)&&cwFollow(r))],
  ["nodue","inbox","Chưa có hạn",R=>R.filter(r=>cwOpen(r)&&!r.han&&(cwMine(r)||cwGiao(r)))],
  ["lap","rep","Việc định kỳ",R=>R.filter(r=>r.tpl&&(cwMine(r)||cwGiao(r)))],
  ["done","chk","Hoàn thành",R=>R.filter(r=>!cwOpen(r)&&(cwMine(r)||cwGiao(r)))]];
const CW_MYD={today:"việc cần làm ngay",soon:"Việc của bạn chia theo ngày mai, tuần này, sau đó",giao:"Việc bạn giao cho người khác, việc trễ lên đầu",rv:"Bấm Duyệt hoặc Cần sửa ngay tại dòng",
  td:"Việc người khác làm mà bạn được thêm vào ô Người theo dõi, để biết tiến độ",nodue:"Việc để dành, khi nào làm thì đặt hạn",lap:"Việc tự giao theo mẫu lặp lại hằng ngày, mỗi tuần, mỗi tháng",done:"Việc đã hoàn thành trong tháng này"};
function cwTodayL(R){const td=cwTd();return R.filter(r=>cwOpen(r)&&(cwMine(r)||r.rv||(cwGiao(r)&&r.late))&&(r.late||r.han===td||r.st==="doing"||r.rv))}
/* việc của mình chưa đặt hạn: hiện ngay ở Cần làm, nhãn đỏ, để không bị bỏ sót */
function cwNoDueL(R){return R.filter(r=>cwOpen(r)&&!r.han&&!r.rv&&cwMine(r))}
function cwSoonL(R){const td=cwTd();return R.filter(r=>cwOpen(r)&&cwMine(r)&&r.han>td&&r.st!=="doing"&&!r.rv&&!r.late)}
const cwTodayN=()=>{try{const R=cwRows();return cwTodayL(R).length+cwNoDueL(R).length}catch(e){return 0}};
const cwToday=()=>{const td=cwTd();return CW_THU[cwWd(td)]+" "+dd(td)};
function cwPins(){const T=D().tasks||[],pin=(((D().taskPins||{})[ME.id])||[]).map(id=>T.find(t=>t.id===id)).filter(Boolean);if(!pin.length)return "";
  return `<div class="cwpins">${cwI("pin")}<span>Đã ghim</span>${pin.map(t=>`<button type="button" data-cwpin="${esc(t.id)}" title="${esc(t.ten)}">${esc(cvShort(t.ten,34))}</button>`).join("")}</div>`}
function cwMyList(R,key){const v=CW_MY.find(x=>x[0]===key),L=cwDaF(cwQ(v[3](R))),td=cwTd(),W=WEEKS.find(w=>td>=w.tu&&td<=w.den)||WEEKS[0];
  if(key==="today"){const T0=cwDaF(cwQ(cwTodayL(R))),S0=cwDaF(cwQ(cwSoonL(R))),rv=T0.filter(r=>r.rv),lt=T0.filter(r=>r.late&&!r.rv),ltM=lt.filter(r=>cwMine(r)),ltG=lt.filter(r=>!cwMine(r)),tod=T0.filter(r=>!r.late&&!r.rv),nl=tod.filter(r=>r.tpl).length;
    const sb=(a,z)=>S0.filter(r=>r.han>=a&&r.han<=z),soon=S0.length?`<h4 class="cwsoonh">${cwI("cal")}Sắp tới <span>${S0.length} việc</span></h4>`+[["Ngày mai · "+dd(td+1),sb(td+1,td+1)],["Tuần này",sb(td+2,Math.max(td+1,W.den))],["Sau đó",sb(Math.max(td+1,W.den)+1,99999)]].filter(x=>x[1].length).map(x=>cwSec(x[0],x[1])).join(""):"";
    const nd=cwDaF(cwQ(cwNoDueL(R)));
    return cwPins()+(ltM.length?cwSec(`${cwI("alert")}Quá hạn · việc của tôi`,ltM):"")+(ltG.length?cwSec(`${cwI("send")}Việc tôi giao đang trễ`,ltG,{c:ltG.length+" việc · người khác làm"}):"")+(nd.length?cwSec(`${cwI("alert")}<span class="t-red">Chưa có hạn</span>`,nd,{c:nd.length+" việc · bấm vào để đặt hạn"}):"")+(rv.length?cwSec(`${cwI("cc")}Chờ bạn duyệt`,rv):"")+cwSec(`${cwI("sun")}Hôm nay · đang làm`,tod,{c:`${tod.length} việc${nl?" · "+nl+" việc định kỳ":""}${tod.length>1?" · giữ ⋮⋮ để kéo xếp thứ tự":""}`,empty:"Hôm nay không còn việc nào.",ord:1})+soon+
      `<details class="cwcard cwother" id="cw-other"><summary>${cwI("inbox")}Việc khác đang chờ bạn <small>đơn hàng, kho, kế toán, duyệt video… · bấm để mở</small></summary><div id="cw-wk" class="cwpad"></div></details>`}
  if(key==="giao")return cwSec(`${cwI("alert")}Đang trễ`,L.filter(r=>r.late),{empty:"Không có việc nào trễ."})+cwSec("Đang làm / cần làm",L.filter(r=>!r.late));
  if(key==="lap")return cwSec(v[2],L,{empty:"Chưa có việc định kỳ nào đang chạy."})+(tkGiver()?'<div id="cw-tpl"></div>':"");
  if(key==="rv")return cwRvHtml(L);
  if(key==="done")return cwSec(v[2],L,{sort:X=>X.slice().sort((a,b)=>(b.xong||0)-(a.xong||0)),empty:"Chưa có việc nào xong trong tháng này."});
  return cwSec(v[2],L)}
function cwMy(m){cwCss();PAGE="cv_v";
  /* đường dẫn cũ (Dự án › xem việc, Hiệu suất › bấm tên người, trang Tiến độ/Lịch cũ) đi vào "việc cả team": chuyển sang Phòng ban */
  if(typeof CVV!=="undefined"&&CVV.scope==="team"&&cwMgr()){if(CVF.nguoi){const u=(D().users||[]).find(x=>x.id===CVF.nguoi);CWS.pbW=CVF.nguoi;CWS.pbT=u?cwTeamOfU(u):CWS.pbT}else if(CVF.wt)CWS.pbT=CVF.wt;
    if(CVF.da)CWS.da=CVF.da;CWS.pb=CVF.st==="late"?"late":CVF.st==="review"?"rv":"open";CVF.da="";CVF.st="";CVV.scope="mine";cwPb(m);return}
  if(typeof CVV!=="undefined"){if(CVV.scope==="giao")CWS.my="giao";if(CVF.st==="late"||CVF.st==="review"){CWS.my=CVF.st==="review"?"rv":"today";CVF.st=""}if(CVF.da){CWS.da=CVF.da;CVF.da=""}CVV.view="list";CVV.scope="mine"}
  if(!CW_MY.some(x=>x[0]===CWS.my))CWS.my="today";
  const R=cwRows(),date=CW_DATEKX.includes(CWS.kx);let tabs,title,desc,body;
  if(date){const base=R.filter(r=>CWS.rl==="giao"?cwGiao(r):CWS.rl==="td"?cwFollow(r):cwMine(r));
    tabs=cwTabs([["mine","Tôi làm"],["giao","Tôi giao"],["td","Tôi theo dõi"]].map(([k,l])=>({l,on:CWS.rl===k,attr:`data-cwrl="${k}"`})));
    title="Việc của tôi";
    desc=CWS.kx==="cal"?`Tháng ${MONTH.mon}/${MONTH.year} · việc xếp theo ngày hạn`:CWS.kx==="week"?"Tuần này · việc xếp theo ngày hạn":cwToday()+" · việc hôm nay xếp theo giờ";body=cwView(cwDaF(cwQ(base)))}
  else{tabs=cwTabs(CW_MY.map(([k,ic,l,f])=>{const L=f(R),np=k==="rv"?cwPdRows().length:0;return {l,ic,n:(k==="today"?cwTodayL(R).length:L.length+np)||"",r:L.some(r=>r.late),on:CWS.my===k,attr:`data-cwmy="${k}"`}}));
    const v=CW_MY.find(x=>x[0]===CWS.my);title="Việc của tôi";desc=CWS.my==="today"?cwToday()+" · "+CW_MYD.today:CW_MYD[CWS.my];
    body=CWS.kx==="list"?cwMyList(R,CWS.my):cwView(cwDaF(cwQ(v[3](R))))}
  const daChip=cwDaSel();
  m.innerHTML=cwHead(title,desc)+tabs+`<div class="cwtb">${cwKxSel()}${daChip}<span class="sp"></span></div>`+body;
  cwTop(m);cwBind(m,R);
  m.querySelectorAll("[data-cwmy]").forEach(b=>b.onclick=()=>{CWS.my=b.dataset.cwmy;renderMain();scrollTo(0,0)});
  if(CWS.my==="rv")cwRvBind(m);
  if(typeof PD!=="undefined"&&!PD.at&&typeof pdLoad==="function"&&typeof pdAny==="function"&&pdAny()&&!CWS.pdL){CWS.pdL=1;pdLoad().catch(()=>{})}
  m.querySelectorAll("[data-cwrl]").forEach(b=>b.onclick=()=>{CWS.rl=b.dataset.cwrl;renderMain()});
  /* việc khác từ máy chủ (đơn hàng, kho, kế toán…) như "Việc khác đang chờ bạn" cũ */
  const ow=m.querySelector("#cw-wk");if(ow&&typeof wkEmbed==="function"){WK.noTask=true;try{wkEmbed(ow)}catch(e){console.error("việc khác",e)}finally{WK.noTask=false}
    const nO=WK.items?wkMine().filter(x=>!x.taskId).reduce((z,x)=>z+wkN(x),0):0,dt=m.querySelector("#cw-other");if(nO&&dt){dt.querySelector("summary small").insertAdjacentHTML("beforebegin",`<span class="pill p-amb">${nO}</span>`);if(!m.querySelector(".cwrow"))dt.open=true}}
  const tp=m.querySelector("#cw-tpl");if(tp&&typeof pCvTpl==="function")try{pCvTpl(tp)}catch(e){console.error("mẫu việc",e)}
  try{tkRecur()}catch(e){console.error("việc lặp lại",e)}
}

/* ---------- 3. PHÒNG BAN ---------- */
function cwPbSel(){const T=cwTeams();if(CWS.pbT===null)CWS.pbT=cwBoss()?"":(T.includes(cvTeamNorm(teamOf(ME)))?cvTeamNorm(teamOf(ME)):T[0]||"");
  if(!cwBoss()&&!T.includes(CWS.pbT))CWS.pbT=T[0]||"";if(CWS.pbT&&!T.includes(CWS.pbT))CWS.pbT=cwBoss()?"":T[0]||"";
  if(CWS.pbW&&!(CWS.pbT?cwMembers(CWS.pbT):cwUsers()).some(u=>u.id===CWS.pbW))CWS.pbW="";return {T,team:CWS.pbT,who:CWS.pbW}}
function cwPbScope(R){const w=cwPbSel();R=R.filter(r=>!r.rvOnly&&r.nguoi);
  if(w.who)return R.filter(r=>r.nguoi===w.who||(r.phoi||[]).includes(w.who));
  if(w.team){const ids=new Set(cwMembers(w.team).map(u=>u.id));return R.filter(r=>ids.has(r.nguoi))}
  if(cwBoss())return R;const ids=new Set(w.T.flatMap(k=>cwMembers(k).map(u=>u.id)).concat([ME.id]));return R.filter(r=>ids.has(r.nguoi))}
/* lọc 2 bước: chọn phòng trước, chọn phòng rồi mới hiện người của phòng đó */
function cwWhoSel(idA,idB,team,who){const T=cwTeams(),boss=cwBoss(),o=(boss?[["","Cả công ty"]]:[]).concat(T.map(k=>[k,cwPhongOpt(k,T)])),mem=team?cwMembers(team):[];
  return `<label class="cwfsel">${cwI("filter")}<span>Lọc</span><select id="${idA}" aria-label="Chọn phòng">${opt(o,team)}</select></label>`+
    (team?`<label class="cwfsel">${cwI("users")}<select id="${idB}" aria-label="Chọn người">${opt([["","Cả phòng ("+mem.length+" người)"]].concat(mem.map(u=>[u.id,u.name])),who)}</select></label>`:"")}
const CW_PB=[["open","list","Đang làm / cần làm",S=>S.filter(cwOpen)],["late","alert","Đang trễ",S=>S.filter(r=>cwOpen(r)&&r.late)],["rv","cc","Chờ duyệt",S=>S.filter(r=>r.st==="review")],
  ["nodue","inbox","Chưa có hạn",S=>S.filter(r=>cwOpen(r)&&!r.han)],["done","chk","Hoàn thành",S=>S.filter(r=>r.st==="done")]];
function cwPbTabs(S,cur){const L=(cwMgr()?(CW_DATEKX.includes(CWS.kx)&&cur!=="space"?[{l:"Việc đang mở",ic:"list",on:true,attr:'data-cwpb="open"'}]:CW_PB.map(([k,ic,l,f])=>{const X=S?f(S):[];return {l,ic,n:X.length||"",r:k==="late"?X.length>0:X.some(r=>r.late),on:cur===k,attr:`data-cwpb="${k}"`}})):[]);
  return L.length?cwTabs(L):""}
function cwBulk(L){const S=CWS.sel;return `<section class="cwcard">${S.size?`<div class="cwbulk"><b>Đã chọn ${S.size} việc</b><span class="sp"></span><button type="button" data-cwbk="doing">Đang làm</button><button type="button" data-cwbk="pause">Tạm dừng</button><button type="button" data-cwbk="todo">Cần làm</button><button type="button" data-cwbk="done">Xong</button><button type="button" data-cwbk="han">Dời hạn sang mai</button><button type="button" data-cwbk="ng">Đổi người làm</button><button type="button" data-cwbk="da">Đưa vào dự án</button><button type="button" data-cwbk="clr">Bỏ chọn</button></div>`:""}
  <div class="cwflt"><label><input type="checkbox" class="cwsel" id="cw-selall"${L.length&&L.filter(r=>r.src==="task").every(r=>S.has(r.k))?" checked":""}>Chọn tất cả (${L.filter(r=>r.src==="task").length})</label><span>· tick nhiều việc để đổi trạng thái, dời hạn, đổi người làm cùng lúc</span></div>${cwList(L,{sel:1,flat:1})}</section>`}
function cwBulkDo(k,rows){const X=rows.filter(r=>CWS.sel.has(r.k)).map(cwTask).filter(Boolean);if(k==="clr"){CWS.sel.clear();renderMain();return}if(!X.length)return;const td=cwTd();
  if(k==="doing"||k==="todo"||k==="done"||k==="pause"){let ok=0,bad=0;X.forEach(t=>{const r={src:"task",id:t.id};if(t.st===k)return;if(!cwCanDo(r)||(k==="done"&&tkDoneErr(t))){bad++;return}tkSetSt(t.id,k);ok++});
    toast(`Đã đổi ${ok} việc sang ${cvStN(k)}${bad?` · ${bad} việc không đổi được (cần người giao duyệt hoặc bạn không phụ trách)`:""}`)}
  else if(k==="han"){const E=X.filter(t=>cwCanEdit({src:"task",id:t.id})&&t.st!=="done"),ids=new Set(E.map(t=>t.id));if(!E.length){toast("Bạn không sửa được hạn các việc này");return}
    DB.mutate(ME.name,`dời hạn ${E.length} việc sang ${dd(td+1)}`,dt=>{(dt.tasks||[]).forEach(x=>{if(!ids.has(x.id))return;const old=x.han;tkLog(x,"Dời hạn: "+dd(old)+" → "+dd(td+1));if(old&&old!==td+1)x.hanCu=old;x.han=td+1;if(typeof notifyU==="function")notifyU(dt,[x.nguoi],`${ME.name} đổi hạn việc "${x.ten}" thành ${dd(td+1)}`,"task:"+x.id)})});
    toast(`Đã dời hạn ${E.length} việc sang mai${E.length<X.length?` · ${X.length-E.length} việc không sửa được`:""}`)}
  else if(k==="ng"){cwBulkNg(X);return}
  else if(k==="da"){cwPickDa(X.filter(t=>cwCanEdit({src:"task",id:t.id})).map(t=>t.id));return}
  CWS.sel.clear();renderMain()}
/* đưa việc có sẵn vào dự án (chị Hoa 08/11) — dùng cho thanh tick nhiều việc và nút "Gắn việc có sẵn" trên thẻ dự án */
function cwSetDa(ids,da){const S=new Set(ids);if(!S.size)return 0;let n=0;
  DB.mutate(ME.name,da?`đưa ${S.size} việc vào dự án ${prjN(da)}`:`bỏ ${S.size} việc khỏi dự án`,dt=>{(dt.tasks||[]).forEach(x=>{if(!S.has(x.id)||(x.da||"")===da)return;tkLog(x,da?"Đưa vào dự án: "+prjN(da):"Bỏ khỏi dự án: "+prjN(x.da));x.da=da;n++})});return S.size}
function cwPickDa(ids){if(!ids.length){toast("Bạn không sửa được các việc này");return}const P=(D().projects||[]).filter(p=>p.st!=="done");
  openDrawerHTML(`<h2>Đưa ${ids.length} việc vào dự án</h2><label class="field">Dự án<select id="cw-dapk">${opt([["","— chọn dự án"]].concat(P.map(p=>[p.id,p.ten]),[["__none","Bỏ khỏi dự án"]]),CWS.da||"")}</select></label><div class="acts"><button type="button" class="btn pri" id="cw-dagok">Lưu</button></div>`);
  $("#cw-dagok").onclick=()=>{const v=$("#cw-dapk").value;if(!v){toast("Chọn dự án");return}const da=v==="__none"?"":v;cwSetDa(ids,da);CWS.sel.clear();closeDrawer();toast(da?"Đã đưa vào dự án "+prjN(da):"Đã bỏ khỏi dự án");renderMain()}}
/* thẻ dự án › Gắn việc có sẵn: chọn các việc đang mở (chưa thuộc dự án này) để gắn vào */
function cwAttachDa(da){const td=cwTd(),L=(D().tasks||[]).filter(t=>t.st!=="done"&&t.da!==da&&cwCanEdit({src:"task",id:t.id})).sort((a,b)=>(a.da?1:0)-(b.da?1:0)||(a.han||9999)-(b.han||9999));
  const row=t=>`<label class="ck cwatt" data-q="${esc((t.ten+" "+(userName(t.nguoi)||"")).toLowerCase())}"><input type="checkbox" value="${esc(t.id)}"> <span><b>${esc(t.ten)}</b><small>${esc(userName(t.nguoi)||"chưa giao")}${t.han?" · hạn "+dd(t.han):""}${t.da?" · đang ở dự án "+esc(prjN(t.da)):""}</small></span></label>`;
  openDrawerHTML(`<h2>Gắn việc có sẵn vào dự án</h2><p class="hint">${esc(prjN(da))} · chọn các việc đang làm / cần làm để đưa vào dự án</p><input id="cw-attq" placeholder="Tìm việc, tên người…" autocomplete="off"><div class="cwattl">${L.map(row).join("")||'<p class="empty">Không có việc nào để gắn.</p>'}</div><div class="acts"><button type="button" class="btn pri" id="cw-attok">Gắn vào dự án</button></div>`);
  const q=$("#cw-attq");q.oninput=()=>{const v=q.value.trim().toLowerCase();document.querySelectorAll(".cwattl .cwatt").forEach(x=>x.hidden=!!v&&!x.dataset.q.includes(v))};
  $("#cw-attok").onclick=()=>{const ids=[...document.querySelectorAll(".cwattl input:checked")].map(x=>x.value);if(!ids.length){toast("Chọn ít nhất 1 việc");return}cwSetDa(ids,da);closeDrawer();toast(`Đã gắn ${ids.length} việc vào dự án`);renderMain()}}
function cwBulkNg(X){const E=X.filter(t=>cwCanEdit({src:"task",id:t.id})&&!(t.cd&&t.cd.length));if(!E.length){toast("Bạn không đổi được người làm các việc này");return}
  const users=tkAssignable(D().users.filter(u=>u.active&&u.role!=="admin"||u.id===ME.id));
  openDrawerHTML(`<h2>Đổi người làm ${E.length} việc</h2><p class="hint">${E.slice(0,6).map(t=>esc(t.ten)).join("<br>")}${E.length>6?"<br>…":""}</p><label class="field">Người làm mới<select id="cw-ng">${opt([["","— chọn người"]].concat(users.map(u=>[u.id,u.name+" · "+(TEAMS[teamOf(u)]||u.phongBan||"Quản lý")])),"")}</select></label><div class="acts"><button type="button" class="btn pri" id="cw-ngok">Đổi người làm</button></div>`);
  $("#cw-ngok").onclick=()=>{const to=$("#cw-ng").value;if(!to){toast("Chọn người làm");return}const ids=new Set(E.map(t=>t.id));
    DB.mutate(ME.name,`đổi người làm ${E.length} việc → ${userName(to)}`,dt=>{(dt.tasks||[]).forEach(x=>{if(!ids.has(x.id)||x.nguoi===to)return;tkLog(x,"Đổi người làm: "+(userName(x.nguoi)||"—")+" → "+userName(to));x.nguoi=to;if(typeof notifyU==="function")notifyU(dt,[to],`${ME.name} giao bạn việc "${x.ten}"${x.han?" · hạn "+dd(x.han):""}`,"task:"+x.id)})});
    CWS.sel.clear();closeDrawer();toast("Đã đổi người làm");renderMain()}}
function cwPb(m){cwCss();if(!cwMgr()){PAGE="cv_pb";PAGES.cv_pb(m);return}PAGE="cv_pbv";if(!CW_PB.some(x=>x[0]===CWS.pb))CWS.pb="open";
  const R=cwRows(),w=cwPbSel(),S=cwDaF(cwPbScope(R)),date=CW_DATEKX.includes(CWS.kx),td=cwTd(),mon=td-cwWd(td);
  const v=CW_PB.find(x=>x[0]===CWS.pb),L=cwQ(date?S.filter(r=>cwOpen(r)||(r.xong&&r.xong>=mon)):v[3](S));
  const scopeN=w.who?userName(w.who):w.team?cwPhong(w.team):"Cả công ty";
  const daChip=cwDaSel();
  m.innerHTML=cwHead("Phòng ban",`Việc của từng phòng ban và từng nhân sự · đang xem: ${esc(scopeN)}`)+cwPbTabs(S,date?"open":CWS.pb)+
    `<div class="cwtb">${cwKxSel()}${cwWhoSel("cw-pbt","cw-pbw",w.team,w.who)}${daChip}<span class="sp"></span></div>`+(CWS.kx==="list"?cwBulk(cwSort(L)):cwView(L));
  cwTop(m);cwBind(m,R);
  m.querySelectorAll("[data-cwpb]").forEach(b=>b.onclick=()=>{const k=b.dataset.cwpb;CWS.sel.clear();if(k==="space"){cwGo("cv_pb");return}CWS.pb=k;if(PAGE!=="cv_pbv")cwGo("cv_pbv");else{renderMain();scrollTo(0,0)}});
  const a=m.querySelector("#cw-pbt");if(a)a.onchange=()=>{CWS.pbT=a.value;CWS.pbW="";CWS.sel.clear();renderMain()};
  const b2=m.querySelector("#cw-pbw");if(b2)b2.onchange=()=>{CWS.pbW=b2.value;CWS.sel.clear();renderMain()};
  /* ô Lọc (phòng, người) đưa lên cạnh tên trang "Phòng ban" ở thanh trên cùng */
  {const ph=m.querySelector(":scope>.cwph");if(ph)m.querySelectorAll(".cwtb .cwfsel").forEach(x=>ph.append(x))}
  m.querySelectorAll("[data-cwsel]").forEach(c=>c.onchange=()=>{c.checked?CWS.sel.add(c.dataset.cwsel):CWS.sel.delete(c.dataset.cwsel);renderMain()});
  const sa=m.querySelector("#cw-selall");if(sa)sa.onchange=()=>{L.filter(r=>r.src==="task").forEach(r=>sa.checked?CWS.sel.add(r.k):CWS.sel.delete(r.k));renderMain()};
  m.querySelectorAll("[data-cwbk]").forEach(b=>b.onclick=()=>cwBulkDo(b.dataset.cwbk,L));
}
/* trang "Thư mục công việc" (trang Không gian phòng cũ, khonggian.js): mục riêng ở thanh bên, dưới Dự án */
function cwPbSpace(m,old){cwCss();
  m.innerHTML=cwHead("Thư mục công việc","",{btns:false})+'<div id="cw-body"></div>';cwTop(m);
  if(typeof KPB!=="undefined"&&(!KPB.doc||KPB.doc==="tpl"))KPB.doc="sop";
  const body=m.querySelector("#cw-body");old(body);
  /* chỉ giữ Thư mục công việc (Drive) và Mẫu tài liệu & SOP; việc, người, dự án, trao đổi đã có ở mục khác */
  body.querySelectorAll(".kgk,[data-kgdt=\"tpl\"]").forEach(x=>x.remove());
  body.querySelectorAll("section.kgs").forEach(sc=>{const h=sc.querySelector("h3"),t=h?h.textContent:"";if(/Thư mục Drive/.test(t))h.textContent="📁 Thư mục công việc";else if(/Mẫu & SOP/.test(t))h.textContent="🧩 Mẫu tài liệu & SOP";else sc.remove()})}

/* ---------- CHỜ DUYỆT: gộp việc, video và khoản của trang Phê duyệt (phiếu chi, tiền về, hàng trả, sửa phiếu kho, combo…) vào một tab ----------
   Duyệt / Cần sửa gọi đúng hàm của pheduyet.js (pdAct), máy chủ vẫn kiểm quyền như cũ. Chị Hoa duyệt demo 05/11. */
const cwPdRows=()=>{try{return typeof pdAny==="function"&&pdAny()&&typeof PD!=="undefined"&&PD.sv?pdMine(pdRows()):[]}catch(e){console.warn("phê duyệt",e);return []}};
/* phiếu chi mình lập: đang chờ ai, bị trả lại vì sao, đã duyệt (7 ngày gần nhất) */
function cwSent(){const d=D(),me=ME.name,wk=Date.now()-7*864e5,out=[];
  (d.pcCho||[]).filter(x=>x.by===me).forEach(x=>out.push({x,st:"cho",lb:x.ceoCho?"Chờ CEO duyệt":"Chờ Kế toán trưởng duyệt",at:x.ktAt||x.at}));
  (d.pcTra||[]).filter(x=>x.by===me&&(x.traAt||0)>wk).forEach(x=>out.push({x,st:"sua",lb:"Cần sửa",at:x.traAt,ly:(x.traBy||"")+(x.lyDo?": "+x.lyDo:"")}));
  (((d.fin||{}).nkc)||[]).filter(x=>x.by===me&&x.duyet&&x.duyet!==me&&(x.duyetAt||0)>wk).forEach(x=>out.push({x,st:"ok",lb:"Đã duyệt",at:x.duyetAt,ly:x.duyet}));
  return out.sort((a,b)=>(b.at||0)-(a.at||0))}
function cwRvHtml(L){const P=cwPdRows(),S=cwSent(),now=Date.now(),th=typeof pdTh==="function"?pdTh():5e6;if(CWS.rvV==="gui"&&!S.length)CWS.rvV="can";
  const n=P.length+L.length,seg=S.length?`<div class="cwseg cwrvseg"><button type="button" class="${CWS.rvV!=="gui"?"on":""}" data-cwrvv="can">Cần tôi duyệt (${n})</button><button type="button" class="${CWS.rvV==="gui"?"on":""}" data-cwrvv="gui">Tôi gửi (${S.length})</button></div>`:"";
  const KC={chi:"c-chi",tien:"c-thu",thu:"c-thu",hoan:"c-tra",xuat:"c-kho",combo:"c-cb",cbdx:"c-cb",thuong:"c-chi",mh:"c-kho"};
  const chip=(k,t)=>`<span class="cwrvc ${KC[k]||""}">${esc(t)}</span>`,money=v=>v?nf(v)+" đ":"";
  if(CWS.rvV==="gui")return seg+`<section class="cwcard"><h3>${cwI("send")}Phiếu tôi đã gửi<span class="c">trạng thái tự cập nhật khi người duyệt bấm</span></h3>${S.map(o=>`<div class="cwrv" data-cwsent="${esc(o.x.id)}">${chip("chi","Phiếu chi")}<div class="tt"><b>${esc(o.x.dg||"")}</b><small>${esc([o.x.ct,o.ly].filter(Boolean).join(" · "))}</small></div><div class="mn${+o.x.t>=th?" big":""}">${money(+o.x.t)}</div><div class="who">${esc(pdAge(o.at,now)||"")}</div><div class="ac"><span class="cwrvst ${o.st}">${esc(o.lb)}</span></div></div>`).join("")}</section>`;
  const busy=r=>typeof PD!=="undefined"&&PD.doing&&PD.doing[r.id];
  const pd=P.length?`<section class="cwcard"><h3>💰 Tiền & chứng từ<span class="c">${P.length} khoản · bấm dòng để xem chứng từ gốc</span></h3>${P.map((r,i)=>{const noRej=["costsCho","thuCho","payment","return","mhLech"].includes(r.src),old=r.at&&now-r.at>3*864e5;
    const btn=r.act?`<button type="button" class="btn sm pri" data-cwpdok="${i}"${busy(r)?" disabled":""}>${esc(r.ok||"Duyệt")}</button>${noRej?"":`<button type="button" class="btn sm" data-cwpdno="${i}"${busy(r)?" disabled":""}>Cần sửa</button>`}`:`<span class="hint">mở để duyệt</span>`;
    return `<div class="cwrv" data-cwpdgo="${i}">${chip(r.k,PD_KIND_N(r.k))}<div class="tt"><b>${esc(r.nd||"")}</b><small>${esc([r.loai!==PD_KIND_N(r.k)?r.loai:"",r.sub].filter(Boolean).join(" · "))}</small></div><div class="mn${r.tien>=th&&r.k==="chi"?" big":""}">${money(r.tien)}</div><div class="who">${esc(r.by||"")}<small class="${old?"late":""}">${r.at?"chờ "+esc(pdAge(r.at,now)):""}</small></div><div class="ac">${btn}</div></div>`}).join("")}</section>`
    :(typeof PD!=="undefined"&&typeof pdAny==="function"&&pdAny()&&!PD.sv?`<p class="hint">Đang tải phiếu chi, tiền về chờ duyệt…</p>`:"");
  return seg+pd+cwSec(`${cwI("cc")}Việc, video, kịch bản`,L,{empty:"Không có việc nào chờ duyệt."})}
function cwRvBind(m){const P=cwPdRows();
  m.querySelectorAll("[data-cwrvv]").forEach(b=>b.onclick=()=>{CWS.rvV=b.dataset.cwrvv;renderMain()});
  m.querySelectorAll("[data-cwpdok]").forEach(b=>b.onclick=e=>{e.stopPropagation();const r=P[+b.dataset.cwpdok];if(r)pdAct(r,true)});
  m.querySelectorAll("[data-cwpdno]").forEach(b=>b.onclick=e=>{e.stopPropagation();const r=P[+b.dataset.cwpdno];if(r)pdAct(r,false)});
  m.querySelectorAll(".cwrv[data-cwpdgo]").forEach(b=>b.onclick=()=>{const r=P[+b.dataset.cwpdgo];if(r)cwPdOpen(r)});
  m.querySelectorAll("[data-cwsent]").forEach(b=>b.onclick=()=>{const id=b.dataset.cwsent,d=D(),x=(d.pcCho||[]).find(y=>y.id===id)||(d.pcTra||[]).find(y=>y.id===id)||(((d.fin||{}).nkc)||[]).find(y=>y.id===id);if(x&&typeof scPhieu==="function")scPhieu(x,true)})}
/* mở chứng từ gốc: phiếu chi, hàng lệch mở ngay; trang gốc khác mở trong trang Phê duyệt với nút quay lại Chờ duyệt */
function cwPdOpen(r){if(r.src==="pcCho"||r.src==="mhLech"){pdOpen(r);return}
  PD.view={...(r.open||{}),t:r.loai+" · "+r.nd};CWS.pdFrom=1;if(typeof NAV_AN_MO!=="undefined")NAV_AN_MO.add("pheduyet");MOD="";PAGE="pheduyet";render();scrollTo(0,0)}
if(typeof PAGES!=="undefined"&&PAGES.pheduyet){const _pd=PAGES.pheduyet;PAGES.pheduyet=m=>{_pd(m);if(CWS.pdFrom&&typeof PD!=="undefined"&&PD.view){const b=m.querySelector("#pd-back");if(b){b.textContent="← Về Chờ duyệt";b.onclick=()=>{PD.view=null;CWS.pdFrom=0;CWS.my="rv";cwGo("cv_v")}}}else CWS.pdFrom=0}}
/* tải xong danh sách phê duyệt thì vẽ lại tab Chờ duyệt (pdLoad gốc chỉ vẽ lại trang Phê duyệt) */
if(typeof pdLoad==="function"){const _pdL=pdLoad;pdLoad=async function(f){const r=await _pdL.apply(this,arguments);if(PAGE==="cv_v"&&MOD==="cv"&&CWS.my==="rv")renderMain();return r}}

/* ---------- 4. DỰ ÁN (tab Dự án · Mục tiêu) ---------- */
function cwDaFrame(m,tab,inner){cwCss();
  m.innerHTML=cwHead(tab==="mt"?"Mục tiêu":"Dự án",tab==="mt"?"Mục tiêu tháng của từng người, từng phòng":"Mỗi dự án gồm nhiều việc, tiến độ tự tính từ số việc xong",{btns:false})+
    cwTabs([{l:"Dự án",ic:"fold",on:tab!=="mt",attr:'data-cwda="cv_da"'},{l:"Mục tiêu",ic:"target",on:tab==="mt",attr:'data-cwda="cv_mt"'}])+'<div id="cw-body"></div>';cwTop(m);
  m.querySelectorAll("[data-cwda]").forEach(b=>b.onclick=()=>{if(b.dataset.cwda!==PAGE)cwGo(b.dataset.cwda)});
  try{inner(m.querySelector("#cw-body"))}catch(e){console.error("Dự án / mục tiêu lỗi",e);m.querySelector("#cw-body").innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> ${esc(String(e&&e.message||e))}</div>`}
  /* ô tìm, bộ lọc, nút Thêm dự án đưa lên cùng hàng tab, bên phải */
  const nv=m.querySelector(":scope>.cwtabs"),bar=m.querySelector("#cw-body>.cvbar");
  if(nv&&bar){let w=m.querySelector(":scope>.cwtop");if(!w){w=document.createElement("div");w.className="cwtop";nv.before(w);w.append(nv)}bar.classList.add("cwtopbar");w.append(bar)}}

/* ---------- 1. TỔNG QUAN (Của tôi · Phòng / Cả công ty) ---------- */
/* số liệu tính từ việc giao (Task giao việc): việc tháng này + việc đã xong các tháng trước (lưu trữ), đổi về cùng cách đánh số ngày */
function cwStat(){const d=D(),base=new Date(MONTH.year,MONTH.mon-1,1),out=[];
  const add=(t,off)=>{if(!t||!t.nguoi||CV_TEST.includes(t.nguoi))return;out.push({nguoi:t.nguoi,tao:t.tao||"",han:+t.han?+t.han+off:0,st:t.st,xong:+t.xongNgay?+t.xongNgay+off:0,tu:!!t.tuThem||(!!t.tao&&t.tao===t.nguoi)})};
  (d.tasks||[]).forEach(t=>add(t,0));
  ((d.luuTru||{}).tasks||[]).forEach(t=>{const k=/^(\d{4})-(\d{2})$/.exec(t.thang||"");if(!k)return;add(t,Math.round((new Date(+k[1],+k[2]-1,1)-base)/864e5))});
  return out}
const cwDayOf=dt=>Math.round((new Date(dt.getFullYear(),dt.getMonth(),dt.getDate())-new Date(MONTH.year,MONTH.mon-1,1))/864e5)+1;
function cwPer(p){const td=cwTd(),mon=td-cwWd(td);
  if(p==="tuan")return {a:mon,b:mon+6,pa:mon-7,pb:td-7,lb:`Tuần này (${dd(mon)} – ${dd(mon+6)})`,pv:"tuần trước",B:[0,1,2,3,4,5,6].map(i=>[CW_THU[i].replace("Thứ ","T"),mon+i,mon+i]),bl:"ngày"};
  if(p==="quy"){const q0=Math.floor((MONTH.mon-1)/3)*3,a=cwDayOf(new Date(MONTH.year,q0,1)),b=cwDayOf(new Date(MONTH.year,q0+3,0)),pa=cwDayOf(new Date(MONTH.year,q0-3,1));
    return {a,b,pa,pb:pa+(td-a),lb:`Quý ${q0/3+1}/${MONTH.year}`,pv:"quý trước",B:[0,1,2].map(i=>{const x=new Date(MONTH.year,q0+i,1);return ["Tháng "+(x.getMonth()+1),cwDayOf(x),cwDayOf(new Date(MONTH.year,q0+i+1,0))]}),bl:"tháng"}}
  const pn=new Date(MONTH.year,MONTH.mon-1,0).getDate();
  return {a:1,b:MONTH.ndays,pa:1-pn,pb:Math.min(td,pn)-pn,lb:`Tháng ${MONTH.mon}/${MONTH.year}`,pv:"tháng trước",B:WEEKS.map(w=>["Tuần "+w.w,w.tu,w.den]),bl:"tuần"}}
const cwDoneIn=(A,a,b)=>A.filter(t=>t.st==="done"&&t.xong>=a&&t.xong<=b);
const cwOtp=X=>X.length?Math.round(X.filter(t=>!t.han||t.xong<=t.han).length/X.length*100):null;
const cwPct=v=>v===null?"—":v+"%";
function cwBars(A,P){const td=cwTd(),B=P.B.map(([l,x,y])=>{const X=cwDoneIn(A,x,y),ok=X.filter(t=>!t.han||t.xong<=t.han).length;return {l,ok,tre:X.length-ok,fut:x>td}});
  const mx=Math.max(4,...B.map(c=>c.ok+c.tre)),W=640,H=170,gx=(W-40)/B.length,bw=Math.min(56,gx-18);
  return `<svg viewBox="0 0 ${W} ${H+26}" style="width:100%;height:auto;display:block">${[0,.5,1].map(f=>`<line x1="30" x2="${W}" y1="${H-f*H+4}" y2="${H-f*H+4}" stroke="#eef0f5"/><text x="24" y="${H-f*H+8}" font-size="10" fill="#9aa0ae" text-anchor="end">${Math.round(f*mx)}</text>`).join("")}
   ${B.map((c,i)=>{const x=40+i*gx+(gx-bw)/2,h1=c.ok/mx*H,h2=c.tre/mx*H;return `<g data-cwbar="${esc(c.l)}: ${c.ok} đúng hạn · ${c.tre} trễ"><rect x="${x-6}" y="0" width="${bw+12}" height="${H+4}" fill="transparent"/>
   ${h1?`<rect x="${x}" y="${H+4-h1}" width="${bw}" height="${h1}" rx="${h2?0:4}" fill="#2f9e5b"/>`:""}${h2?`<rect x="${x}" y="${H+4-h1-h2-(h1?2:0)}" width="${bw}" height="${h2}" rx="4" fill="#e05252"/>`:""}
   ${c.fut&&!h1&&!h2?`<text x="${x+bw/2}" y="${H-4}" font-size="10" fill="#b5b9c6" text-anchor="middle">chưa tới</text>`:""}<text x="${x+bw/2}" y="${H+20}" font-size="11" fill="#6b7385" text-anchor="middle">${esc(c.l)}</text></g>`}).join("")}</svg>`}
const cwChart=(t,A,P)=>`<section class="cwcard"><h3>${cwI("up")}${t}</h3><div class="cwlg" style="padding:8px 14px 0;margin:0"><span><i style="background:#2f9e5b"></i>Đúng hạn</span><span><i style="background:#e05252"></i>Trễ hạn</span></div><div class="cwchart">${cwBars(A,P)}<div class="cwtip"></div></div></section>`;
const cwCmp=(l,v,w,c,suf)=>`<div class="cwcmp"><span>${l}</span><em><i style="width:${Math.max(0,Math.min(100,w))}%;background:${c}"></i></em><b>${v}${suf||""}</b></div>`;
const cwPerSeg=()=>`<div class="cwseg" role="group" aria-label="Kỳ">${[["tuan","Tuần"],["thang","Tháng"],["quy","Quý"]].map(([k,l])=>`<button type="button" class="${CWS.per===k?"on":""}" data-cwper="${k}">${l}</button>`).join("")}</div>`;
function cwPerf(){const P=cwPer(CWS.per),td=cwTd(),me=ME.id,S=cwStat(),A=S.filter(t=>t.nguoi===me),D0=cwDoneIn(A,P.a,P.b),PD=cwDoneIn(A,P.pa,P.pb);
  const o=cwOtp(D0),po=cwOtp(PD),tu=D0.filter(t=>t.tu),dg=D0.filter(t=>!t.tu),lt=A.filter(t=>t.st!=="done"&&t.han&&t.han<td),rest=A.filter(t=>t.st!=="done");
  const tm=cwTeamOfU(ME),TA=S.filter(t=>t.nguoi!==me&&cwTeamOfU(userBy(t.nguoi))===tm),TD0=cwDoneIn(TA,P.a,P.b),np=[...new Set(TD0.map(t=>t.nguoi))].length,tavg=np?Math.round(TD0.length/np):0,to=cwOtp(TD0);
  const mxN=Math.max(D0.length,tavg,1);
  return `<div class="cwtb"><span class="sp"></span>${cwPerSeg()}</div>
  <div class="cwkp k4"><div><small>${cwI("chk")}Việc đã xong</small><b style="color:#2f9e5b">${D0.length}</b><i>cùng kỳ ${P.pv} ${PD.length}</i></div><div><small>${cwI("target")}Đúng hạn</small><b>${cwPct(o)}</b><i>cùng kỳ ${P.pv} ${cwPct(po)}</i></div>
   <div><small>${cwI("alert")}Đang trễ</small><b style="color:#d93a3a">${lt.length}</b><i>cần làm ngay</i></div><div><small>${cwI("list")}Còn phải làm</small><b>${rest.length}</b><i>đang làm + cần làm + chờ duyệt</i></div></div>
  <div class="cwtwo">${cwChart("Việc tôi xong theo "+P.bl,A,P)}
   <div><section class="cwcard"><h3>${cwI("users")}So với trung bình ${tm&&tm!=="all"?esc(cwPhong(tm).replace(/^Phòng /,"phòng ")):"phòng"}<span class="c">không hiện tên người khác</span></h3><div class="cwpad">${np?cwCmp("Việc xong · tôi",D0.length,D0.length/mxN*100,"var(--nv-active,#4b54d1)")+cwCmp("Việc xong · TB phòng",tavg,tavg/mxN*100,"#c9c3ef")+cwCmp("Đúng hạn · tôi",cwPct(o),o||0,"#2f9e5b")+cwCmp("Đúng hạn · TB phòng",cwPct(to),to||0,"#a9dcbd"):`<p class="cwempty" style="padding:0">${tm==="all"?"CEO không thuộc phòng nào, so sánh các phòng ở tab Công ty.":"Phòng chưa có ai khác xong việc trong kỳ này để so."}</p>`}</div></section>
   </div></div>
  <div class="cwef">${typeof hsEffHtml==="function"?hsEffHtml(D(),td,cwEffU(),cwEffP(P)):""}</div>`}
/* biểu đồ đường "Việc được giao" / "Việc tự giao" (hsEffHtml ở congviec.js) cho chính mình, theo kỳ đang chọn */
const cwEffU=()=>cwStat().filter(t=>t.nguoi===ME.id).map(t=>({ng:t.nguoi,han:t.han,st:t.st,xn:t.xong,tu:t.tu}));
const cwEffP=P=>({a:P.a,b:P.b,lb:P.lb});
function cwOvSel(){const T=cwTeams();if(CWS.ovT===null)CWS.ovT=cwBoss()?"":(T.includes(cvTeamNorm(teamOf(ME)))?cvTeamNorm(teamOf(ME)):T[0]||"");if(!cwBoss()&&!T.includes(CWS.ovT))CWS.ovT=T[0]||"";if(CWS.ovT&&!T.includes(CWS.ovT))CWS.ovT=cwBoss()?"":T[0]||"";
  if(CWS.ovW&&!cwMembers(CWS.ovT).some(u=>u.id===CWS.ovW))CWS.ovW="";return {T,team:CWS.ovT,who:CWS.ovW}}
function cwDash(){const P=cwPer(CWS.per),td=cwTd(),w=cwOvSel(),boss=cwBoss();
  const ids=w.who?new Set([w.who]):w.team?new Set(cwMembers(w.team).map(u=>u.id)):boss?null:new Set(w.T.flatMap(k=>cwMembers(k).map(u=>u.id)));
  const adm=new Set((D().users||[]).filter(u=>u.role==="admin").map(u=>u.id)),A=cwStat().filter(t=>!adm.has(t.nguoi)&&(!ids||ids.has(t.nguoi)));
  const inP=t=>t.han>=P.a&&t.han<=P.b,PA=A.filter(inP),dn=cwDoneIn(A,P.a,P.b),pdn=cwDoneIn(A,P.pa,P.pb),op=A.filter(t=>t.st!=="done");
  const lt=op.filter(t=>t.han&&t.han<td),d3=op.filter(t=>t.han>=td&&t.han<=td+3),d7=op.filter(t=>t.han>=td&&t.han<=td+7),doing=op.filter(t=>t.st==="doing");
  const pct=PA.length?Math.round(PA.filter(t=>t.st==="done").length/PA.length*100):0,ot=cwOtp(dn),ch=pdn.length?Math.round((dn.length/pdn.length-1)*100):null;
  const people=[...new Set(A.map(t=>t.nguoi))].map(p=>{const X=A.filter(t=>t.nguoi===p),Dn=cwDoneIn(X,P.a,P.b);return {p,g:X.filter(inP).length,d:Dn.length,o:cwOtp(Dn),l:X.filter(t=>t.st!=="done"&&t.han&&t.han<td).length,doing:X.filter(t=>t.st==="doing").length}}).filter(r=>r.g||r.d||r.l).sort((x,y)=>y.l-x.l||(x.o===null?101:x.o)-(y.o===null?101:y.o));
  const grpBy=!w.who&&(!w.team||w.team==="mkt")?"team":"ng",gk=u=>{const k=cwTeamOfU(u);return w.team==="mkt"?k:cwPhKey(k)},bars=(grpBy==="team"?[...new Set(A.map(t=>gk(userBy(t.nguoi))).filter(Boolean))].map(k=>{const Dn=cwDoneIn(A.filter(t=>gk(userBy(t.nguoi))===k),P.a,P.b);return [w.team==="mkt"&&k==="mkt"?"Trưởng phòng":cvTeamName(k),Dn.length,cwOtp(Dn)]})
    :people.map(r=>{const Dn=cwDoneIn(A.filter(t=>t.nguoi===r.p),P.a,P.b);return [userName(r.p),Dn.length,cwOtp(Dn)]})).filter(x=>x[1]).sort((x,y)=>y[1]-x[1]),bmx=Math.max(1,...bars.map(x=>x[1]));
  const oc=o=>o===null?"var(--muted,#6b7385)":o>=80?"#2f9e5b":o>=60?"#a86a12":"#d93a3a";
  return `<div class="cwtb">${cwWhoSel("cw-ovt","cw-ovw",w.team,w.who)}<span class="hint">${esc(P.lb)} · tự đếm từ việc đã giao</span><span class="sp"></span>${cwPerSeg()}</div>
  <div class="cwkp"><div><small>${cwI("list")}Tổng việc</small><b>${PA.length}</b><i>hạn trong kỳ</i></div><div><small>${cwI("chk")}Đã xong</small><b style="color:#2f9e5b">${dn.length}</b><i>xong trong kỳ</i></div><div><small>${cwI("hour")}Đang làm</small><b style="color:#2a78d6">${doing.length}</b><i>hiện tại</i></div>
   <div><small>${cwI("alert")}Quá hạn</small><b style="color:#d93a3a">${lt.length}</b><i>hiện tại</i></div><div><small>${cwI("clock")}Hạn 3 ngày</small><b>${d3.length}</b><i>chưa xong</i></div><div><small>${cwI("cal")}Hạn 7 ngày</small><b>${d7.length}</b><i>chưa xong</i></div></div>
  <div class="cwhero"><div><small>${esc(P.lb)}, đã hoàn thành</small><div class="big">${dn.length} <span style="font-size:15px;font-weight:500;color:var(--muted,#6b7385)">việc</span></div>
   <small style="color:${ch===null?"var(--muted,#6b7385)":ch>=0?"#2f9e5b":"#d93a3a"}">${ch===null?"chưa có kỳ trước để so":(ch>=0?"tăng ":"giảm ")+Math.abs(ch)+"% so với cùng kỳ "+P.pv+" ("+pdn.length+" việc)"}</small></div>
   <div style="flex:1;min-width:220px"><div class="bar"><i style="width:${pct}%"></i></div><small>${pct}% việc có hạn trong kỳ đã xong (${PA.filter(t=>t.st==="done").length}/${PA.length})</small></div>
   <div style="text-align:right"><b style="font-size:22px">${cwPct(ot)}</b><br><small>đúng hạn</small></div></div>
  <div class="cwtwo">${cwChart("Việc xong theo "+P.bl,A,P)}
   <section class="cwcard"><h3>${cwI("users")}${grpBy==="team"?"Theo phòng ban":"Theo người"}<span class="c">việc xong · % đúng hạn</span></h3><div class="cwpad">${bars.map(([n,v,o])=>`<div class="cwcmp"><span>${esc(n)}</span><em><i style="width:${v/bmx*100}%;background:var(--nv-active,#4b54d1)"></i></em><b>${v}</b><b style="color:${oc(o)}">${cwPct(o)}</b></div>`).join("")||'<p class="cwempty" style="padding:0">Chưa có việc xong trong kỳ.</p>'}</div></section></div>
  <section class="cwcard"><h3>${cwI("users")}Từng người<span class="c">người trễ nhiều lên đầu${cwMgr()?" · bấm để xem việc":""}</span></h3><div style="overflow:auto"><table class="cwtbl"><thead><tr><th>Người làm</th><th>Phòng</th><th class="n">Việc trong kỳ</th><th class="n">Đã xong</th><th>Đúng hạn</th><th class="n">Đang làm</th><th class="n">Đang trễ</th></tr></thead><tbody>
   ${people.map(r=>`<tr${cwMgr()?` class="clk" data-cwpp="${esc(r.p)}"`:""}><td>${avatar(r.p)}${esc(userName(r.p)||"—")}</td><td>${esc(cvTeamName(cwTeamOfU(userBy(r.p)))||"—")}</td><td class="n">${r.g}</td><td class="n">${r.d}</td><td>${r.o===null?"—":`<span class="cwmini"><i style="width:${r.o}%;background:${oc(r.o)}"></i></span>${r.o}%`}</td><td class="n">${r.doing}</td><td class="n"${r.l?' style="color:#d93a3a;font-weight:700"':""}>${r.l}</td></tr>`).join("")||'<tr><td colspan="7" class="cwempty">Chưa có việc nào trong kỳ.</td></tr>'}</tbody></table></div></section>`}
function cwOv(m){cwCss();PAGE="cv_ov";if(!cwDashOk())CWS.ov="me";
  const T=cwTeams(),lb=cwBoss()?"Công ty":T.length===1?cwPhong(T[0]):"Phòng ban";
  m.innerHTML=cwHead("Tổng quan",CWS.ov==="dash"?"Tiến độ việc của "+(cwBoss()?"cả công ty, từng phòng, từng người":"phòng, từng người"):"Bạn làm được tới đâu: xong bao nhiêu việc, bao nhiêu % đúng hạn",{search:false})+
    cwTabs([{l:"Của tôi",ic:"sun",on:CWS.ov==="me",attr:'data-cwov="me"'}].concat(cwDashOk()?[{l:lb,ic:"users",on:CWS.ov==="dash",attr:'data-cwov="dash"'}]:[]))+(CWS.ov==="dash"?cwDash():cwPerf());
  cwBind(m);
  cwTop(m);if(CWS.ov!=="dash"&&typeof hsEffBind==="function")try{hsEffBind(m,D(),cwTd(),cwEffU(),cwEffP(cwPer(CWS.per)))}catch(e){console.error("biểu đồ hiệu quả",e)}
  m.querySelectorAll("[data-cwov]").forEach(b=>b.onclick=()=>{CWS.ov=b.dataset.cwov;renderMain()});
  m.querySelectorAll("[data-cwper]").forEach(b=>b.onclick=()=>{CWS.per=b.dataset.cwper;renderMain()});
  const a=m.querySelector("#cw-ovt");if(a)a.onchange=()=>{CWS.ovT=a.value;CWS.ovW="";renderMain()};
  const b2=m.querySelector("#cw-ovw");if(b2)b2.onchange=()=>{CWS.ovW=b2.value;renderMain()};
  m.querySelectorAll("[data-cwpp]").forEach(r=>r.onclick=()=>{const u=userBy(r.dataset.cwpp);CWS.pbT=u?cwTeamOfU(u):CWS.pbT;CWS.pbW=r.dataset.cwpp;CWS.pb="open";CWS.kx="list";cwGo("cv_pbv")});
}

/* ---------- 5. NHẬT KÝ: gom nhật ký của từng việc (t.log) ---------- */
function cwAt(s){s=String(s||"");const tm=/(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s),dm=/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(s);if(!dm)return 0;
  return new Date(+(dm[3]||MONTH.year),+dm[2]-1,+dm[1],tm?+tm[1]:0,tm?+tm[2]:0,tm&&tm[3]?+tm[3]:0).getTime()}
function cwLogSee(t){if(cwBoss())return true;if(t.nguoi===ME.id||t.tao===ME.id||(t.phoi||[]).includes(ME.id))return true;
  if(cwMgr()){const ids=new Set(cwTeams().flatMap(k=>cwMembers(k).map(u=>u.id)));return ids.has(t.nguoi)}return false}
function cwNk(m){cwCss();PAGE="cv_nk";const E=[];
  (D().tasks||[]).filter(t=>!CV_TEST.includes(t.nguoi)&&cwLogSee(t)).forEach(t=>(t.log||[]).forEach(l=>E.push({at:l.at,ts:cwAt(l.at),by:l.by||"",txt:l.txt||"",id:t.id,ten:t.ten,mine:t.nguoi===ME.id||t.tao===ME.id})));
  const q=CWS.q.trim().toLowerCase(),L=E.filter(e=>(CWS.nk!=="me"||e.mine)&&(!q||(e.by+" "+e.txt+" "+e.ten).toLowerCase().includes(q))).sort((a,b)=>b.ts-a.ts),lim=300;
  m.innerHTML=cwHead("Nhật ký","Ai làm gì với việc nào, lúc nào · bấm một dòng để mở việc",{btns:true})+
    cwTabs([{l:"Tất cả việc",ic:"hist",on:CWS.nk!=="me",attr:'data-cwnk="all"'},{l:"Việc của tôi",ic:"sun",on:CWS.nk==="me",attr:'data-cwnk="me"'}])+
    `<section class="cwcard"><h3>${cwI("hist")}Thao tác gần đây<span class="c">${L.length} dòng</span></h3><div class="cwlog">${L.slice(0,lim).map(e=>`<div data-cwnko="${esc(e.id)}"><time>${esc(String(e.at||"").replace(/:\d{2}(?=\s)/,""))}</time><span><b>${esc(e.by)}</b> ${esc(e.txt)} <em>· ${esc(cvShort(e.ten,70))}</em></span></div>`).join("")||'<p class="cwempty">Chưa có dòng nào. Từ nay mọi thay đổi của việc được ghi lại ở đây.</p>'}</div>${L.length>lim?`<p class="cwempty">Đang hiện ${lim} dòng mới nhất. Gõ ô tìm để lọc.</p>`:""}</section>`;
  cwTop(m);cwBind(m);
  m.querySelectorAll("[data-cwnk]").forEach(b=>b.onclick=()=>{CWS.nk=b.dataset.cwnk;renderMain()});
  m.querySelectorAll("[data-cwnko]").forEach(r=>r.onclick=()=>openTask(r.dataset.cwnko));
}

/* ---------- gắn vào trang ---------- */
const cwSafe=(f,n)=>m=>{try{f(m)}catch(e){console.error(n+" lỗi",e);m.innerHTML=`<div class="note red"><b>Trang chưa hiện được.</b> Chụp dòng này gửi người quản trị web: ${esc(String(e&&e.message||e))}</div>`}};
/* pCvV (congviec.js) gọi cwMy; các file kenhduan.js, orderlen.js bọc pCvV vẫn chạy (tìm .cvvbar, #cv-new trong tiêu đề) */
/* kenhduan.js (dải kênh phụ trách), orderlen.js (Lịch họp) chèn thẻ cạnh nút ở đầu trang: đưa xuống dưới hàng tab */
if(typeof pCvV==="function"){const _p=pCvV;pCvV=function(m){_p.apply(this,arguments);try{const top=m.querySelector(":scope>.cwtop");if(top)[...m.querySelectorAll(":scope>.cwhd>.kdstrip,:scope>.cwhd>.odcard,:scope>.cwtop>.cwhd>.kdstrip,:scope>.cwtop>.cwhd>.odcard")].reverse().forEach(e=>top.after(e))}catch(e){}}}
PAGES.cv_ov=cwSafe(cwOv,"Tổng quan việc");
PAGES.cv_pbv=cwSafe(cwPb,"Phòng ban");
PAGES.cv_nk=cwSafe(cwNk,"Nhật ký việc");
{const old=PAGES.cv_pb;if(old)PAGES.cv_pb=cwSafe(m=>cwPbSpace(m,old),"Thư mục công việc")}
PAGES.cv_da=cwSafe(m=>cwDaFrame(m,"da",b=>pCvDa(b)),"Dự án");
PAGES.cv_mt=cwSafe(m=>cwDaFrame(m,"mt",b=>pCvMt(b)),"Mục tiêu");
/* trang cũ của "Tổng quan" Công việc (cv_tq) mở Tổng quan mới */
PAGES.cv_tq=m=>{PAGE="cv_ov";PAGES.cv_ov(m)};

/* Quản trị › Cấu hình › Ngưỡng cảnh báo: thẻ "Nhắc việc 8 giờ" (Trợ lý công việc nhắn vào Tin nhắn mỗi sáng).
   Lưu ở máy chủ (app_settings, khóa task.reminder = {on, hour}); máy chủ đọc khi chạy mỗi giờ (taskReminders.ts). Mặc định bật, 8 giờ. Chỉ CEO sửa. */
const CW_NV_KEY="task.reminder";
const CW_NV_MAU=`Chào buổi sáng [tên]. Việc ngày [dd/mm]:

⚠ Quá hạn (2)
• Dựng 3 video review · trễ 3 ngày
• Test 3 creative Bột tẩy · trễ 1 ngày

Hôm nay (3)
• 08:30 Xem doanh thu ngày hôm qua · định kỳ
• 10:00 Đăng 3 video kênh Via 1
• Chụp 10 ảnh sản phẩm nền trắng

Chờ bạn duyệt (1)
• Thiết kế banner Sale 11/11 · Hòa

Mai: 2 việc (Viết 5 kịch bản, Edit 4 video)

(CEO nhận thêm: việc CEO giao đang trễ, cả công ty bao nhiêu việc trễ, ai trễ nhiều)`;
const CWNV={v:null,busy:0};
function cwNvLoad(){if(CWNV.busy||typeof svApi!=="function")return Promise.resolve();CWNV.busy=1;
  return svApi("/api/settings").then(r=>{const it=((r&&r.items)||[]).find(x=>x.key===CW_NV_KEY);let v={};try{v=it?JSON.parse(it.value_json):{}}catch(e){}CWNV.v={on:v.on!==false,hour:Number.isInteger(+v.hour)&&+v.hour>=5&&+v.hour<=12?+v.hour:8}})
    .catch(()=>{CWNV.v=CWNV.v||{on:true,hour:8}}).finally(()=>{CWNV.busy=0})}
function cwNvCard(m){const ceo=typeof crmRole==="function"&&crmRole()==="CEO",v=CWNV.v||{on:true,hour:8},hs=[5,6,7,8,9,10,11,12];
  const box=document.createElement("div");box.className="card pad";box.id="cw-nv";
  box.innerHTML=`<div class="tlh"><b>Nhắc việc 8 giờ</b> <span class="hint">· Trợ lý công việc nhắn riêng từng người trong Tin nhắn mỗi sáng</span></div>
   <form class="frm" id="cw-nvf"><div class="row4"><label class="ck"><input type="checkbox" id="cw-nvon"${v.on?" checked":""}${ceo?"":" disabled"}> Bật nhắn tin nhắc việc</label>
   <label class="field">Giờ gửi (giờ Việt Nam)<select id="cw-nvh"${ceo?"":" disabled"}>${opt(hs.map(h=>[h,String(h).padStart(2,"0")+":00"]),v.hour)}</select><small class="hint">Chuông thông báo việc trễ / đến hạn cũng chạy vào giờ này.</small></label></div>
   <div class="field">Mẫu tin nhắn <small class="hint">(web tự điền việc của từng người: quá hạn, hôm nay kèm giờ và việc định kỳ, chờ duyệt, ngày mai)</small><div class="cwnv">${esc(CW_NV_MAU)}</div></div>
   ${ceo?'<button class="btn pri">Lưu nhắc việc</button>':'<p class="hint">Chỉ CEO đổi được phần này.</p>'}</form>`;
  const ph=m.querySelector(".ph");if(ph)ph.after(box);else m.prepend(box);
  const f=box.querySelector("#cw-nvf");if(ceo&&f)f.onsubmit=async e=>{e.preventDefault();const nv={on:box.querySelector("#cw-nvon").checked,hour:+box.querySelector("#cw-nvh").value||8};
    try{await svApi("/api/settings",{method:"PATCH",body:JSON.stringify({[CW_NV_KEY]:nv})});CWNV.v=nv;toast(nv.on?"Đã lưu: nhắn nhắc việc lúc "+String(nv.hour).padStart(2,"0")+":00":"Đã tắt nhắn tin nhắc việc")}catch(er){toast(er.message||"Chưa lưu được")}}}
{const _n=PAGES.nguong;if(_n)PAGES.nguong=function(m){_n.apply(this,arguments);try{cwCss();if(CWNV.v)cwNvCard(m);else cwNvLoad().then(()=>{if(PAGE==="nguong"&&!m.querySelector("#cw-nv"))cwNvCard(m)})}catch(e){console.error("nhắc việc 8 giờ",e)}}}
