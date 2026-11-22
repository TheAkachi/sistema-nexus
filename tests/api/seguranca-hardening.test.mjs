import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ambiente } from './ambiente.mjs';
import { demoAtivo } from '../../api/auth.mjs';
import { seedDemo } from '../../api/seed.mjs';
import { chaveDoAmbiente } from '../../api/lib/cifra.mjs';
import { backup, restore } from '../../api/backup.mjs';
import { proximo } from '../../api/data/paginas.mjs';
import { clientIP } from '../../api/lib/ip.mjs';
import { openDB, migrate } from '../../api/db.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('demoAtivo é opt-in (fail-closed mesmo com NODE_ENV ausente)',()=>{
  assert.equal(demoAtivo({}),false);
  assert.equal(demoAtivo({NODE_ENV:'development'}),false);
  assert.equal(demoAtivo({NODE_ENV:'staging'}),false);
  assert.equal(demoAtivo({DEMO_MODE:'0'}),false);
  assert.equal(demoAtivo({DEMO_MODE:'1'}),true);
});

test('chaveDoAmbiente falha fechado com DATABASE_URL ou PUBLIC_ORIGIN externo sem TOTP_KEY',()=>{
  assert.throws(()=>chaveDoAmbiente({NODE_ENV:'production'},()=>{}),/TOTP_KEY/);
  assert.throws(()=>chaveDoAmbiente({DATABASE_URL:'postgresql://u:p@db:5432/g'},()=>{}),/TOTP_KEY/);
  assert.throws(()=>chaveDoAmbiente({PUBLIC_ORIGIN:'http://gestao.nexus.demo'},()=>{}),/TOTP_KEY/);
  assert.ok(chaveDoAmbiente({PUBLIC_ORIGIN:'http://127.0.0.1:4184'},()=>{}).length===32);
});

test('login demo respeita bloqueio por conta (5 falhas -> 429) e registra auditoria',async()=>{
  const prev=process.env.DEMO_MODE;
  process.env.DEMO_MODE='1';
  const t=await ambiente();
  try {
    await seedDemo(t.db,{now:t.agora,chave:t.chave});
    for(let i=0;i<5;i++){
      const r=await t.req('/api/auth/login',{method:'POST',body:{email:'admin@nexus.demo',senha:'SenhaErrada12345!'}});
      assert.equal(r.status,401);
    }
    const bloq=await t.req('/api/auth/login',{method:'POST',body:{email:'admin@nexus.demo',senha:'NexusDemo2026!'}});
    assert.equal(bloq.status,429);
    const logs=(await t.db.query("SELECT action FROM audit_log WHERE action IN ('login_falha','login_bloqueado')")).rows.map(x=>x.action);
    assert.ok(logs.includes('login_falha'));
    assert.ok(logs.includes('login_bloqueado'));
  } finally {
    if(prev===undefined)delete process.env.DEMO_MODE;else process.env.DEMO_MODE=prev;
    await t.fim();
  }
});

test('convidar recusa @nexus.demo e equipe exige reautenticação ao convidar ou desativar',async()=>{
  const t=await ambiente();
  try {
    const adm=await t.sessao('admin@exemplo.test');
    const alvo=await t.sessao('alvo@exemplo.test',{papel:'comercial'});
    const rDemo=await t.req('/api/equipe',{method:'POST',body:{email:'invasor@nexus.demo',nome:'Teste',papel:'admin'},s:adm});
    assert.equal(rDemo.status,422);
    assert.equal(rDemo.json.campo,'email');

    // Expira a janela de 5 min de reautenticação (mantendo a sessão ativa).
    t.minutos(6);

    const rConv=await t.req('/api/equipe',{method:'POST',body:{email:'novo@exemplo.test',nome:'Novo',papel:'admin'},s:adm});
    assert.equal(rConv.status,403);
    assert.equal(rConv.json.reautenticar,true);

    const rDes=await t.req(`/api/equipe/${alvo.userId}`,{method:'PATCH',body:{desativado:true,version:1},s:adm});
    assert.equal(rDes.status,403);
    assert.equal(rDes.json.reautenticar,true);
  } finally {await t.fim();}
});

test('prototype pollution / lookup seguro em renovacoes (?janela=toString) e importação CSV (constructor)',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('proto@exemplo.test');
    const r=await t.req('/api/renovacoes?janela=toString',{s});
    assert.equal(r.status,200);
    assert.equal(r.json.janela,'vencidas');

    const csv='Empresa;Valor;Ciclo;Inicio;Vencimento;Status\nCafé Teste;100,00;constructor;01/10/2026;01/11/2026;constructor\n';
    const imp=await t.req('/api/importacoes?tipo=planilha',{method:'POST',body:csv,headers:{'Content-Type':'text/csv'},s});
    assert.equal(imp.status,201);
    const prev=await t.req(`/api/importacoes/${imp.json.id}`,{s});
    assert.equal(prev.json.linhas[0].ciclo,'mensal');
    assert.equal(prev.json.linhas[0].status,'ativa');
  } finally {await t.fim();}
});

test('restore recusa tag GCM truncada (4 bytes)',async()=>{
  const dir1=mkdtempSync(join(tmpdir(),'nx-bkp-1-')),dir2=mkdtempSync(join(tmpdir(),'nx-bkp-2-'));
  const db1=await openDB({dir:dir1}),db2=await openDB({dir:dir2});
  try {
    await migrate(db1);await migrate(db2);
    const pass='frase-segura-para-teste-backup-01';
    const arq=await backup(db1,pass);
    const adulterado={...arq,tag:arq.tag.slice(0,8)};
    adulterado.sha256=createHash('sha256').update(Buffer.from(adulterado.data,'base64')).digest('hex');
    await assert.rejects(()=>restore(db2,adulterado,pass),/Parâmetros criptográficos inválidos/);
  } finally {
    await db1.close();await db2.close();
    rmSync(dir1,{recursive:true,force:true});rmSync(dir2,{recursive:true,force:true});
  }
});

test('proximo rejeita caracteres de controle e clientIP respeita TRUSTED_PROXY_IPS',()=>{
  assert.equal(proximo('/clientes\x00'),'');
  assert.equal(proximo('/clientes\x1f'),'');
  assert.equal(proximo('/clientes?q=ok'),'/clientes?q=ok');

  const prev=process.env.TRUSTED_PROXY_IPS;
  try {
    process.env.TRUSTED_PROXY_IPS='10.0.0.2';
    assert.equal(clientIP({socket:{remoteAddress:'10.0.0.99'},headers:{'x-forwarded-for':'203.0.113.5'}}),'10.0.0.99');
    assert.equal(clientIP({socket:{remoteAddress:'10.0.0.2'},headers:{'x-forwarded-for':'203.0.113.5'}}),'203.0.113.5');
  } finally {
    if(prev===undefined)delete process.env.TRUSTED_PROXY_IPS;else process.env.TRUSTED_PROXY_IPS=prev;
  }
});
