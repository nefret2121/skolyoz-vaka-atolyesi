import { randomBytes } from 'node:crypto';
import { writeFile, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../server/auth.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function hidden(prompt){
 if(!process.stdin.isTTY)throw new Error('Şifreyi terminalde etkileşimli belirleyin.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();
 return new Promise((resolveAnswer,reject)=>{let value='';const handler=chunk=>{for(const ch of chunk){if(ch==='\r'||ch==='\n'){cleanup();process.stdout.write('\n');resolveAnswer(value);return}if(ch==='\u0003'){cleanup();reject(new Error('İptal edildi.'));return}if(ch==='\u007f'||ch==='\b'){value=[...value].slice(0,-1).join('');continue}if(ch>=' '&&value.length<256)value+=ch}};const cleanup=()=>{process.stdin.off('data',handler);process.stdin.setRawMode(false);process.stdin.pause()};process.stdin.on('data',handler)});
}
try{
 const local=process.argv.includes('--local');let origin='http://localhost:3000';
 if(!local){const rl=createInterface({input:process.stdin,output:process.stdout});origin=(await rl.question('Canlı site origin adresi (ör. https://siteadresiniz.com): ')).trim();rl.close();const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new Error('Adres HTTPS olmalı ve yol içermemeli.')}
 const first=await hidden('Yeni ortak kamp şifresi (ekranda görünmez): ');const second=await hidden('Şifreyi tekrar girin: ');
 if(first!==second)throw new Error('Şifreler eşleşmiyor.');if(first.length<12)throw new Error('En az 12 karakter kullanın.');
 const hash=await hashPassword(first);const secret=randomBytes(32).toString('hex');
 const contents=`NODE_ENV=${local?'development':'production'}\nPUBLIC_ORIGIN=${origin}\nBASE_PATH=/vaka-atolyesi\nHOST=127.0.0.1\nPORT=3000\nCAMP_ENABLED=true\nTRUST_PROXY=${local?'false':'true'}\nCAMP_PASSWORD_HASH=${hash}\nSESSION_SECRET=${secret}\n`;
 await writeFile(resolve(root,'.env'),contents,{mode:0o600,flag:process.argv.includes('--replace')?'w':'wx'});
 await chmod(resolve(root,'.env'),0o600);
 console.log('.env hazır. Şifrenin düz metni kaydedilmedi. npm start ile başlatın.');
}catch(e){console.error(e.code==='EEXIST'?'.env zaten var. Bilinçli yenileme için --replace ekleyin; mevcut oturumlar kapanır.':e.message);process.exitCode=1}
