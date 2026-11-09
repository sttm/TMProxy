'use strict';
if(typeof importScripts==='function')importScripts('proxy-core.js','db.js','list-parser.js','failover-policy.js');
const api=typeof browser!=='undefined'?browser:chrome;
const firefox=!!api.proxy.onRequest;
const Core=TMPLAYProxy;
let settings={config:null,sources:[],protocol:'http',source:'',target:'https://www.youtube.com/',geo:true,language:'auto',first_timeout:1200,auto_switch:false};
let progress={phase:'idle',total:0,checked:0,alive:0,working:0,error:'',running:false};
let probe=null,controller=null,owner=null,loading=false,runId=0;
const fastProbes=new Map();
const testRequests=new Set();
let health={checking:false,status:'idle',last_checked:0,last_switch:0,failures:[]},healthTask=null,eventTimer=null,lastEventCheck=0;
const FIRST_LIMIT=firefox?8:32;
function tabProbe(id){return probe?.tabId===id?probe:[...fastProbes.values()].find(p=>p.tabId===id);}
const ready=api.storage.local.get(['settings','progress','health']).then(data=>{
  if(data.settings)Object.assign(settings,data.settings);
  if(data.progress)Object.assign(progress,data.progress,{running:false,phase:'idle'});
  if(data.health)Object.assign(health,data.health,{checking:false});
  if(!Array.isArray(health.failures))health.failures=[];if(health.status==='checking')health.status='idle';
});
api.storage.local.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'});
async function save(){await api.storage.local.set({settings,progress,health});}
function trusted(sender){return sender.id===api.runtime.id && sender.url?.startsWith(api.runtime.getURL(''));}
function httpURL(value,allowLocal=false){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Нужен HTTP/HTTPS адрес без логина и пароля.');if(!allowLocal&&Core.bypass(u.hostname))throw new Error('Для проверки укажите внешний сайт.');u.hash='';return u.href;}
function proxyInfo(value){const p=Core.parseProxy(value,true);return {type:p.scheme==='socks5'?'socks':p.scheme,host:p.host,port:p.port,...(p.scheme==='socks5'?{proxyDNS:true,username:p.username,password:p.password}:{}),failoverTimeout:5};}
function proxyDirective(url){const p=Core.parseProxy(url,firefox);return ({http:'PROXY',https:'HTTPS',socks4:'SOCKS',socks5:'SOCKS5'})[p.scheme]+' '+(p.host.includes(':')?'['+p.host+']':p.host)+':'+p.port;}
function pac(){
  // HTTPS PAC inputs omit paths in Chromium; scope these temporary rules by host.
  const base=settings.config?Core.pac(settings.config).replace('FindProxyForURL','TMProxyBase'):'function TMProxyBase(url,host){return "DIRECT";}';
  const rule=probe?{host:new URL(probe.target).hostname,proxy:proxyDirective(probe.url),expires:Date.now()+15000}:null;
  const fast={};for(const entry of fastProbes.values())fast[entry.target]=proxyDirective(entry.url);
  return base+'\nfunction FindProxyForURL(url,host){var f='+JSON.stringify(fast)+';if(Object.prototype.hasOwnProperty.call(f,url))return f[url];var r='+JSON.stringify(rule)+';if(r && Date.now()<r.expires && host===r.host)return r.proxy;return TMProxyBase(url,host);}';
}
async function canControl(){const control=await api.proxy.settings.get(firefox?{}:{incognito:false});if(['not_controllable','controlled_by_other_extensions'].includes(control.levelOfControl))throw new Error('Прокси управляется другим расширением. Сначала выключите его.');if(firefox&&['manual','autoConfig'].includes(control.value?.proxyType))throw new Error('Отключите ручной/PAC-прокси в настройках соединения Firefox.');}
async function apply(){
  if(!firefox){
    if(settings.config||probe||fastProbes.size)await api.proxy.settings.set({value:{mode:'pac_script',pacScript:{data:pac(),mandatory:true}},scope:'regular'});
    else await api.proxy.settings.clear({scope:'regular'});
  }
  await api.action.setBadgeText({text:progress.running||health.checking?'…':settings.config?(settings.auto_switch&&health.status==='unavailable'?'!':'ON'):''});
  await api.action.setBadgeBackgroundColor({color:'#427da1'});
}
if(firefox)api.proxy.onRequest.addListener(async details=>{
  await ready;
  const candidate=tabProbe(details.tabId);if(candidate)return [proxyInfo(candidate.url),null];
  if(!settings.config)return undefined;
  if(!Core.applies(new URL(details.url).hostname,settings.config))return {type:'direct'};
  return [proxyInfo(settings.config.url),null];
},{urls:['<all_urls>']});
if(firefox){
  // Probe tabs are inert and do not use or change the user's website cookies.
  api.webRequest.onBeforeRequest.addListener(d=>{if(tabProbe(d.tabId)){testRequests.add(d.requestId);return d.type!=='main_frame'?{cancel:true}:{};}return {};},
    {urls:['<all_urls>']},['blocking']);
  api.webRequest.onBeforeSendHeaders.addListener(d=>!!tabProbe(d.tabId)?
    {requestHeaders:d.requestHeaders.filter(h=>!['cookie','authorization'].includes(h.name.toLowerCase()))}:{},
    {urls:['<all_urls>']},['blocking','requestHeaders']);
  api.webRequest.onHeadersReceived.addListener(d=>!!tabProbe(d.tabId)?
    {responseHeaders:[...d.responseHeaders.filter(h=>!['set-cookie','content-security-policy'].includes(h.name.toLowerCase())),
      {name:'Content-Security-Policy',value:"default-src 'none'; sandbox allow-same-origin"}]}:{},
    {urls:['<all_urls>']},['blocking','responseHeaders']);
}
else api.webRequest.onHeadersReceived.addListener(d=>{
  if(probe && d.url===probe.target && d.initiator===api.runtime.getURL('').replace(/\/$/,'') ){
    if(d.statusCode>=300&&d.statusCode<400){
      const location=d.responseHeaders.find(h=>h.name.toLowerCase()==='location')?.value;
      if(location)probe.redirect=new URL(location,d.url).href;
    }
    probe.headersReady?.();
  }
},{urls:['<all_urls>']},['responseHeaders']);
const authAttempts=new Map();
async function auth(details){
  await ready;if(!details.isProxy)return tabProbe(details.tabId)?{cancel:true}:{};
  const specific=tabProbe(details.tabId)||fastProbes.get(details.url);
  const candidates=[specific?.url,probe?.url,...[...fastProbes.values()].map(p=>p.url),settings.config?.url].filter(Boolean);
  const p=candidates.map(url=>Core.parseProxy(url,firefox)).find(p=>p.host===details.challenger.host.replace(/^\[|\]$/g,'')&&p.port===details.challenger.port&&p.username);
  if(!p)return (specific||probe)?{cancel:true}:{};
  if(authAttempts.has(details.requestId))return {cancel:true};
  authAttempts.set(details.requestId,true);if(authAttempts.size>1000)authAttempts.clear();
  return {authCredentials:{username:p.username,password:p.password}};
}
if(firefox)api.webRequest.onAuthRequired.addListener(auth,{urls:['<all_urls>']},['blocking']);
else api.webRequest.onAuthRequired.addListener((d,cb)=>auth(d).then(cb,()=>cb({cancel:true})),{urls:['<all_urls>']},['asyncBlocking']);
for(const event of [api.webRequest.onCompleted,api.webRequest.onErrorOccurred])event.addListener(d=>authAttempts.delete(d.requestId),{urls:['<all_urls>']});
async function cleanup(expected){
  if(expected && probe!==expected)return;
  controller?.abort();controller=null;
  const tab=probe?.tabId;probe=null;
  if(tab!==undefined)try{await api.tabs.remove(tab);}catch{}
  await api.alarms.clear('probe-expiry');await apply();
}
async function cancel(){runId++;progress.running=false;loading=false;owner=null;progress.phase='idle';
  const pending=[...fastProbes.values()];fastProbes.clear();for(const p of pending)p.controller?.abort();
  await Promise.allSettled(pending.filter(p=>p.tabId!==undefined).map(p=>api.tabs.remove(p.tabId)));
  await cleanup();await save();}
api.runtime.onConnect.addListener(port=>{if(port.name==='tmproxy-checker'&&trusted(port.sender))port.onDisconnect.addListener(()=>{if(port.sender.tab?.id===owner)cancel().catch(()=>{});});});
api.tabs.onRemoved.addListener(id=>{if(id===owner)cancel().catch(()=>{});});
api.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='probe-expiry')cancel().catch(()=>{});});

