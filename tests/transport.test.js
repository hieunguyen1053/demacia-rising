const {test}=require('node:test');
const assert=require('node:assert/strict');
const {localResponse}=require('../web/transport.js');
test('client-config is local under root and Pages project paths',async()=>{
  for(const base of ['https://example.com/','https://example.com/demacia-rising/','https://localhost:8969/']) {
    const response=localResponse(new URL('client-config/v2/config/lol.client_settings.opal_metagame.landing_page',base));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{});
  }
});
test('telemetry is discarded without intercepting game assets',()=>{
  assert.equal(localResponse(new URL('https://example.com/telemetry/event'),'POST').status,204);
  assert.equal(localResponse(new URL('https://example.com/demacia-rising/Build/WebGLBuild.wasm')),null);
});
