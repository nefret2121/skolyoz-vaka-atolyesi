import { randomBytes, scrypt, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16); const key = await derive(password, salt, 32, options);
  return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`;
}
export function parseHash(value) {
  if (!/^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{64}$/.test(value ?? '')) throw new Error('CAMP_PASSWORD_HASH geçerli değil. npm run setup kullanın.');
  const [, salt, hash] = value.split(':'); return {salt:Buffer.from(salt,'hex'),hash:Buffer.from(hash,'hex')};
}
export async function verifyPassword(password, stored) {
  const {salt,hash}=parseHash(stored); const candidate=await derive(password,salt,32,options);
  return timingSafeEqual(candidate,hash);
}
export function createSessions(secret, passwordHash, basePath, ttlSeconds=28800) {
  const version=createHash('sha256').update(passwordHash).digest('hex');
  const sign=text=>createHmac('sha256',secret).update(basePath+'\0'+version+'\0'+text).digest('base64url');
  return {
    issue(now=Date.now()) {const payload=Buffer.from(JSON.stringify({v:1,iat:Math.floor(now/1000),exp:Math.floor(now/1000)+ttlSeconds,n:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+sign(payload)},
    valid(token,now=Date.now()) {
      if(typeof token!=='string'||token.length>512)return false;
      const parts=token.split('.'); if(parts.length!==2)return false;
      const expected=Buffer.from(sign(parts[0]));const actual=Buffer.from(parts[1]);
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
      try {const p=JSON.parse(Buffer.from(parts[0],'base64url'));const t=Math.floor(now/1000);return p.v===1&&Number.isInteger(p.iat)&&Number.isInteger(p.exp)&&p.iat<=t+30&&p.exp>t&&p.exp-p.iat===ttlSeconds&&/^[a-f0-9]{32}$/.test(p.n)}catch{return false}
    }
  };
}