async function check(url,target,json=false,healthCheck=false){
  const active=()=>healthCheck?!!settings.config&&settings.auto_switch&&!progress.running&&!loading:progress.running;
  if(!active())throw new Error('Проверка остановлена');
  Core.parseProxy(url,firefox);target=httpURL(target);
  const began=Date.now(),generation=runId;let ownProbe;
  if(!firefox){
    ownProbe={url,target};probe=ownProbe;await apply();
    if(generation!==runId||!active())throw new Error('Проверка остановлена');await api.alarms.create('probe-expiry',{when:Date.now()+20000});
    controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),json?4000:(settings.first_timeout===1200?3000:6500));
    try{
      for(let hop=0;hop<8;hop++){
        if(generation!==runId||!active())throw new Error('Проверка остановлена');
        ownProbe.redirect=null;
        const headersReady=new Promise(resolve=>{ownProbe.headersReady=resolve;});
        const response=await fetch(ownProbe.target,{cache:'no-store',credentials:'omit',redirect:'manual',signal:controller.signal});
        // webRequest notifications and the fetch promise use different event queues.
        if(response.type==='opaqueredirect'&&!ownProbe.redirect)await Promise.race([headersReady,new Promise(resolve=>setTimeout(resolve,250))]);
        if(ownProbe.redirect){
          await response.body?.cancel();ownProbe.target=httpURL(ownProbe.redirect);await apply();continue;
        }
        if(response.status<200||response.status>=300)throw new Error('HTTP '+response.status);
        const data=json?await response.json():null;
        if(!json)await response.body?.cancel();
        return {latency:Date.now()-began,data};
      }
      throw new Error('Слишком много перенаправлений');
    }finally{clearTimeout(timer);await cleanup(ownProbe);}
  }
  // Firefox does not route the extension's own fetch through onRequest: use a dedicated inactive tab.
  const tab=await api.tabs.create({url:'about:blank',active:false});
  if(generation!==runId||!active()){await api.tabs.remove(tab.id);throw new Error('Проверка остановлена');}
  ownProbe={url,target,tabId:tab.id};probe=ownProbe;
  const navigation=new URL(target);navigation.searchParams.set('_tmproxy',crypto.randomUUID());
  await api.alarms.create('probe-expiry',{when:Date.now()+20000});
  try{
    await new Promise((resolve,reject)=>{
      let settled=false;
      const completed=json?api.webRequest.onCompleted:api.webRequest.onHeadersReceived;
      const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);completed.removeListener(done);api.webRequest.onErrorOccurred.removeListener(failed);controller=null;error?reject(error):resolve();};
      const done=d=>{if(d.tabId===tab.id&&d.type==='main_frame'){if((d.statusCode>=300&&d.statusCode<400)||d.statusCode===407)return;if(d.statusCode>=200&&d.statusCode<300)finish();else finish(new Error('HTTP '+d.statusCode));}};
      const failed=d=>{if(d.tabId===tab.id&&d.type==='main_frame')finish(new Error('Соединение с сайтом не удалось'));};
      const timer=setTimeout(()=>finish(new Error('Timeout')),json?5000:(settings.first_timeout===1200?3000:7000));
      controller={abort:()=>finish(new Error('Проверка остановлена'))};
      completed.addListener(done,{urls:['<all_urls>']});api.webRequest.onErrorOccurred.addListener(failed,{urls:['<all_urls>']});
      api.tabs.update(tab.id,{url:navigation.href}).catch(finish);
    });
    let data=null;
    if(json){const result=await api.scripting.executeScript({target:{tabId:tab.id},func:()=>document.body.innerText});data=JSON.parse(result[0].result);}
    return {latency:Date.now()-began,data};
  }finally{await cleanup(ownProbe);}
}

