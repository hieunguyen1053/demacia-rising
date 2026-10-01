import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import OfflineCache from '../web/cache-core.js';
import OfflineTransport from '../web/transport.js';
const source=await readFile(new URL('../web/sw.js',import.meta.url),'utf8');
function harness(complete) {
  const handlers={},deleted=[],scope='https://example.com/demacia-rising/';let skipped=0;
  const self={registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{skipped++;},addEventListener:(type,handler)=>handlers[type]=handler};
  const context={self,CONFIG:{version:'new',files:[]},OfflineCache,OfflineTransport,URL,Response,caches:{open:async()=>({match:async()=>complete?new Response('complete'):undefined}),keys:async()=>['demacia-rising:/demacia-rising/:old','demacia-rising:/demacia-rising/:new','demacia-rising:/another-game/:old'],delete:async name=>deleted.push(name)}};
  vm.runInNewContext(source,context);
  async function message(type){let pending;handlers.message({data:{type},waitUntil:task=>pending=task});await pending;}
  return {deleted,message,skipped:()=>skipped};
}
test('incomplete update cannot activate or delete the complete old cache',async()=>{
  const h=harness(false);await h.message('ACTIVATE');await h.message('CLEANUP');
  assert.equal(h.skipped(),0);assert.deepEqual(h.deleted,[]);
});
test('complete update activates and cleans only caches for its project',async()=>{
  const h=harness(true);await h.message('ACTIVATE');await h.message('CLEANUP');
  assert.equal(h.skipped(),1);assert.deepEqual(h.deleted,['demacia-rising:/demacia-rising/:old']);
});
