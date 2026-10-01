import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {bundlePaths} from './catalog.mjs';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export async function walk(root, prefix = '') {
  const paths = [];
  for (const entry of await readdir(path.join(root, prefix), {withFileTypes:true})) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) paths.push(...await walk(root, name + '/'));
    else if (entry.isFile()) paths.push(name);
    else throw new Error('Unsupported asset entry: ' + name);
  }
  return paths.sort();
}
export async function verifyAssets() {
  const root = path.join(ROOT,'assets');
  const manifest = JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
  const settings = JSON.parse(await readFile(path.join(root,'StreamingAssets/aa/settings.json'),'utf8'));
  const locations = settings.m_CatalogLocations;
  if (locations.length !== 1 || locations[0].m_InternalId !== '{UnityEngine.AddressableAssets.Addressables.RuntimePath}/catalog.bin' || locations[0].m_Dependencies.length) throw new Error('Unexpected catalog configuration');
  const bundles = bundlePaths(await readFile(path.join(root,'StreamingAssets/aa/catalog.bin')));
  if (bundles.length !== 87) throw new Error('Expected all 87 pinned bundles');
  const required = ['Build/WebGLBuild.loader.js','Build/WebGLBuild.framework.js','Build/WebGLBuild.wasm','Build/WebGLBuild.data','StreamingAssets/aa/settings.json','StreamingAssets/aa/catalog.bin',...bundles];
  for (const p of required) if (!manifest[p]) throw new Error('Missing manifest entry: ' + p);
  const disk = (await walk(root)).filter(p => p !== 'manifest.json');
  if (JSON.stringify(disk) !== JSON.stringify(Object.keys(manifest).sort())) throw new Error('Files differ from source manifest');
  let bytes = 0, audio = 0;
  for (const [relative, record] of Object.entries(manifest)) {
    if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error('Unsafe asset path: ' + relative);
    const data = await readFile(path.join(root,relative));
    if (data.length !== record.size || sha256(data) !== record.sha256) throw new Error('Corrupt asset: ' + relative);
    if (relative.endsWith('.bundle') && !data.subarray(0,8).equals(Buffer.from('UnityFS\0'))) throw new Error('Invalid bundle header: ' + relative);
    if (relative.endsWith('.ogg')) {audio++; if (data.subarray(0,4).toString() !== 'OggS') throw new Error('Invalid OGG: ' + relative);}
    bytes += data.length;
  }
  if (audio !== 742) throw new Error('Expected all 742 OGG assets');
  console.log(`Verified ${bundles.length}/87 bundles, ${audio}/742 OGG, ${disk.length} files, ${(bytes/1e6).toFixed(2)} MB. No network used.`);
  return {manifest, bytes};
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await verifyAssets();
