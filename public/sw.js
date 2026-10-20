// Chỉ để trình duyệt coi đây là app cài được. KHÔNG lưu đệm: số liệu luôn lấy mới từ máy chủ.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
