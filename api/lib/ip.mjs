import { isIP } from 'node:net';

// IP real de quem acessa. Na VPS o app só é acessível pelo Traefik, que conecta pela rede interna do Docker e acrescenta o
// IP do cliente ao fim do X-Forwarded-For. Por isso o cabeçalho só vale quando a conexão vem de loopback ou rede privada,
// e só o último endereço conta: os anteriores podem ter sido escritos pelo próprio cliente. (Cópia de api/lib/ip.mjs do site.)
const trustedProxy=ip=>/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:)/i.test(ip);
const plain=ip=>String(ip||'').trim().replace(/^::ffff:/i,'');
export function clientIP(req) {
  const peer=plain(req.socket?.remoteAddress);
  if(!trustedProxy(peer))return peer;
  const forwarded=plain(String(req.headers['x-forwarded-for']||'').split(',').at(-1));
  return isIP(forwarded)?forwarded:peer;
}
