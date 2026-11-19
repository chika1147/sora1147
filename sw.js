// ZeroAI v1.8 MathFix / cache updated JS and force offline-capable assets.
// Revision bump invalidates prior v1.7/v1.8 cached math code.
const CACHE='zeroai-offline-v1-8-fullcontext10000-20261119';
const APP=['./','./index.html','./app.js','./chat_shell.js','./engine.worker.js','./tokenizer.js',
 './model.js','./quality_v17.js','./quality_v18.js','./math_v18_fix.js','./context_memory.js',
 './manifest.webmanifest','./icon.png','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(async keys=>{
 for(const key of keys){if(key.startsWith('zeroai-offline')&&key!==CACHE)await caches.delete(key);}
 await self.clients.claim();
})));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 // Network-first for same-origin source files, cache fallback offline.
 // Query cache-busters still find their equivalent cached bare pathname.
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
     const response=await fetch(event.request);
     if(response.ok)await cache.put(event.request,response.clone());
     return response;
   }catch(error){
     const cached=await cache.match(event.request,{ignoreSearch:true});
     if(cached)return cached;
     throw error;
   }
 })());
});
