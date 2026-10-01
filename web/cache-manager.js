'use strict';
(() => {
  const status = document.getElementById('cache-status');
  const progress = document.getElementById('cache-progress');
  const retry = document.getElementById('retry-download');
  let registration;
  const base = new URL('./',location.href);
  function info(worker) {
    return new Promise((resolve,reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Service worker không phản hồi.')),15000);
      channel.port1.onmessage = event => {clearTimeout(timer);channel.port1.close();resolve(event.data);};
      worker.postMessage({type:'INFO'},[channel.port2]);
    });
  }
  async function installed(worker) {
    if (worker.state === 'installed' || worker.state === 'activated') return;
    await new Promise((resolve,reject) => {
      worker.addEventListener('statechange',function changed() {
        if (['installed','activated','redundant'].includes(worker.state)) {
          worker.removeEventListener('statechange',changed);
          if (worker.state === 'redundant') reject(new Error('Không thể cài đặt bộ tải offline. Kiểm tra mạng và thử lại.'));
          else resolve();
        }
      });
    });
  }
  async function prepare() {
    retry.hidden=true;
    if (!('serviceWorker' in navigator) || !globalThis.isSecureContext) throw new Error('Cần HTTPS hoặc localhost và trình duyệt hỗ trợ service worker.');
    registration = await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.href,updateViaCache:'none'});
    // Check for an update before choosing the worker; failure is harmless offline.
    await registration.update().catch(() => {});
    let worker = registration.installing || registration.waiting || registration.active;
    if (!worker) throw new Error('Không tìm thấy service worker.');
    await installed(worker);
    // Wait for first activation without forcing updates into an existing game session.
    if (!registration.active) {await navigator.serviceWorker.ready;worker=registration.active;}
    const config = await info(worker);
    const cache = await caches.open(config.cacheName);
    const total = config.files.reduce((sum,file) => sum+file.size,0);
    const quota = await navigator.storage?.estimate?.().catch(() => null);
    const persist = await navigator.storage?.persist?.().catch(() => false);
    let bytes=0, count=0, next=0, failure;
    function update() {
      progress.value=bytes/total;
      status.textContent=`Đang chuẩn bị offline: ${count}/${config.files.length} tệp · ${(bytes/1e6).toFixed(1)}/${(total/1e6).toFixed(1)} MB`;
    }
    update();
    async function download() {
      while (!failure && next<config.files.length) {
        const file=config.files[next++],url=new URL(file.path,config.base).href;
        try {
          let response=await cache.match(url);
          if (response) {
            try {response=await OfflineCache.verifiedResponse(response,file);}
            catch {await cache.delete(url);response=null;}
          }
          if (!response) {
            if (quota && quota.quota-quota.usage<file.size) throw new Error('Không đủ dung lượng trình duyệt để lưu game.');
            response=await OfflineCache.verifiedResponse(await fetch(url,{cache:'reload'}),file);
            await cache.put(url,response);
          }
          bytes+=file.size;count++;update();
        } catch(error) {failure=error;failure.assetPath=file.path;}
      }
    }
    await Promise.all([download(),download(),download()]);
    if (failure) {
      await cache.delete(config.completeURL);
      if (failure.name==='QuotaExceededError') throw new Error('Bộ nhớ website đã đầy. Giải phóng dung lượng rồi thử lại.');
      throw new Error(failure.message+' · '+failure.assetPath);
    }
    await cache.put(config.completeURL,new Response(JSON.stringify({version:config.version,files:count}),{headers:{'Content-Type':'application/json'}}));
    progress.value=1;progress.hidden=true;
    status.textContent='Sẵn sàng offline · Đã kiểm tra toàn bộ tài nguyên' + (persist ? ' · Lưu trữ bền vững' : '');
    if (registration.waiting && worker===registration.waiting) {
      status.textContent='Bản cập nhật đã sẵn sàng · Đang khởi động lại…';
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});
        worker.postMessage({type:'ACTIVATE'});
      });
      location.reload();
      await new Promise(() => {});
    }
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
    worker.postMessage({type:'CLEANUP'});
  }
  window.assetsReady = new Promise(resolve => {
    async function attempt() {
      try {progress.hidden=false;await prepare();resolve();}
      catch(error) {status.textContent='Chưa sẵn sàng offline: '+error.message;retry.hidden=false;console.error(error);}
    }
    retry.onclick=attempt;
    attempt();
  });
})();
