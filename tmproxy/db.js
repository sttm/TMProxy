/* Disk-backed candidate/result storage: no fixed list-size or address-count limit. */
(function(root){
  let opened;
  function db(){return opened ||= new Promise((resolve,reject)=>{const r=indexedDB.open('tmproxy',2);r.onupgradeneeded=()=>{for(const name of ['queue','results','alive'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'url'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function transaction(name,mode,fn){const database=await db();return new Promise((resolve,reject)=>{const t=database.transaction(name,mode);let result;const request=fn(t.objectStore(name));if(request)request.onsuccess=()=>{result=request.result;};t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('Storage transaction aborted'));});}
  root.TMProxyDB={clear:name=>transaction(name,'readwrite',s=>s.clear()),put:(name,row)=>transaction(name,'readwrite',s=>s.put(row)),
    putMany:rows=>transaction('queue','readwrite',s=>{for(const row of rows)s.put(row);}),
    count:name=>transaction(name,'readonly',s=>s.count()),all:name=>transaction(name,'readonly',s=>s.getAll()),
    get:(name,key)=>transaction(name,'readonly',s=>s.get(key)),
    batch:(after,name='queue')=>transaction(name,'readonly',s=>s.getAll(after?IDBKeyRange.lowerBound(after,true):null,128))};
})(globalThis);
