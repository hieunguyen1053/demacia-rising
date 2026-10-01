'use strict';
const OfflineTransport = (() => {
  function localResponse(url, method = 'GET') {
    const pathname = url.pathname;
    if (method === 'GET' && pathname.endsWith('/client-config/v2/config/lol.client_settings.opal_metagame.landing_page')) {
      return new Response('{}', {headers:{'Content-Type':'application/json'}});
    }
    if (method === 'POST' && /\/telemetry\//.test(pathname)) return new Response(null,{status:204});
    return null;
  }
  return {localResponse};
})();
if (typeof module !== 'undefined') module.exports = OfflineTransport;
