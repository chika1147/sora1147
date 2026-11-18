const CACHE='zeroai-offline-v1-7-ready';
const APP=['./','./index.html','./app.js','./engine.worker.js','./tokenizer.js','./model.js','./quality_v17.js','./manifest.webmanifest','./icon.png','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(async names=>{for(const name of names)if(name!==CACHE)await caches.delete(name);await self.clients.claim();})));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
    if(response.ok&&event.request.method==='GET')caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
    return response;
  })));
});
