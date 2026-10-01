'use strict';
// CONFIG is embedded by the production build; every cache is scoped to this project.
const base = self.registration.scope;
const prefix = 'demacia-rising:' + new URL(base).pathname + ':';
const cacheName = prefix + CONFIG.version;
const completeURL = new URL('__offline_complete__',base).href;
const fileURLs = new Set(CONFIG.files.map(file => new URL(file.path,base).href));
const shellPaths = new Set(['index.html','app.js','style.css','favicon.svg','offline-manifest.json']);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    for (const file of CONFIG.files.filter(file => shellPaths.has(file.path))) {
      const url = new URL(file.path,base).href;
      const response = await OfflineCache.verifiedResponse(await fetch(url,{cache:'reload'}),file);
      await cache.put(url,response);
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const cache = await caches.open(cacheName);
    if (await cache.match(completeURL)) {
      for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'INFO') event.ports[0]?.postMessage({...CONFIG,base,cacheName,completeURL});
  if (event.data?.type === 'ACTIVATE') {
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      if (await cache.match(completeURL)) await self.skipWaiting();
    })());
  }
  if (event.data?.type === 'CLEANUP') {
    event.waitUntil((async () => {
      if (!(await (await caches.open(cacheName)).match(completeURL))) return;
      for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
    })());
  }
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  const local = OfflineTransport.localResponse(url,request.method);
  if (local) {event.respondWith(Promise.resolve(local));return;}
  if (request.method !== 'GET' || url.origin !== new URL(base).origin) return;
  if (request.mode !== 'navigate' && !fileURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const key = request.mode === 'navigate' ? new URL('index.html',base).href : url.href;
    const response = await cache.match(key);
    if (!response) return fetch(request);
    if (request.headers.has('Range')) return OfflineCache.rangedResponse(response,request.headers.get('Range'));
    return response;
  })());
});
