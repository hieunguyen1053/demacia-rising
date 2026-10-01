'use strict';
Promise.all([window.offlineReady,window.assetsReady]).then(async () => {
  const base=new URL('./',location.href);
  await new Promise((resolve,reject) => {
    const script=document.createElement('script');
    script.src=new URL('Build/WebGLBuild.loader.js',base).href;
    script.onload=resolve;script.onerror=() => reject(new Error('Không thể nạp Unity loader.'));
    document.body.append(script);
  });
  return createUnityInstance(document.getElementById('unity-canvas'), {
    arguments: [],
    dataUrl: new URL('Build/WebGLBuild.data',base).href,
    frameworkUrl: new URL('Build/WebGLBuild.framework.js',base).href,
    codeUrl: new URL('Build/WebGLBuild.wasm',base).href,
    streamingAssetsUrl: new URL('StreamingAssets',base).href,
    companyName:'Riot Games',productName:'RealmDefense',productVersion:'1.0',
  }, progress => {
    document.getElementById('progress').value=progress;
    document.getElementById('status').textContent=`Đang khởi động game… ${Math.round(progress*100)}%`;
  });
}).then(instance => {
  window.unityInstance=instance;
  document.getElementById('status').textContent='Game đang chạy · Lưu trên máy';
  document.getElementById('progress').hidden=true;
}).catch(error => {
  document.getElementById('status').textContent='Không thể tải game: '+error.message;
  console.error(error);
});
