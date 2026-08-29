/* Autogenic Training PWA service worker.
 * SHELL (versioned app files) + AUDIO (persistent recordings). */
const SHELL = 'at-shell-v1';
const AUDIO = 'at-audio';
const SHELL_ASSETS = ['./','./index.html','./app.css','./app.js','./manifest.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/favicon-32.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c=>c.addAll(SHELL_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SHELL&&k!==AUDIO).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch', e => {
  const req = e.request; if(req.method!=='GET') return;
  const url = new URL(req.url);
  if(/\.(m4a|mp3|wav|ogg)$/i.test(url.pathname)){
    e.respondWith(caches.open(AUDIO).then(cache=>cache.match(req).then(hit=>hit||fetch(req).then(res=>{ if(res.ok) cache.put(req,res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.open(SHELL).then(cache=>cache.match(req).then(hit=>{
    const net = fetch(req).then(res=>{ if(res.ok) cache.put(req,res.clone()); return res; }).catch(()=>hit);
    return hit || net;
  })));
});
