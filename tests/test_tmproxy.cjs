const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function language(system){const ctx=vm.createContext({chrome:{i18n:{getUILanguage:()=>system}},navigator:{language:system}});vm.runInContext(fs.readFileSync('tmproxy/i18n.js','utf8'),ctx);return ctx.TMProxyI18n;}
test('TMProxy selects Russian only for Russian browser locales, otherwise English',()=>{
  assert.equal(language('ru-RU').language,'ru');
  for(const locale of ['en-US','de-DE','fr','zh-CN'])assert.equal(language(locale).language,'en');
});
test('Explicit language overrides locale and both directions translate dynamic labels',()=>{
  const i18n=language('de');assert.equal(i18n.t('Начать проверку'),'Start checking');
  i18n.set('ru');assert.equal(i18n.t('Start checking'),'Начать проверку');
  assert.equal(i18n.t('Этап 1 · {done} / {total} · ответили: {alive}',{done:32,total:2000,alive:4}),'Этап 1 · 32 / 2000 · ответили: 4');
  i18n.set('en');assert.equal(i18n.t('Этап 1 · {done} / {total} · ответили: {alive}',{done:32,total:2000,alive:4}),'Stage 1 · 32 / 2000 · responding: 4');
  i18n.set('auto');assert.equal(i18n.language,'en');
});
const lists=require('../tmproxy/list-parser.js');
test('JSON proxy lists accept strings, common wrappers, records, protocols and IPv6',()=>{
  assert.deepEqual([...lists.jsonAddresses({proxies:['host.test:80','socks5://host.test:1080']})],['http://host.test:80','socks5://host.test:1080']);
  assert.deepEqual([...lists.jsonAddresses({data:[{ip:'1.2.3.4',port:80,protocols:['http','socks5']},{address:'::1',port:1080,protocol:'socks5',username:'a@b',password:'x:y'}]},'socks5')],['socks5://1.2.3.4:80','socks5://a%40b:x%3Ay@[::1]:1080']);
  assert.deepEqual([...lists.jsonAddresses({http:['a.test:80'],socks5:['b.test:1080']})],['http://a.test:80','socks5://b.test:1080']);
});
function streamed(chunks,type='text/plain'){
 const encoder=new TextEncoder();return new Response(new ReadableStream({start(controller){for(const part of chunks)controller.enqueue(encoder.encode(part));controller.close();}}),{headers:{'Content-Type':type}});
}
test('JSON detection works across chunk boundaries and TXT IPv6 stays TXT',async()=>{
 const rows=[];await lists.consume(streamed(['[','\n  ','"a.test:80",','{"ip":"b.test","port":8080}',']']),line=>rows.push(line));
 assert.deepEqual(rows,['http://a.test:80','http://b.test:8080']);
 const text=[];await lists.consume(streamed(['[::1]:1080\n','a.test:80']),line=>text.push(line));assert.deepEqual(text,['[::1]:1080\n','a.test:80']);
});
test('Invalid JSON fails clearly, cancellation stops parsing and delays sort numerically',async()=>{
 await assert.rejects(lists.consume(streamed(['{"proxies":'],'application/json'),()=>{}),/JSON/);
 await assert.rejects(lists.consume(streamed(['a.test:80']),()=>{},'http',()=>false),/остановлена/);
 const rows=[{url:'c',latency:120},{url:'a',latency:9},{url:'b',latency:9},{url:'unknown'}];
 assert.deepEqual(lists.sortResults(rows).map(r=>r.url),['a','b','c','unknown']);assert.equal(rows[0].url,'c');
});
const failover=require('../tmproxy/failover-policy.js');
test('Auto-switch rotates through verified latency order and skips cooldowns',()=>{
 const rows=[{url:'slow',latency:100},{url:'fast',latency:10},{url:'middle',latency:50}];
 assert.deepEqual(failover.candidates(rows,'middle',[],0).map(r=>r.url),['slow','fast']);
 assert.deepEqual(failover.candidates(rows,'slow',[],0).map(r=>r.url),['fast','middle']);
 assert.deepEqual(failover.candidates(rows,'missing',[{url:'fast',until:100}],50).map(r=>r.url),['middle','slow']);
 assert.deepEqual(failover.candidates(rows,'missing',[{url:'fast',until:100}],101).map(r=>r.url),['fast','middle','slow']);
 assert.deepEqual(failover.candidates([{url:'only',latency:1}],'only'),[]);
});
test('Firefox submission declares data and optional location consent without changing Chrome manifest',()=>{
 const firefox=JSON.parse(fs.readFileSync('dist/tmproxy-firefox/manifest.json'));
 const gecko=firefox.browser_specific_settings.gecko;
 assert.ok(Number.parseInt(gecko.strict_min_version)>=142);
 assert.ok(gecko.data_collection_permissions.required.includes('browsingActivity'));
 assert.ok(gecko.data_collection_permissions.required.includes('authenticationInfo'));
 assert.ok(gecko.data_collection_permissions.optional.includes('locationInfo'));
 assert.ok(!gecko.data_collection_permissions.required.includes('none'));
 const chrome=JSON.parse(fs.readFileSync('dist/tmproxy-chrome/manifest.json'));
 assert.equal(chrome.browser_specific_settings,undefined);
});
