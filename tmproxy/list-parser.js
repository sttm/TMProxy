/* TXT and JSON sources share the same address validation and disk-backed deduplication. */
(function(root){
  const schemes=new Set(['http','https','socks4','socks5','socks5h']);
  function objectAddress(row,fallback){
    for(const key of ['url','proxy'])if(typeof row[key]==='string')return row[key];
    if(typeof row.address==='string'&&(row.port===undefined||row.address.includes('://')))return row.address;
    const host=row.host??row.ip??row.ip_address??row.address;
    if(typeof host!=='string'||!host)return null;
    const available=Array.isArray(row.protocols)?row.protocols.map(p=>String(p).toLowerCase()).filter(p=>schemes.has(p)):[];
    const scheme=String(row.protocol??row.scheme??(available.includes(fallback)?fallback:available[0])??fallback).toLowerCase();
    const username=row.username??row.user,password=row.password??row.pass;
    const auth=typeof username==='string'?encodeURIComponent(username)+':'+encodeURIComponent(typeof password==='string'?password:'')+'@':'';
    const hostname=host.includes(':')&&!host.startsWith('[')&&row.port!==undefined?'['+host+']':host;
    return scheme+'://'+auth+hostname+(row.port!==undefined?':'+row.port:'');
  }
  function* jsonAddresses(value,protocol='http'){
    const stack=[{value,protocol}];
    while(stack.length){
      const entry=stack.pop(),item=entry.value;
      if(typeof item==='string'){yield item.includes('://')?item:entry.protocol+'://'+item;continue;}
      if(Array.isArray(item)){for(let i=item.length-1;i>=0;i--)stack.push({value:item[i],protocol:entry.protocol});continue;}
      if(!item||typeof item!=='object')continue;
      const address=objectAddress(item,entry.protocol);if(address){yield address;continue;}
      const children=Object.entries(item).filter(([key])=>['proxies','data','results','list','items'].includes(key)||schemes.has(key.toLowerCase()));
      for(let i=children.length-1;i>=0;i--){const [key,child]=children[i];stack.push({value:child,protocol:schemes.has(key.toLowerCase())?key.toLowerCase():entry.protocol});}
    }
  }
  function looksJSON(text){const first=text.trimStart();return first.startsWith('{')||(first.startsWith('[')&&(/^[\[\s]*["{\[\]]/.test(first.slice(1))||first==='[]'));}
  async function consume(response,onAddress,protocol='http',active=()=>true){
    if(!response.body)return;
    const contentType=response.headers.get('content-type')||'';
    let json=/\bjson\b/i.test(contentType)||/\.json$/i.test(new URL(response.url||'https://list.invalid/').pathname)?true:null;
    const reader=response.body.getReader(),decoder=new TextDecoder();
    const chunks=[];let prefix='',pending='',dropping=false;
    async function txt(text){
      for(const part of text.split(/(?<=\n)/)){
        if(!active())throw new Error('Загрузка списка остановлена');
        const ended=part.endsWith('\n');if(!dropping)pending+=part;
        if(pending.length>8192){pending='';dropping=true;}
        if(ended){if(!dropping)await onAddress(pending);pending='';dropping=false;}
      }
    }
    async function accept(text,final=false){
      if(json===null){
        prefix+=text;const trimmed=prefix.trimStart();
        if(!final&&(!trimmed||(/^\[\s*$/.test(trimmed))))return;
        json=looksJSON(prefix);text=prefix;prefix='';
      }
      if(json)chunks.push(text);else await txt(text);
    }
    try{
      while(true){
        if(!active()){await reader.cancel();throw new Error('Загрузка списка остановлена');}
        const item=await reader.read();if(item.done)break;await accept(decoder.decode(item.value,{stream:true}));
      }
      await accept(decoder.decode(),true);
      if(json){
        let value;try{value=JSON.parse(chunks.join(''));}catch{throw new Error('Некорректный JSON-список.');}
        for(const address of jsonAddresses(value,protocol)){if(!active())throw new Error('Загрузка списка остановлена');await onAddress(address);}
      }else if(pending&&!dropping)await onAddress(pending);
    }finally{reader.releaseLock();}
  }
  function sortResults(rows){
    const latency=row=>Number.isFinite(row.latency)&&row.latency>=0?row.latency:Infinity;
    return [...rows].sort((a,b)=>latency(a)-latency(b)||(a.url<b.url?-1:a.url>b.url?1:0));
  }
  root.TMProxyLists={jsonAddresses,consume,sortResults};
  if(typeof module!=='undefined')module.exports=root.TMProxyLists;
})(globalThis);
