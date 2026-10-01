'use strict';
const OfflineCache = (() => {
  async function verifiedResponse(response, record) {
    if (!response.ok || response.status === 206) throw new Error('HTTP ' + response.status + ': ' + record.path);
    const data = await response.arrayBuffer();
    if (data.byteLength !== record.size) throw new Error('Sai kích thước: ' + record.path);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    if (hash !== record.sha256) throw new Error('Sai SHA-256: ' + record.path);
    const headers = new Headers(response.headers);
    headers.delete('Content-Encoding'); headers.delete('Transfer-Encoding');
    headers.set('Content-Length',String(data.byteLength));
    return new Response(data,{status:200,headers});
  }
  async function rangedResponse(response, range) {
    const data = await response.arrayBuffer(), length = data.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const invalid = () => new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`}});
    if (!match || (!match[1] && !match[2])) return invalid();
    const start = match[1] ? Number(match[1]) : Math.max(0,length-Number(match[2]));
    const end = match[1] ? (match[2] ? Math.min(Number(match[2]),length-1) : length-1) : length-1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= length) return invalid();
    const headers = new Headers(response.headers);
    headers.set('Content-Range',`bytes ${start}-${end}/${length}`);
    headers.set('Content-Length',String(end-start+1)); headers.set('Accept-Ranges','bytes');
    return new Response(data.slice(start,end+1),{status:206,headers});
  }
  return {verifiedResponse,rangedResponse};
})();
if (typeof module !== 'undefined') module.exports = OfflineCache;
