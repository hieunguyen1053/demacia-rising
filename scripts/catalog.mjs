/** Decode Unity Addressables 2.3.16 binary catalog internal IDs and dependencies. */
export function bundlePaths(data) {
  function uint(offset) {
    if (offset < 0 || offset + 4 > data.length) throw new Error('Catalog offset outside buffer');
    return data.readUInt32LE(offset);
  }
  function array(offset, width) {
    const size = uint(offset - 4);
    if (size % width || offset + size > data.length) throw new Error('Invalid catalog array');
    return Array.from({length: size / width}, (_, i) => offset + i * width);
  }
  function raw(id) {
    const offset = id & 0x3fffffff, size = uint(offset - 4);
    if (offset + size > data.length) throw new Error('Invalid catalog string');
    return data.subarray(offset, offset + size).toString(id & 0x80000000 ? 'utf16le' : 'ascii');
  }
  function string(id) {
    if (!(id & 0x40000000)) return raw(id);
    const parts = [], seen = new Set();
    while (id !== 0xffffffff) {
      const offset = id & 0x3fffffff;
      if (seen.has(offset)) throw new Error('Cyclic catalog string');
      seen.add(offset); parts.push(raw(uint(offset))); id = uint(offset + 4);
    }
    return parts.reverse().join('/');
  }
  const pending = [], seen = new Set(), paths = new Set();
  for (const key of array(uint(8), 8)) pending.push(...array(uint(key + 4), 4).map(uint));
  while (pending.length) {
    const location = pending.pop();
    if (seen.has(location)) continue;
    seen.add(location);
    const id = string(uint(location + 4));
    if (id.endsWith('.bundle')) {
      const marker = '{UnityEngine.AddressableAssets.Addressables.RuntimePath}/';
      if (!id.startsWith(marker)) throw new Error('Unexpected bundle internal ID: ' + id);
      const path = 'StreamingAssets/aa/' + id.slice(marker.length);
      if (path.split('/').includes('..')) throw new Error('Unsafe bundle path');
      paths.add(path);
    }
    const dependencies = uint(location + 12);
    if (dependencies !== 0xffffffff) pending.push(...array(dependencies, 4).map(uint));
  }
  if (!paths.size) throw new Error('No bundles in catalog');
  return [...paths].sort();
}
