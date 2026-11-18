/* 다이어리 2027 서비스 워커 v2
   - 앱 화면(index.html)은 저장해 둔 것을 먼저 보여 주고, 뒤에서 새 파일을 받아 다음 실행부터 쓴다.
   - 새 파일이 들어오면 열려 있는 화면에 알려 준다. */
const CACHE='diary2027-v2',FONT='diary2027-font';
const BASE=new URL('./',self.location).pathname;
const SHELL=['./','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('diary2027')&&k!==CACHE&&k!==FONT).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function notify(){return self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({t:'d27-update'})))}

/* 새 index.html이 있는지 확인해서 있으면 저장. 내용이 바뀌었으면 true */
let rv=null;
function revalidate(){
  if(rv)return rv;
  rv=(async()=>{
    const c=await caches.open(CACHE),key=new Request('./');
    const old=await c.match(key);
    const res=await fetch(new Request('./',{cache:'no-cache'}));
    if(!res||!res.ok||res.redirected)return false;
    const b=await res.clone().text();
    if(b.indexOf('id="pages"')<0)return false;   // 오류 페이지 같은 엉뚱한 응답은 저장하지 않는다
    const a=old?await old.text():null;
    if(a===b)return false;
    await c.put(key,res);
    return a!==null;
  })().catch(()=>false);
  rv.then(()=>{rv=null});
  return rv;
}
async function shell(e){
  const c=await caches.open(CACHE);
  const hit=await c.match(new Request('./'));
  const upd=revalidate().then(ch=>{if(ch)return notify()});
  if(hit){e.waitUntil(upd);return hit}
  await upd;
  const now=await c.match(new Request('./'));
  if(now)return now;
  try{return await fetch(e.request)}catch(x){return new Response('<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">인터넷에 연결한 뒤 다시 열어 주세요.</p>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}
}
async function asset(e,req){
  const c=await caches.open(CACHE),hit=await c.match(req);
  const net=fetch(req).then(res=>{if(res&&res.ok)return c.put(req,res.clone()).then(()=>res);return res});
  if(hit){e.waitUntil(net.catch(()=>{}));return hit}
  return net;
}
async function font(e,req){
  const c=await caches.open(FONT),hit=await c.match(req);
  if(hit){
    if(new URL(req.url).hostname==='fonts.googleapis.com')e.waitUntil(fetch(req).then(res=>{if(res&&res.ok)return c.put(req,res)}).catch(()=>{}));
    return hit;
  }
  const res=await fetch(req);
  if(res&&res.ok)e.waitUntil(c.put(req,res.clone()).catch(()=>{}));
  return res;
}
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin===self.location.origin){
    if(!u.pathname.startsWith(BASE))return;
    const rest=u.pathname.slice(BASE.length);
    if(req.mode==='navigate'||rest===''||rest==='index.html'){e.respondWith(shell(e));return}
    if(rest==='sw.js')return;
    e.respondWith(asset(e,req));return;
  }
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){e.respondWith(font(e,req))}
});
self.addEventListener('message',e=>{
  if(e.data&&e.data.t==='d27-check')e.waitUntil(revalidate().then(ch=>{if(ch)return notify()}));
});
