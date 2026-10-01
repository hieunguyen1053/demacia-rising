import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bundlePaths} from '../scripts/catalog.mjs';
test('catalog dependency closure contains exactly all shipped bundle paths',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../assets/manifest.json',import.meta.url),'utf8'));
  const paths=bundlePaths(await readFile(new URL('../assets/StreamingAssets/aa/catalog.bin',import.meta.url)));
  assert.equal(paths.length,87);
  assert.deepEqual(paths,Object.keys(manifest).filter(p=>p.endsWith('.bundle')).sort());
  assert.throws(()=>bundlePaths(Buffer.alloc(32)));
});
