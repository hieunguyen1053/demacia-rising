const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {verifiedResponse,rangedResponse}=require('../web/cache-core.js');
test('download validation rejects truncation, corruption, and HTTP errors',async()=>{
  const data='verified resource',record={path:'asset',size:Buffer.byteLength(data),sha256:createHash('sha256').update(data).digest('hex')};
  assert.equal(await (await verifiedResponse(new Response(data),record)).text(),data);
  await assert.rejects(verifiedResponse(new Response('short'),record),/kích thước/);
  await assert.rejects(verifiedResponse(new Response('corrupted resourc'),record),/SHA-256/);
  await assert.rejects(verifiedResponse(new Response(null,{status:404}),record),/HTTP 404/);
});
test('cached audio supports full, open, suffix and invalid byte ranges',async()=>{
  for(const [range,expected] of [['bytes=1-3','bcd'],['bytes=4-','ef'],['bytes=-2','ef']]) {
    const response=await rangedResponse(new Response('abcdef'),range);
    assert.equal(response.status,206);assert.equal(await response.text(),expected);
    assert.equal(response.headers.get('Content-Length'),String(expected.length));
  }
  assert.equal((await rangedResponse(new Response('abcdef'),'bytes=9-10')).status,416);
  assert.equal((await rangedResponse(new Response('abcdef'),'bytes=0-1,4-5')).status,416);
});