// Each HTTP probe gets its own URL and PAC rule, so proxies can be tested concurrently.
async function firstBatch(urls){
  if(!progress.running||probe||fastProbes.size)throw new Error('Another check is active');
  if(!Array.isArray(urls)||!urls.length||urls.length>FIRST_LIMIT)throw new Error('Invalid first-stage batch');
  const generation=runId,entries=urls.map(url=>{
    Core.parseProxy(url,firefox);
    return {url,target:'http://connectivitycheck.gstatic.com/generate_204?tmproxy='+crypto.randomUUID(),controller:new AbortController()};
  });
  for(const entry of entries)fastProbes.set(entry.target,entry);
  progress.phase='connection';await apply();
  await api.alarms.create('probe-expiry',{when:Date.now()+20000});
  const timeout=settings.first_timeout||1200;
  async function test(entry){
    if(generation!==runId||!progress.running)return null;
    const began=Date.now();let timer;
    try{
      if(!firefox){
        timer=setTimeout(()=>entry.controller.abort(),timeout);
        const response=await fetch(entry.target,{cache:'no-store',credentials:'omit',redirect:'error',signal:entry.controller.signal});
        const ok=response.status>=200&&response.status<300;await response.body?.cancel();if(!ok)return null;
      }else{
        const tab=await api.tabs.create({url:'about:blank',active:false});entry.tabId=tab.id;
        if(generation!==runId||!progress.running){await api.tabs.remove(tab.id);return null;}
        await new Promise((resolve,reject)=>{
          let settled=false;
          const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);entry.controller.signal.removeEventListener('abort',aborted);api.webRequest.onCompleted.removeListener(done);api.webRequest.onErrorOccurred.removeListener(failed);error?reject(error):resolve();};
          const done=d=>{if(d.tabId===tab.id&&d.type==='main_frame')finish(d.statusCode>=200&&d.statusCode<300?null:new Error('HTTP '+d.statusCode));};
          const failed=d=>{if(d.tabId===tab.id&&d.type==='main_frame')finish(new Error('Unavailable'));};
          const aborted=()=>finish(new Error('Cancelled'));
          entry.controller.signal.addEventListener('abort',aborted,{once:true});
          timer=setTimeout(()=>finish(new Error('Timeout')),timeout);
          api.webRequest.onCompleted.addListener(done,{urls:['<all_urls>']});api.webRequest.onErrorOccurred.addListener(failed,{urls:['<all_urls>']});
          api.tabs.update(tab.id,{url:entry.target}).catch(finish);
        });
      }
      return {url:entry.url,connection_ms:Date.now()-began};
    }catch{return null;}
    finally{clearTimeout(timer);if(entry.tabId!==undefined)try{await api.tabs.remove(entry.tabId);}catch{}}
  }
  try{
    const outcomes=await Promise.all(entries.map(test));
    if(generation!==runId||!progress.running)return {alive:[],cancelled:true};
    const alive=outcomes.filter(Boolean);for(const row of alive){
      if(generation!==runId||!progress.running)return {alive:[],cancelled:true};
      await TMProxyDB.put('alive',row);
      if(!settings.target){
        if(generation!==runId||!progress.running)return {alive:[],cancelled:true};
        await TMProxyDB.put('results',{url:row.url,latency:row.connection_ms,verified_at:Date.now(),target:'',verification:'connection'});
      }
    }
    if(generation!==runId||!progress.running)return {alive:[],cancelled:true};
    progress.first_checked=(progress.first_checked||0)+entries.length;progress.alive+=alive.length;progress.checked+=settings.target?entries.length-alive.length:entries.length;
    if(!settings.target)progress.working+=alive.length;
    await save();return {alive,progress};
  }finally{
    for(const entry of entries){entry.controller.abort();fastProbes.delete(entry.target);}
    if(generation===runId){await api.alarms.clear('probe-expiry');await apply();}
  }
}

