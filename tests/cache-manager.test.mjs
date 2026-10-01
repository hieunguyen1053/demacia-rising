import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import OfflineCache from '../web/cache-core.js';
const source=await readFile(new URL('../web/cache-manager.js',import.meta.url),'utf8');
const base='https://example.com/demacia-rising/';
const record=(path,data)=>({path,size:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')});
function harness({entries=[],oldEntries,fetch,put}={}) {
  const store=new Map(entries),elements={},calls=[];
  const files=[record('first.bin','first'),record('second.bin','second')];
  const config={version:'test',files,base,cacheName:'test-cache',completeURL:base+'__offline_complete__'};
  const cache={match:async url=>store.get(url)?.clone(),delete:async url=>store.delete(url),put:async(url,response)=>{if(put)await put(url,response);store.set(url,response.clone());}};
  const worker={state:'activated',postMessage(message,ports){if(message.type==='INFO')ports[0].postMessage(config);}};
  const workerMessages=[];
  const oldStore=new Map(oldEntries);
  const oldConfig={...config,version:'old',cacheName:'old-cache'};
  const oldCache={match:async url=>oldStore.get(url)?.clone(),delete:async url=>oldStore.delete(url),put:async(url,response)=>oldStore.set(url,response.clone())};
  const oldWorker={state:'activated',postMessage(message,ports){workerMessages.push(message.type);if(message.type==='INFO')ports[0].postMessage(oldConfig);}};
  const registration={active:oldEntries?oldWorker:worker,waiting:oldEntries?worker:null,update:async()=>{}};
  class Channel {
    constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage({data}))};}
  }
  const context={OfflineCache,window:{},location:{href:base},document:{getElementById:id=>elements[id]??=( {hidden:false,value:0,textContent:''})},navigator:{serviceWorker:{register:async()=>registration,controller:worker},storage:{estimate:async()=>({quota:1e9,usage:0}),persist:async()=>false}},caches:{open:async name=>name==='old-cache'?oldCache:cache},crypto:webcrypto,isSecureContext:true,MessageChannel:Channel,URL,Response,setTimeout,clearTimeout,console:{error(){},warn(){}},fetch:async url=>{calls.push(url);return fetch?fetch(url):new Response(url.endsWith('first.bin')?'first':'second');}};
  vm.runInNewContext(source,context);
  return {context,elements,store,calls,config,oldStore,workerMessages};
}
async function failure(h) {
  for(let i=0;i<100 && h.elements['retry-download'].hidden;i++) await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal(h.elements['retry-download'].hidden,false);
}
test('interrupted downloads keep verified files and retry only the missing file',async()=>{
  let offline=true;
  const h=harness({fetch:async url=>{if(url.endsWith('second.bin')&&offline)throw new Error('offline');return new Response(url.endsWith('first.bin')?'first':'second');}});
  await failure(h);
  assert.equal(h.store.has(base+'first.bin'),true);
  assert.equal(h.store.has(h.config.completeURL),false);
  offline=false;await h.elements['retry-download'].onclick();await h.context.window.assetsReady;
  assert.equal(h.calls.filter(url=>url.endsWith('first.bin')).length,1);
  assert.equal(h.store.has(h.config.completeURL),true);
  assert.match(h.elements['cache-status'].textContent,/Sẵn sàng offline/);
});
test('corrupt cached resource is replaced and cannot count as ready',async()=>{
  const h=harness({entries:[[base+'first.bin',new Response('wrong')]]});
  await h.context.window.assetsReady;
  assert.equal(h.calls.includes(base+'first.bin'),true);
  assert.equal(await h.store.get(base+'first.bin').clone().text(),'first');
});
test('storage quota failure never writes the completion marker',async()=>{
  const h=harness({put:async()=>{throw new DOMException('full','QuotaExceededError');}});
  await failure(h);
  assert.equal(h.store.has(h.config.completeURL),false);
  assert.match(h.elements['cache-status'].textContent,/Bộ nhớ website đã đầy/);
});

test('failed pending update falls back to complete old cache and keeps partial downloads',async()=>{
  const h=harness({oldEntries:[[base+'first.bin',new Response('first')],[base+'second.bin',new Response('second')],[base+'__offline_complete__',new Response('complete')]],fetch:async url=>{if(url.endsWith('second.bin'))throw new Error('offline');return new Response('first');}});
  await h.context.window.assetsReady;
  assert.match(h.elements['cache-status'].textContent,/Sẵn sàng offline/);
  assert.equal(h.oldStore.has(h.config.completeURL),true);
  assert.equal(h.store.has(h.config.completeURL),false);
  assert.equal(h.store.has(base+'first.bin'),true);
  assert.equal(h.workerMessages.includes('CLEANUP'),false);
});
