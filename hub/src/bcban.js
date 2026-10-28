/* Trang kênh TikTok / Shopee / Facebook bản quản trị: dòng "Doanh thu thực …" (doanhthu.js chèn dưới tiêu đề) chuyển sang cột phải,
   dưới thẻ Cảnh báo & đề xuất (chị Hoa 28/10/2026). Trang không có cột phải (vận hành, tab con) thì giữ nguyên chỗ cũ. Nạp sau doanhthu.js. */
["bc_tiktok","bc_shopee","bc_fb"].forEach(id=>{const _p=PAGES[id];if(typeof _p!=="function")return;
  PAGES[id]=function(m){const x=_p.apply(this,arguments);try{const b=m.querySelector(".dt-ban"),s=m.querySelector(".tb-side");if(b&&s){b.style.marginTop="12px";s.appendChild(b)}}catch(e){}return x}});
