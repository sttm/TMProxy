/* Shared proxy policy; no page code or remote scripts. */
(function (root) {
  'use strict';
  function parseProxy(value, firefox = false) {
    const url = new URL(value);
    const scheme = url.protocol.slice(0, -1);
    const authority = String(value).split('://')[1]?.split(/[/?#]/)[0] || '';
    // URL normalizes explicit :80/:443 away; these are still valid proxy ports.
    const port = Number(url.port || (scheme === 'http' ? 80 : scheme === 'https' ? 443 : 1080));
    if (!['http', 'https', 'socks4', 'socks5', 'socks5h'].includes(scheme) || !url.hostname
        || !/:\d+$/.test(authority) || !Number.isInteger(port) || port > 65535 || port < 1
        || !['', '/'].includes(url.pathname) || url.search || url.hash) throw new Error('Некорректный адрес прокси');
    const username = decodeURIComponent(url.username), password = decodeURIComponent(url.password);
    if (!firefox && scheme.startsWith('socks') && (username || password))
      throw new Error('Chrome не поддерживает SOCKS с паролем. Выберите другой прокси.');
    if (scheme === 'socks4' && (username || password)) throw new Error('SOCKS4 с авторизацией не поддерживается.');
    return { scheme: scheme === 'socks5h' ? 'socks5' : scheme,
      host: url.hostname.replace(/^\[|\]$/g, ''), port, username, password };
  }
  function domains(text) {
    const result = [...new Set(text.split(/[\s,;]+/).filter(Boolean).map(value => {
      const host = value.toLowerCase().replace(/^\*\./, '');
      if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || host.includes('..') || !host.includes('.'))
        throw new Error('Укажите домены без https:// и путей, например youtube.com');
      return host;
    }))];
    if (!result.length) throw new Error('Добавьте хотя бы один домен.');
    return result;
  }
  function bypass(host) {
    host = host.toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '::1';
  }
  function applies(host, config) {
    return !bypass(host) && (config.mode === 'all' || config.domains.some(d => host === d || host.endsWith('.' + d)));
  }
  function pac(config) {
    const p = parseProxy(config.url);
    const target = ({http: 'PROXY', https: 'HTTPS', socks4: 'SOCKS', socks5: 'SOCKS5'})[p.scheme]
      + ' ' + (p.host.includes(':') ? '[' + p.host + ']' : p.host) + ':' + p.port;
    // No DIRECT fallback for requests that should go through the selected proxy.
    return 'function FindProxyForURL(url, host) { host=host.toLowerCase();'
      + 'if(host==="localhost"||/\\.localhost$/.test(host)||/^127\\./.test(host)||host==="[::1]"||host==="::1")return "DIRECT";'
      + (config.mode === 'sites' ? 'var sites=' + JSON.stringify(config.domains) + '; if(!sites.some(function(d){return host===d||host.slice(-(d.length+1))==="."+d;}))return "DIRECT";' : '')
      + 'return ' + JSON.stringify(target) + ';}';
  }
  function flag(code) { return /^[A-Z]{2}$/.test(code || '') ? [...code].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('') : ''; }
  root.TMPLAYProxy = {parseProxy, domains, bypass, applies, pac, flag};
  if (typeof module !== 'undefined') module.exports = root.TMPLAYProxy;
})(globalThis);
