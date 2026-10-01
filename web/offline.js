'use strict';
(() => {
  const nativeFetch = window.fetch.bind(window);
  const diagnostics = document.getElementById('diagnostics');
  let profile, stopped = false, queue = Promise.resolve();
  function status(text) {document.getElementById('status').textContent=text;}
  function log(kind, ...values) {
    const text = values.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' ');
    diagnostics.textContent = (diagnostics.textContent + `[${kind}] ${text}\n`).slice(-60000);
  }
  for (const kind of ['warn','error']) {
    const original = console[kind].bind(console);
    console[kind] = (...args) => {original(...args);log(kind,...args);};
  }
  window.addEventListener('error',e => log('error',e.message));
  window.addEventListener('unhandledrejection',e => log('error',String(e.reason)));
  window.addEventListener('securitypolicyviolation',e => log('blocked',e.blockedURI));
  window.fetch = (input,options) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const local = OfflineTransport.localResponse(url, (options?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase());
    if (local) return Promise.resolve(local);
    if (url.origin !== location.origin) {
      log('blocked',url.href);
      return Promise.reject(new Error('Offline: blocked external request ' + url.href));
    }
    return nativeFetch(input,options);
  };
  const reply = (messageType,data) => window.postMessage({messageType,data},location.origin);
  const wallets = () => {
    for (const currency of ['mgs_opal_shield','mgs_opal_turn']) reply('lol-metagames-currency-balances-response',{currency,balance:profile.wallets[currency]});
  };
  async function save(next) {
    await offlineStorage.write(next);
    profile=next;
    status('Đã lưu trên máy · ' + new Date(next.updatedAt).toLocaleTimeString('vi-VN'));
  }
  const exclusiveTab = navigator.locks ? new Promise((resolve,reject) => {
    navigator.locks.request('demacia-rising-offline',{ifAvailable:true},async lock => {
      if (!lock) {reject(new Error('Game đã mở trong tab khác. Đóng tab đó rồi tải lại để bảo vệ bản lưu.'));return;}
      resolve();
      await new Promise(() => {}); // Browser releases the lock when this page closes.
    }).catch(reject);
  }) : Promise.resolve();
  window.offlineReady = exclusiveTab.then(() => offlineStorage.read()).then(async saved => {
    profile=saved;
    await offlineStorage.write(saved);
    for (const button of document.querySelectorAll('nav button')) button.disabled=false;
  });
  async function handle(message) {
    await window.offlineReady;
    if (stopped) return;
    const {messageType,data} = message;
    switch (messageType) {
      case 'rcp-fe-lol-home-data-request':
        reply('rcp-fe-lol-home-data-response',{clientData:{locale:'en_US',puuid:'offline-player',platformId:'NA1',region:'NA',shard:'offline',sessionId:'offline'}});break;
      case 'league-session-token-request':
        // Synthetic local session metadata, never sent to a Riot service.
        reply('league-session-token-response','offline.' + btoa(JSON.stringify({reg:'offline',sid:'offline-session'})) + '.offline');break;
      case 'rcp-fe-lol-home-inventory-observe':reply('rcp-fe-lol-home-inventory-response',{inventory:[]});break;
      case 'rcp-fe-lol-home-observe-missions':reply('rcp-fe-lol-home-missions-changed',profile.missions);break;
      case 'rcp-fe-lol-home-missions-select-rewards':
        {
          const next=OfflineProfile.clone(profile);
          const mission=next.missions.find(m => m.internalName === data.internalName);
          if (mission) mission.status='COMPLETED';
          else next.missions.push({internalName:data.internalName,status:'COMPLETED'});
          next.updatedAt=new Date().toISOString();
          await save(next);
          reply('rcp-fe-lol-home-missions-changed',next.missions);
          status('Đã ghi nhận nhiệm vụ cục bộ; phần thưởng tài khoản Riot không được cấp.');
          break;
        }
      case 'rcp-fe-lol-home-open-paw':case 'rcp-fe-lol-home-navigate-to-store':
        status('Cửa hàng Riot không khả dụng trong bản offline.');break;
      case 'lol-metagames':
        switch (data.type) {
          case 'lol-metagames-get-build-version':reply('lol-metagames-get-build-version-response',{buildVersion:'26.9'});break;
          case 'lol-metagames-lcu-patching-status':reply('lol-metagames-lcu-patching-status-response',{isPatching:false});break;
          case 'lol-metagames-player-data':reply('lol-metagames-player-data-response',{playerData:{gameData:profile.gameData}});break;
          case 'lol-metagames-currency-balances-observe':wallets();break;
          case 'lol-metagames-player-data-update': {
            const next=OfflineProfile.clone(profile);
            next.gameData=OfflineProfile.dataObject(data.options.playerData);
            next.updatedAt=new Date().toISOString();
            await save(next);
            reply('lol-metagames-player-data-update-response',{success:true});
            break;
          }
          case 'lol-metagames-player-event': {
            const result=OfflineProfile.playerEvent(profile,data.options.eventName,data.options.playerGameData);
            await save(result.profile);
            reply('lol-metagames-player-event-response',result.response);
            wallets();
            break;
          }
          default:log('unhandled',data.type);break;
        }
        break;
      default:log('unhandled',messageType);break;
    }
  }
  function enqueue(task) {
    const pending=queue.then(task);
    queue=pending.catch(error => {status('Lỗi lưu offline: ' + error.message);log('error',error.stack || String(error));});
    return pending;
  }
  window.addEventListener('message',e => {
    if (e.source !== window || e.origin !== location.origin || e.data?.type !== 'RClientWindowMessenger') return;
    enqueue(() => handle(e.data)).catch(() => {
      const type=e.data.data?.type;
      if (type === 'lol-metagames-player-data-update') reply('lol-metagames-player-data-update-response',{success:false});
      if (type === 'lol-metagames-player-event') reply('lol-metagames-player-event-response',{success:false,playerGameData:{gameData:profile?.gameData || {}}});
    });
  });
  document.getElementById('export-save').onclick=() => enqueue(async () => {
    await window.offlineReady;
    const blob=new Blob([JSON.stringify(profile,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='demacia-rising-save-' + new Date().toISOString().slice(0,10) + '.json';
    link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  async function replaceProfile(next) {
    stopped=true;
    if (window.unityInstance) await window.unityInstance.Quit();
    await save(next);
    location.reload();
  }
  const importDialog=document.getElementById('import-dialog');
  document.getElementById('import-save').onclick=() => {
    document.getElementById('import-error').textContent='';
    document.getElementById('save-json').value='';
    importDialog.showModal();
  };
  document.getElementById('choose-save-file').onclick=() => document.getElementById('save-file').click();
  async function importText(text) {
    try {
      if (text.length>50*1024*1024) throw new Error('Bản lưu vượt quá 50 MB.');
      const next=OfflineProfile.validate(JSON.parse(text));
      if (!confirm('Nhập bản lưu sẽ thay tiến trình hiện tại. Hãy xuất bản lưu trước nếu muốn giữ lại. Tiếp tục?')) return;
      importDialog.close();
      await enqueue(() => replaceProfile(next));
    } catch(error) {
      document.getElementById('import-error').textContent='Không thể nhập bản lưu: ' + error.message;
      status('Không thể nhập bản lưu: ' + error.message);
    }
  }
  document.getElementById('paste-import').onclick=() => importText(document.getElementById('save-json').value);
  document.getElementById('save-file').onchange=async event => {
    const file=event.target.files[0];
    if (!file) return;
    try {
      if (file.size>50*1024*1024) throw new Error('Bản lưu vượt quá 50 MB.');
      await importText(await file.text());
    } catch(error) {document.getElementById('import-error').textContent='Không thể nhập bản lưu: ' + error.message;}
    finally {event.target.value='';}
  };
  document.getElementById('reset-save').onclick=() => {
    if (confirm('Bắt đầu tiến trình mới? Hãy xuất bản lưu trước nếu muốn giữ tiến trình hiện tại.')) enqueue(() => replaceProfile(OfflineProfile.fresh())).catch(() => {});
  };
  document.getElementById('grant').onclick=() => enqueue(async () => {
    if (!confirm('Nhận 350 Silver Shields offline? Game sẽ tải lại từ lượt đã lưu gần nhất; thao tác chưa kết thúc lượt sẽ không được giữ.')) return;
    const next=OfflineProfile.clone(profile);
    // StapleResourcesGeneratedFromLoL = 350 in this pinned GlobalGameData.
    next.wallets.mgs_opal_shield+=350;
    next.updatedAt=new Date().toISOString();
    await replaceProfile(next);
  });
  window.offlineLog=log;
})();
