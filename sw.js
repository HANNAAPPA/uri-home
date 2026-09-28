/* 앱 껍데기(같은 출처 파일)만 저장한다. 서버 API·유튜브·지도는 손대지 않는다. */
var V = 'hk-faa3a5f8eb';
var SHELL = ['./', './index.html', './shim.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(V).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== V; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

// 저장본을 바로 주고, 뒤에서 새 파일을 받아 다음 실행 때 쓴다
self.addEventListener('fetch', function(e){
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.open(V).then(function(c){
    return c.match(e.request, { ignoreSearch: true }).then(function(hit){
      var net = fetch(e.request).then(function(res){
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    });
  }));
});
