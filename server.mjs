import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHash, verifyPassword, createSessions } from './server/auth.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function configFromEnv(env=process.env){
  const base=(env.BASE_PATH||'/vaka-atolyesi').replace(/\/$/,'');
  if(!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(base))throw new Error('BASE_PATH /vaka-atolyesi gibi olmalıdır.');
  parseHash(env.CAMP_PASSWORD_HASH);
  if(!/^[a-fA-F0-9]{64}$/.test(env.SESSION_SECRET||''))throw new Error('SESSION_SECRET 32 bayt rastgele hex değer olmalıdır.');
  const origin=new URL(env.PUBLIC_ORIGIN||'');
  if(!['http:','https:'].includes(origin.protocol)||origin.origin!==env.PUBLIC_ORIGIN)throw new Error('PUBLIC_ORIGIN yalnız origin içermeli.');
  const secure=origin.protocol==='https:';
  if(!secure&&(env.NODE_ENV!=='development'||!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw new Error('Canlı kurulum HTTPS gerektirir.');
  const port=Number(env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT geçersiz.');
  return {base,origin:origin.origin,secure,port,host:env.HOST||'127.0.0.1',passwordHash:env.CAMP_PASSWORD_HASH,secret:Buffer.from(env.SESSION_SECRET,'hex'),enabled:env.CAMP_ENABLED!=='false',trustProxy:env.TRUST_PROXY==='true',publicDir:resolve(dir,'public')};
}
function loginPage(base,message=''){
 return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skolyoz Atölyesi · Kamp girişi</title><link rel="stylesheet" href="${base}/ui/login.css"></head><body><main><p class="eyebrow">Skolyoz Atölyesi / Kamp Erişimi</p><h1>Skolyoz<br>Vaka Atölyesi</h1><p>Kamp şifrenizle eğitime giriş yapın.</p>${message?`<p class="error" role="alert">${escape(message)}</p>`:''}<form method="post" action="${base}/login"><label for="password">Ortak kamp şifresi</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button type="submit">Atölyeye gir</button></form><p class="footnote">3 hasta · 4 bölüm · 17 karar</p></main></body></html>`;
}
function cookieToken(req){const all=(req.headers.cookie||'').split(';');return all.map(x=>x.trim()).find(x=>x.startsWith('kamp_oturumu='))?.slice(13)}
export async function createApp(config){
 const sessions=createSessions(config.secret,config.passwordHash,config.base);
 const root=await realpath(config.publicDir);
 const template=await readFile(resolve(root,'index.html'),'utf8');
 const logout=`<form action="${config.base}/logout" method="post"><button class="btn" type="submit">Çıkış yap</button></form>`;
 const page=template.replace('</header>',logout+'</header>').replace('</head>','<style>header{flex-wrap:wrap}header form{margin:0}</style></head>');
 const attempts=new Map();let activeChecks=0,lastCleanup=0,globalAttempts=[];
 const cookie=(token,age)=>`kamp_oturumu=${token}; Path=${config.base}; Max-Age=${age}; HttpOnly; SameSite=Lax${config.secure?'; Secure':''}`;
 function respond(res,status,body='',type='text/html; charset=utf-8',extra={}){res.writeHead(status,{'Content-Type':type,...extra});res.end(body)}
 function redirect(res,path,extra={}){respond(res,303,'','text/plain; charset=utf-8',{'Location':path,...extra})}
 function clientKey(req){return config.trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim().slice(0,100):req.socket.remoteAddress||'unknown'}
 function reserve(req){
  const now=Date.now();if(now-lastCleanup>60000){for(const [k,v]of attempts)if(v.until<=now)attempts.delete(k);lastCleanup=now}
  globalAttempts=globalAttempts.filter(t=>now-t<60000);
  const ip=clientKey(req);let entry=attempts.get(ip);if(entry?.until<=now)entry=null;
  if(entry?.count>=10||globalAttempts.length>=200||attempts.size>=10000&&!entry)return null;
  if(!entry){entry={count:0,until:now+15*60*1000};attempts.set(ip,entry)}
  entry.count++;globalAttempts.push(now);return entry;
 }
 function body(req){return new Promise((resolveBody,reject)=>{let bytes=0,chunks=[],failed=false;req.on('data',chunk=>{if(failed)return;bytes+=chunk.length;if(bytes>2048){failed=true;chunks=[];const e=new Error('BODY_LIMIT');e.status=413;reject(e)}else chunks.push(chunk)});req.on('end',()=>{if(!failed)resolveBody(Buffer.concat(chunks).toString('utf8'))});req.on('aborted',()=>reject(Object.assign(new Error('ABORTED'),{status:400})));req.on('error',reject)})}
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'");
  try{
   const url=new URL(req.url,'http://internal.invalid');let path;
   try{path=decodeURIComponent(url.pathname)}catch{return respond(res,400,'Geçersiz adres.')}
   if(!path.startsWith(config.base+'/')&&path!==config.base)return respond(res,404,'Bulunamadı.');
   if(!config.enabled)return respond(res,503,'Kamp erişimi şu anda kapalı.');
   if(path===config.base)return redirect(res,config.base+'/');
   if(!['GET','HEAD','POST'].includes(req.method))return respond(res,405,'Yöntem desteklenmiyor.','text/plain',{'Allow':'GET, HEAD, POST'});
   if(req.method==='POST'){
    if(req.headers.origin!==config.origin)return respond(res,403,'İstek kaynağı doğrulanamadı.');
    if(path===config.base+'/logout')return redirect(res,config.base+'/',{'Set-Cookie':cookie('',0)});
    if(path!==config.base+'/login')return respond(res,404,'Bulunamadı.');
    if(!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))return respond(res,415,'Form biçimi desteklenmiyor.');
    if(activeChecks>=4)return respond(res,503,loginPage(config.base,'Yoğunluk var. Birkaç saniye sonra yeniden deneyin.'),'text/html; charset=utf-8',{'Retry-After':'3'});
    const entry=reserve(req);if(!entry)return respond(res,429,loginPage(config.base,'Çok fazla giriş denemesi. Daha sonra tekrar deneyin.'),'text/html; charset=utf-8',{'Retry-After':'900'});
    activeChecks++;
    try{
     const values=new URLSearchParams(await body(req));const password=values.get('password');
     if(values.getAll('password').length!==1||!password||password.length>256)return respond(res,400,loginPage(config.base,'Şifreyi kontrol edip yeniden deneyin.'));
     if(!await verifyPassword(password,config.passwordHash))return respond(res,401,loginPage(config.base,'Şifreyi kontrol edip yeniden deneyin.'));
     entry.count=Math.max(0,entry.count-1);
     return redirect(res,config.base+'/',{'Set-Cookie':cookie(sessions.issue(),28800)});
    }finally{activeChecks--}
   }
   const publicUi=['ui/login.css','ui/nunito.woff','ui/plus-jakarta.woff'].some(name=>path===config.base+'/'+name);
   if(!publicUi&&!sessions.valid(cookieToken(req))){
    if(path===config.base+'/'||path===config.base+'/index.html'||path===config.base+'/login')return respond(res,200,req.method==='HEAD'?'':loginPage(config.base));
    return respond(res,401,'Kamp girişi gerekiyor.','text/plain; charset=utf-8');
   }
   if(path===config.base+'/login')return redirect(res,config.base+'/');
   if(path===config.base+'/'||path===config.base+'/index.html')return respond(res,200,req.method==='HEAD'?'':page);
   const relative=path.slice(config.base.length+1);
   if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(s=>!s||s.startsWith('.')))return respond(res,404,'Bulunamadı.');
   let file,details;try{file=await realpath(resolve(root,relative));if(!file.startsWith(root+sep))return respond(res,404,'Bulunamadı.');details=await stat(file);if(!details.isFile())return respond(res,404,'Bulunamadı.')}catch{return respond(res,404,'Bulunamadı.')}
   const types={'.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.pdf':'application/pdf','.css':'text/css','.js':'text/javascript','.woff':'font/woff'};
   const type=types[extname(file)]||'application/octet-stream';let start=0,end=details.size-1,status=200;
   const range=req.headers.range;
   if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2]))return respond(res,416,'','text/plain',{'Content-Range':`bytes */${details.size}`});
    if(!m[1])start=Math.max(0,details.size-Number(m[2]));else start=Number(m[1]);if(m[1]&&m[2])end=Math.min(end,Number(m[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=details.size)return respond(res,416,'','text/plain',{'Content-Range':`bytes */${details.size}`});status=206;
   }
   const headers={'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes'};if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${details.size}`;
   res.writeHead(status,headers);if(req.method==='HEAD')return res.end();
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(error){if(!res.headersSent)respond(res,error.status||500,error.status===413?'İstek çok büyük.':'İstek işlenemedi.','text/plain; charset=utf-8');else res.destroy()}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const config=configFromEnv();const app=await createApp(config);app.listen(config.port,config.host,()=>console.log(`Kamp atölyesi hazır: ${config.origin}${config.base}/`));for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{app.close();setTimeout(()=>process.exit(0),5000).unref()})}catch(error){console.error(error.message);process.exitCode=1}
}