function normalize(line,scheme){line=line.trim().replace(/^\uFEFF/,'');if(!line||line.startsWith('#'))return null;if(!line.includes('://'))line=scheme+'://'+line;Core.parseProxy(line,firefox);return line.replace(/\/$/,'');}
async function load(source,manual,scheme,target,geo){
  await stopHealth();
  if(progress.running||loading)throw new Error('Сначала остановите текущую проверку.');
  await canControl();const generation=++runId;loading=true;progress={phase:'loading',running:false,total:0,checked:0,alive:0,working:0,error:''};await save();
  await TMProxyDB.clear('queue');await TMProxyDB.clear('alive');
  let batch=[],invalid=0;
  async function line(value){if(generation!==runId)throw new Error('Загрузка списка остановлена');try{const url=normalize(value,scheme);if(url)batch.push({url});}catch{invalid++;}if(batch.length>=256){await TMProxyDB.putMany(batch);batch=[];}}
  try{
    target=typeof target==='string'?target.trim():'';if(target)target=httpURL(target);
    if(source){
      source=httpURL(source,true);controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),30000);
      try{
        const response=await fetch(source,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Список: HTTP '+response.status);
        await TMProxyLists.consume(response,line,scheme,()=>loading&&generation===runId);
      }finally{clearTimeout(timer);controller=null;}
    }
    for(const value of (manual||'').split(/\r?\n/))await line(value);
    if(batch.length)await TMProxyDB.putMany(batch);
    const total=await TMProxyDB.count('queue');if(generation!==runId)throw new Error('Загрузка списка остановлена');if(!total)throw new Error('В списке нет поддерживаемых адресов. Проверьте протокол.');
    await TMProxyDB.clear('results');
    settings.source=source||'';settings.protocol=scheme;settings.target=target;settings.geo=geo;
    // Save only a successfully loaded list/protocol after there is something to check.
    if(source)settings.sources=[{url:source,protocol:scheme},...settings.sources.filter(s=>!(s.url===source&&s.protocol===scheme))];
    progress.total=total;progress.phase='ready';progress.error=invalid?'Пропущено неподдерживаемых строк: '+invalid:'';await save();return total;
  }catch(error){if(generation===runId){progress.phase='idle';progress.error=error.message;await save();}throw error;}finally{if(generation===runId)loading=false;}
}
async function start(tabId){await stopHealth();if(progress.running||loading)throw new Error('Проверка уже запущена');await canControl();runId++;owner=tabId;progress.running=true;progress.phase='checking';progress.checked=progress.alive=progress.working=progress.first_checked=progress.site_checked=0;await save();await apply();}
async function geoAllowed(){
  if(!firefox)return true;
  try{return (await api.permissions.getAll()).data_collection?.includes('locationInfo')===true;}catch{return false;}
}
async function candidate(url,siteOnly=false){
  if(!progress.running)throw new Error('Проверка остановлена');
  const generation=runId;const active=()=>progress.running&&generation===runId;
  let result=null,reason='';
  try{
    if(siteOnly){if(!await TMProxyDB.get('alive',url))throw new Error('First stage required');}
    else{progress.phase='connection';await check(url,'http://connectivitycheck.gstatic.com/generate_204?tmproxy='+crypto.randomUUID());if(!active())throw new Error('Проверка остановлена');progress.alive++;}
    if(!active())throw new Error('Проверка остановлена');
    if(!settings.target)throw new Error('Website stage disabled');
    progress.phase='site';const tested=await check(url,settings.target);
    let code='';
    if(settings.geo&&active()&&await geoAllowed()){progress.phase='country';try{const geo=await check(url,'https://api.country.is/',true);if(/^[A-Z]{2}$/.test(geo.data?.country))code=geo.data.country;}catch{}}
    if(active()){result={url,latency:tested.latency,country_code:code,verified_at:Date.now(),target:settings.target};await TMProxyDB.put('results',result);if(active())progress.working++;else result=null;}
  }catch(error){reason=error.message.includes('HTTP ')?error.message:'Соединение/сайт недоступен, перенаправление или тайм-аут';}
  if(active()){progress.checked++;progress.site_checked=(progress.site_checked||0)+1;progress.phase='checking';await save();}
  return {result,reason,progress};
}
async function healthAlarm(){
  if(settings.auto_switch&&settings.config){if(!await api.alarms.get('proxy-health'))await api.alarms.create('proxy-health',{periodInMinutes:1});}
  else await api.alarms.clear('proxy-health');
}
async function stopHealth(){
  if(eventTimer){clearTimeout(eventTimer);eventTimer=null;}
  if(!healthTask)return;
  const task=healthTask;runId++;await cleanup();await task.catch(()=>{});
}
function canMonitor(){return settings.auto_switch&&settings.config&&!progress.running&&!loading&&progress.phase!=='ready'&&!fastProbes.size;}
function monitor(){
  if(healthTask)return healthTask;
  if(!canMonitor()||probe)return Promise.resolve();
  const initial=settings.config,generation=runId;
  const active=()=>generation===runId&&canMonitor()&&settings.config===initial;
  healthTask=(async()=>{
    health.checking=true;health.status='checking';await save();
    try{
      await canControl();
      if(!active())return;
      try{
        await check(initial.url,settings.target||'http://connectivitycheck.gstatic.com/generate_204?tmproxy='+crypto.randomUUID(),false,true);
        if(active()){health.status='healthy';health.failures=health.failures.filter(item=>item.url!==initial.url);}
        return;
      }catch{if(!active())return;}
      const now=Date.now();
      health.failures=health.failures.filter(item=>item.until>now&&item.url!==initial.url);
      health.failures.push({url:initial.url,until:now+5*60*1000});
      const rows=await TMProxyDB.all('results');
      const candidates=TMProxyFailover.candidates(rows,initial.url,health.failures,now).filter(row=>{try{Core.parseProxy(row.url,firefox);return true;}catch{return false;}});
      for(const row of candidates.slice(0,10)){
        if(!active())return;
        try{await check(row.url,settings.target||'http://connectivitycheck.gstatic.com/generate_204?tmproxy='+crypto.randomUUID(),false,true);}catch{
          if(!active())return;
          health.failures.push({url:row.url,until:Date.now()+5*60*1000});continue;
        }
        if(!active())return;
        const next={...initial,url:row.url};settings.config=next;
        try{await apply();}catch(error){if(generation===runId&&settings.config===next){settings.config=initial;await apply().catch(()=>{});}throw error;}
        if(generation!==runId)return;
        health.status='switched';health.last_switch=Date.now();await save();return;
      }
      if(active())health.status='unavailable';
    }catch{if(generation===runId)health.status='error';}
    finally{
      health.checking=false;
      if(generation===runId){health.last_checked=Date.now();await apply();}
      else if(health.status==='checking')health.status='idle';
      await save();
    }
  })().finally(()=>{healthTask=null;});
  return healthTask;
}
api.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='proxy-health')ready.then(monitor).catch(()=>{});});
api.webRequest.onCompleted.addListener(d=>testRequests.delete(d.requestId),{urls:['<all_urls>']});
api.webRequest.onErrorOccurred.addListener(d=>{
  const own=testRequests.delete(d.requestId);
  if(own||!Number.isInteger(d.tabId)||d.tabId<0||tabProbe(d.tabId)||health.checking||!canMonitor())return;
  try{const u=new URL(d.url);if(!['http:','https:'].includes(u.protocol)||!Core.applies(u.hostname,settings.config))return;}catch{return;}
  if(eventTimer)return;
  const delay=Math.max(500,5000-(Date.now()-lastEventCheck));
  eventTimer=setTimeout(()=>{eventTimer=null;lastEventCheck=Date.now();ready.then(monitor).catch(()=>{});},delay);
},{urls:['<all_urls>']});

