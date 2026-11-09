'use strict';
const api=typeof browser!=='undefined'?browser:chrome;
const $=id=>document.getElementById(id);
const t=(text,params)=>TMProxyI18n.t(text,params);
let snapshot=null,running=false,appliedLanguage=null;
if($('copyright'))$('copyright').textContent='© '+new Date().getFullYear()+' TMProxy';
const checkerPort=document.body.classList.contains('dashboard')?api.runtime.connect({name:'tmproxy-checker'}):null;
async function send(message){const response=await api.runtime.sendMessage(message);if(response.error)throw new Error(response.error);return response.result;}
function message(text,error=false){$('message').textContent=t(text);$('message').className=error?'error':'';}
function display(row){try{const p=TMPLAYProxy.parseProxy(row.url,snapshot?.firefox);return (TMPLAYProxy.flag(row.country_code)||'🌐')+' '+p.scheme.toUpperCase()+' · '+p.host+':'+p.port+(p.username?' · 🔒':'')+' · '+row.latency+' '+t('мс');}catch{return t('Неподдерживаемый адрес');}}
function controls(){
  if(!snapshot)return;
  const active=snapshot.progress.running||running||snapshot.progress.phase==='loading';
  $('enable').disabled=active||!snapshot.results.length;$('disable').disabled=!snapshot.settings.config&&!active;
  if($('start'))$('start').disabled=active;if($('stop'))$('stop').disabled=!active;if($('timeout'))$('timeout').disabled=active;
}
function history(){
  if(!$('history'))return;
  const current=$('history').value;$('history').replaceChildren(new Option(t('Выберите источник…'),''));
  snapshot.settings.sources.forEach((source,index)=>$('history').add(new Option(source.protocol.toUpperCase()+' · '+source.url,String(index))));$('history').value=current;
}
function render(data,initial=false){
  const previousActive=snapshot?.settings.config?.url;
  data={...data,results:[...data.results].sort((a,b)=>a.latency-b.latency)};
  snapshot=data;
  const preference=data.settings.language||'auto';
  if(appliedLanguage!==preference){TMProxyI18n.set(preference);appliedLanguage=preference;}
  $('language').value=preference;
  const selected=$('selected').value;$('selected').replaceChildren();
  for(const row of data.results){const option=new Option(display(row),row.url);try{TMPLAYProxy.parseProxy(row.url,data.firefox);}catch{option.disabled=true;}$('selected').add(option);}
  if(data.settings.config&&!data.results.some(r=>r.url===data.settings.config.url))$('selected').add(new Option(t('Активный адрес (из предыдущего списка)'),data.settings.config.url));
  if(data.settings.config&&data.settings.config.url!==previousActive)$('selected').value=data.settings.config.url;
  else if(data.results.some(r=>r.url===selected))$('selected').value=selected;else if(data.settings.config)$('selected').value=data.settings.config.url;
  $('autoSwitch').checked=!!data.settings.auto_switch;
  $('activeProxy').hidden=!data.settings.config;
  if(data.settings.config){const p=TMPLAYProxy.parseProxy(data.settings.config.url,data.firefox);$('activeProxy').textContent=t('Активный прокси: {proxy}',{proxy:p.scheme.toUpperCase()+' · '+p.host+':'+p.port});}
  const health=data.health||{};
  const status={checking:'Проверяем подключение…',healthy:'Подключение работает.',switched:'Прокси автоматически заменён.',unavailable:'Рабочая замена не найдена. Повторная проверка через минуту.',error:'Не удалось проверить подключение.'};
  $('healthStatus').textContent=data.settings.auto_switch&&data.settings.config?t(status[health.status]||''):'';
  $('count').textContent='· '+data.results.length;$('badge').textContent=t(data.settings.config?'Прокси включён':'Выключен');
  if(initial){
    $('mode').value=data.settings.config?.mode||'all';$('sites').value=data.settings.config?.domains.join('\n')||'youtube.com\ngooglevideo.com\nytimg.com';
    if($('source')){$('source').value=data.settings.source;$('protocol').value=data.settings.protocol;$('target').value=data.settings.target;$('geo').checked=data.settings.geo;$('timeout').value=String(data.settings.first_timeout||1200);}
  }
  if($('routingNote'))$('routingNote').textContent=t(data.firefox?
    'Firefox: первый этап — до 8 параллельных проверок в неактивных вкладках. Затем проверяется выбранный сайт.':
    'Chrome: первый этап — до 32 параллельных проверок. На втором этапе запросы к проверяемому домену временно идут через тестируемый прокси. Остальные сайты сохраняют обычный маршрут.');
  $('sites').hidden=$('mode').value!=='sites';
  if($('results')){$('results').replaceChildren();for(const row of data.results){const div=document.createElement('div');div.className='result';div.textContent=display(row);$('results').append(div);}}
  if($('progress')){
    const p=data.progress;
    if((running||p.running)&&(p.first_checked||0)<p.total){
      $('progress').max=Math.max(1,p.total);$('progress').value=p.first_checked||0;
      $('progressLabel').textContent=t('Этап 1 · {done} / {total} · ответили: {alive}',{done:p.first_checked||0,total:p.total,alive:p.alive});
    }else if((running||p.running)&&data.settings.target){
      $('progress').max=Math.max(1,p.alive);$('progress').value=p.site_checked||0;
      $('progressLabel').textContent=t('Этап 2 · {done} / {total} · прошли: {working}',{done:p.site_checked||0,total:p.alive,working:p.working});
    }else{
      $('progress').max=Math.max(1,p.total);$('progress').value=p.checked;
      $('progressLabel').textContent=t(data.settings.target?'Проверено {done} / {total} · соединение: {alive} · сайт: {working}':'Проверено {done} / {total} · рабочие: {working}',{done:p.checked,total:p.total,alive:p.alive,working:p.working});
    }
    history();
  }
  updateClearButtons();controls();
}
function action(id,fn){if(!$(id))return;$(id).onclick=async()=>{$(id).disabled=true;message('');try{await fn();}catch(error){message(error.message,true);}finally{$(id).disabled=false;controls();}};}
action('enable',async()=>{await send({type:'configure',config:{url:$('selected').value,mode:$('mode').value,sites:$('sites').value}});render(await send({type:'state'}));message('Прокси включён.');});
action('disable',async()=>{running=false;await send({type:'configure',config:null});render(await send({type:'state'}));message('Настройка TMProxy выключена.');});
action('open',async()=>{await api.tabs.create({url:api.runtime.getURL('dashboard.html')});window.close();});
action('stop',async()=>{running=false;await send({type:'cancel'});render(await send({type:'state'}));message('Проверка остановлена. Готовые результаты сохранены.');});
async function requestGeoConsent(){
  if(!api.proxy.onRequest)return true;
  try{return await api.permissions.request({data_collection:['locationInfo']});}
  catch{try{return (await api.permissions.getAll()).data_collection?.includes('locationInfo')===true;}catch{return false;}}
}
if($('geo'))$('geo').onchange=async()=>{if($('geo').checked&&!await requestGeoConsent())$('geo').checked=false;};
action('start',async()=>{
  // Request optional data consent directly from the user's Start gesture.
  if($('geo').checked&&$('target').value.trim()&&!await requestGeoConsent())$('geo').checked=false;
  running=true;controls();
  try{
    await send({type:'preferences',first_timeout:Number($('timeout').value)});
    await send({type:'load',source:$('source').value.trim(),manual:$('manual').value,protocol:$('protocol').value,target:$('target').value.trim(),geo:$('geo').checked});
    if(!running)return;
    await send({type:'start'});render(await send({type:'state'}));
    let after='';const limit=snapshot.first_limit;
    while(running){
      const batch=await send({type:'batch',after});if(!batch.length)break;
      for(let i=0;i<batch.length&&running;i+=limit){
        const part=batch.slice(i,i+limit);const result=await send({type:'first-batch',urls:part.map(row=>row.url)});
        after=part[part.length-1].url;
        $('last').textContent=t('Быстрый этап: ответили {alive} / {total}',{alive:result.alive.length,total:part.length});render(await send({type:'state'}));
        if(result.cancelled){running=false;break;}
      }
    }
    after='';
    while(running&&snapshot.settings.target){
      const batch=await send({type:'batch',after,stage:'site'});if(!batch.length)break;
      for(const row of batch){if(!running)break;const result=await send({type:'probe',url:row.url,stage:'site'});after=row.url;$('last').textContent=result.result?'✓ '+display(result.result):t(result.reason);render(await send({type:'state'}));}
    }
    if(running){await send({type:'finish'});message('Проверка завершена.');}
  }finally{running=false;render(await send({type:'state'}));}
});
action('export',async()=>{const rows=(await send({type:'state'})).results;const blob=new Blob([rows.map(r=>r.url).join('\n')+'\n'],{type:'text/plain'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='tmproxy-working.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('autoSwitch').onchange=async()=>{try{await send({type:'preferences',auto_switch:$('autoSwitch').checked});render(await send({type:'state'}));}catch(e){message(e.message,true);render(await send({type:'state'}));}};
function updateClearButtons(){for(const button of document.querySelectorAll('[data-clear]'))button.hidden=!$(button.dataset.clear).value;if($('geo'))$('geo').disabled=!$('target').value.trim();}
document.addEventListener('input',updateClearButtons);
for(const button of document.querySelectorAll('[data-clear]'))button.onclick=()=>{const field=$(button.dataset.clear);field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));field.focus();};
$('mode').onchange=()=>{$('sites').hidden=$('mode').value!=='sites';};
$('language').onchange=async()=>{try{await send({type:'preferences',language:$('language').value});render(await send({type:'state'}));}catch(e){message(e.message,true);}};
if($('history'))$('history').onchange=()=>{if($('history').value==='')return;const source=snapshot.settings.sources[Number($('history').value)];if(source){$('source').value=source.url;$('protocol').value=source.protocol;updateClearButtons();}};
(async()=>{render(await send({type:'state'}),true);setInterval(async()=>{try{const state=await send({type:'state'});if(!running)render(state);else{snapshot.progress=state.progress;controls();}}catch{}},1500);})().catch(e=>message(e.message,true));
