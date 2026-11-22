import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import jsQR from 'jsqr';
import { base32, deBase32, codigoDe, conferir, novoSegredo, otpauth, emGrupos, passoDe } from '../../api/lib/totp.mjs';
import { cifrar, decifrar, chaveDe, chaveDoAmbiente } from '../../api/lib/cifra.mjs';
import { qrSvg } from '../../api/lib/qr.mjs';
import { senhaFraca } from '../../api/lib/senhas.mjs';
import { novosCodigos } from '../../api/login.mjs';

// TOTP, cifra do segredo, QR e senha fácil de adivinhar (contrato 4.2 e 4.4).
test('TOTP: vetores da RFC 6238 (SHA-1) com 6 dígitos e base32 de ida e volta',()=>{
  const segredo=base32(Buffer.from('12345678901234567890'));
  assert.equal(segredo,'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  for(const [t,codigo] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037']])
    assert.equal(codigoDe(segredo,Math.floor(t/30)),codigo,`T=${t}`);
  const bytes=randomBytes(20);assert.deepEqual(deBase32(base32(bytes)),bytes);
  assert.match(novoSegredo(),/^[A-Z2-7]{32}$/);
  assert.throws(()=>deBase32('1!'),/Base32/);
});

test('TOTP: aceita o passo anterior e o seguinte, nunca um passo já usado nem código malformado',()=>{
  const segredo=novoSegredo(),agora=new Date('2026-10-20T12:00:10Z'),p=passoDe(agora);
  assert.equal(conferir(segredo,codigoDe(segredo,p),agora),p);
  assert.equal(conferir(segredo,codigoDe(segredo,p-1),agora),p-1);
  assert.equal(conferir(segredo,codigoDe(segredo,p+1),agora),p+1);
  assert.equal(conferir(segredo,codigoDe(segredo,p-2),agora),null,'dois passos atrás');
  assert.equal(conferir(segredo,codigoDe(segredo,p),agora,p),null,'mesmo passo de novo');
  assert.equal(conferir(segredo,codigoDe(segredo,p+1),agora,p),p+1,'o seguinte ainda vale');
  for(const ruim of ['','12345','1234567','abcdef',null])assert.equal(conferir(segredo,ruim,agora),null);
  assert.equal(emGrupos('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');
  assert.equal(otpauth('ABC','lucas@exemplo.test'),'otpauth://totp/Gest%C3%A3o%20Nexus:lucas%40exemplo.test?secret=ABC&issuer=Gest%C3%A3o%20Nexus&algorithm=SHA1&digits=6&period=30');
});

test('cifra do segredo: AES-256-GCM presa ao id da conta e à chave',()=>{
  const chave=randomBytes(32),c=cifrar(chave,'SEGREDO','conta-1');
  assert.match(c,/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);assert.doesNotMatch(c,/SEGREDO/);
  assert.equal(decifrar(chave,c,'conta-1'),'SEGREDO');
  assert.throws(()=>decifrar(chave,c,'conta-2'),'copiado para outra conta não abre');
  assert.throws(()=>decifrar(randomBytes(32),c,'conta-1'),'outra chave não abre');
  assert.throws(()=>decifrar(chave,'lixo','conta-1'),/inválido/);
  assert.throws(()=>chaveDe('abc'),/TOTP_KEY/);
  assert.throws(()=>chaveDoAmbiente({NODE_ENV:'production'}),/Produção exige TOTP_KEY/);
  const avisos=[];assert.equal(chaveDoAmbiente({},m=>avisos.push(m)).length,32);assert.equal(avisos.length,1);
  assert.deepEqual(chaveDoAmbiente({TOTP_KEY:'ab'.repeat(32)}),Buffer.alloc(32,0xab));
});

test('QR do 2FA: SVG só com svg, rect e path, e um leitor de QR devolve o otpauth://',()=>{
  const texto=otpauth('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP','lucas@exemplo.test'),svg=qrSvg(texto);
  assert.deepEqual([...new Set([...svg.matchAll(/<\/?([a-z]+)/g)].map(m=>m[1]))].sort(),['path','rect','svg']);
  assert.doesNotMatch(svg,/lucas|JBSW|script|on\w+=/i);
  // Refaz a imagem a partir do path (4 px por módulo) e lê com o jsQR.
  const lado=Number(/viewBox="0 0 (\d+) \1"/.exec(svg)[1]),px=4,w=lado*px,img=new Uint8ClampedArray(w*w*4).fill(255);
  for(const [,x,y,n] of /d="([^"]*)"/.exec(svg)[1].matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g))
    for(let i=0;i<+n;i++)for(let dy=0;dy<px;dy++)for(let dx=0;dx<px;dx++){const o=(((+y)*px+dy)*w+((+x+i)*px+dx))*4;img[o]=img[o+1]=img[o+2]=0;}
  assert.equal(jsQR(img,w,w)?.data,texto);
});

test('senha fácil de adivinhar: lista, repetição, sequência, e-mail e as palavras da casa',()=>{
  for(const fraca of ['password1234','Senha1234567','FLAMENGO123456','aaaaaaaaaaaa','abababababab','123123123123','123456789012','987654321098',
    'abcdefghijkl','qwertyuiopas','Flávia.Souza2026','nexus-2026-ok!','Gestão-Comercial-1'])
    assert.equal(senhaFraca(fraca,'flavia.souza@exemplo.test'),true,fraca);
  for(const boa of ['Cavalo-Bateria-Grampo-77','tres pratos de trigo','marmelada-azul-de-1987'])assert.equal(senhaFraca(boa,'ana@exemplo.test'),false,boa);
  assert.equal(senhaFraca('ana-maria-de-1987x','ana@exemplo.test'),false,'parte do e-mail com menos de 4 letras não conta');
});

test('códigos de recuperação: 10, únicos, no formato xxxxx-xxxxx em base32',()=>{
  const c=novosCodigos();assert.equal(c.length,10);assert.equal(new Set(c).size,10);
  for(const x of c)assert.match(x,/^[a-z2-7]{5}-[a-z2-7]{5}$/);
});