api.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!trusted(sender))return false;
  (async()=>{
    await ready;
    switch(message.type){
      case 'state':return {settings,progress,results:TMProxyLists.sortResults(await TMProxyDB.all('results')),health,firefox,first_limit:FIRST_LIMIT};
      case 'load':if(!progress.running&&!loading)owner=sender.tab?.id;return load(message.source,message.manual,message.protocol,message.target,message.geo);
      case 'start':await start(sender.tab?.id);return true;
      case 'batch':return TMProxyDB.batch(message.after,message.stage==='site'?'alive':'queue');
      case 'first-batch':if(sender.tab?.id!==owner)throw new Error('Проверкой управляет другая вкладка.');return firstBatch(message.urls);
      case 'probe':if(sender.tab?.id!==owner)throw new Error('Проверкой управляет другая вкладка.');return candidate(message.url,message.stage==='site');
      case 'finish':if(sender.tab?.id!==owner)throw new Error('Проверкой управляет другая вкладка.');await cancel();return true;
      case 'cancel':await cancel();return true;
      case 'preferences':
        if(message.auto_switch!==undefined){
          if(typeof message.auto_switch!=='boolean')throw new Error('Invalid automatic switching setting');
          settings.auto_switch=message.auto_switch;
          if(!settings.auto_switch)await stopHealth();
        }
        if(message.language!==undefined){if(!['auto','ru','en'].includes(message.language))throw new Error('Invalid language');settings.language=message.language;}
        if(message.first_timeout!==undefined){if(![1200,2500].includes(message.first_timeout))throw new Error('Invalid timeout');settings.first_timeout=message.first_timeout;}
        await save();if(message.auto_switch!==undefined){await healthAlarm();await apply();if(message.auto_switch)queueMicrotask(()=>monitor().catch(()=>{}));}return true;
      case 'configure':
        await stopHealth();
        if(!message.config){await cancel();settings.config=null;health.status='idle';await apply();await save();await healthAlarm();return true;}
        if(progress.running||loading)throw new Error('Сначала остановите проверку.');
        if(message.config){await canControl();Core.parseProxy(message.config.url,firefox);const rows=await TMProxyDB.all('results');if(!rows.some(r=>r.url===message.config.url))throw new Error('Выберите проверенный адрес.');settings.config={url:message.config.url,mode:message.config.mode==='sites'?'sites':'all',domains:message.config.mode==='sites'?Core.domains(message.config.sites):[]};}
        else settings.config=null;
        health.status='idle';await apply();await save();await healthAlarm();if(settings.auto_switch)queueMicrotask(()=>monitor().catch(()=>{}));return true;
      default:throw new Error('Неизвестная команда');
    }
  })().then(result=>reply({result}),error=>reply({error:error.message}));return true;
});
ready.then(async()=>{await apply();await healthAlarm();}).catch(()=>{});
