// Để trình duyệt coi đây là app cài được + nhận thông báo đẩy về điện thoại (08/11/2026).
// KHÔNG lưu đệm: số liệu luôn lấy mới từ máy chủ.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

// Máy chủ gửi {title, body, url, tag}: hiện thông báo trên màn hình khóa / góc màn hình.
self.addEventListener('push',e=>{
  let m={};try{m=e.data?e.data.json():{}}catch(x){m={body:e.data?e.data.text():''}}
  const title=m.title||'AILLA';
  e.waitUntil(self.registration.showNotification(title,{body:m.body||'',tag:m.tag||undefined,renotify:!!m.tag,icon:'/app-icon-192.png',badge:'/app-icon-192.png',data:{url:m.url||'/hub/'},lang:'vi'}));
});

// Bấm thông báo: web đang mở thì chuyển tới đúng việc, chưa mở thì mở web ở đúng việc.
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||'/hub/';
  e.waitUntil((async()=>{
    const L=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const w=L.find(c=>new URL(c.url).pathname.startsWith('/hub'));
    if(w){try{await w.focus()}catch(x){}w.postMessage({ntUrl:url});return}
    await self.clients.openWindow(url);
  })());
});
