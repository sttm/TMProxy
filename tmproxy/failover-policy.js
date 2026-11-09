/* Rotation stays within the verified pool and preserves the current domain rules. */
(function(root){
  function candidates(rows,current,failures=[],now=Date.now()){
    const blocked=new Set(failures.filter(item=>item.until>now).map(item=>item.url));
    const ordered=[...rows].sort((a,b)=>a.latency-b.latency||(a.url<b.url?-1:a.url>b.url?1:0));
    const index=ordered.findIndex(row=>row.url===current);
    const rotated=index<0?ordered:ordered.slice(index+1).concat(ordered.slice(0,index));
    return rotated.filter(row=>row.url!==current&&!blocked.has(row.url));
  }
  root.TMProxyFailover={candidates};
  if(typeof module!=='undefined')module.exports=root.TMProxyFailover;
})(globalThis);
