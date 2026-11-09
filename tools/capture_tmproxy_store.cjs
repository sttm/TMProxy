/* Capture the actual extension UI in an isolated Chrome profile. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');const {once}=require('node:events');
const root=path.resolve(__dirname,'..');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const executable=process.env.TMPLAY_CHROMIUM;if(!executable)throw Error('Set TMPLAY_CHROMIUM');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tmproxy-store-'));
 const extension=path.join(root,'dist/tmproxy-chrome'),port=19435;
 const chrome=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port='+port,'--remote-allow-origins=*','--user-data-dir='+temp,'--disable-extensions-except='+extension,'--load-extension='+extension,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  let worker;for(let i=0;i<100;i++){try{worker=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='service_worker'&&t.url.endsWith('/background.js'));if(worker)break;}catch{}await sleep(100);}
  if(!worker)throw Error('Extension did not load');
  const url=`chrome-extension://${new URL(worker.url).host}/dashboard.html`;
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?${url}`,{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');let id=0;const pending=new Map();
  ws.addEventListener('message',event=>{const d=JSON.parse(event.data);if(pending.has(d.id)){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await sleep(700);
  for(const language of ['en','ru']){
   await evaluate(`(async()=>{document.getElementById('language').value='${language}';await document.getElementById('language').onchange();})()`);
   for(const [number,mode] of [['01','all'],['02','all'],['03','sites']]){
    await evaluate(`(()=>{document.body.style.zoom='1';document.getElementById('mode').value='${mode}';document.getElementById('mode').onchange();document.getElementById('autoSwitch').checked=${mode==='sites'};document.activeElement.blur();window.scrollTo(0,0);})()`);
    if(number==='02')await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');
    await sleep(200);
    const dimensions=await evaluate('({width:innerWidth,height:innerHeight,lang:document.documentElement.lang})');
    const dir=path.join(root,'tmproxy/store/screenshots',language);fs.mkdirSync(dir,{recursive:true});
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const filename=path.join(dir,`${number}-${number==='02'?'checking-options':mode==='all'?'overview':'domain-rules'}.png`);fs.writeFileSync(filename,Buffer.from(shot.data,'base64'));console.log(filename,dimensions);
   }
  }
 }finally{if(ws)ws.close();if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill();await once(chrome,'exit');}fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
