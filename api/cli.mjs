import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { root, openDB, migrate } from './db.mjs';
import { backup, restore } from './backup.mjs';
import { validEmail } from './auth.mjs';
import { audit } from './lib/auditoria.mjs';
import { SEM_SENHA, emitirLink, linkDe, zerar2fa } from './login.mjs';
import { siteDoAmbiente } from './integracao.mjs';
import { conferirPlanos } from './data/sincronizacao.mjs';
import { limpar } from './limpeza.mjs';
import { lerMetricas } from './data/metricas-site.mjs';
import { leadsDoAmbiente, lerPedidos } from './data/leads.mjs';
import { seedDemo } from './seed.mjs';

// Linha de comando (contrato, seção 10).
const command=process.argv[2],args=process.argv.slice(3);
const origin=process.env.PUBLIC_ORIGIN||'http://127.0.0.1:4184';
const db=await openDB();
const conta=async email=>(await db.query('SELECT id,email,desativado FROM users WHERE email=$1',[String(email||'').trim().toLowerCase()])).rows[0];
// O link vai pelo WhatsApp; a senha nunca passa pela linha de comando.
const mostrarLink=async(u,acao)=>{
  const {value,expires,kind}=await emitirLink(db,{userId:u.id});
  await audit(db,{action:acao,type:'usuario',resource:u.id,after:{email:u.email,tipo:kind},ip:'cli'});
  console.log(`${kind==='convite'?'Convite':'Link de senha'} de ${u.email} (vale até ${expires.toISOString()}):\n${linkDe(origin,value)}`);
};
const mostrarMetricas=m=>console.log(m.erro?`Métricas do site (${m.de} a ${m.ate}): não lidas. ${m.erro} A cópia anterior continua.`:`Métricas do site (${m.de} a ${m.ate}): ${m.empresas} empresas lidas.`);
const mostrarPedidos=r=>console.log(r.erro?`Pedidos do cadastro: não lidos. ${r.erro} A próxima leitura começa do mesmo ponto.`:`Pedidos do cadastro: ${r.novos} ${r.novos===1?'novo':'novos'}.`);
try {
  await migrate(db);
  if(command==='migrate') console.log('Migrações aplicadas.');
  else if(command==='seed') {
    const r=await seedDemo(db);
    console.log(`Seed demonstrativo Nexus aplicado: ${r.usuarios} contas demo, ${r.clientes} clientes e ${r.planos} planos.`);
  } else if(command==='backup') {
    const archive=await backup(db,process.env.BACKUP_PASSPHRASE);
    // --stdout: o arquivo sai na saída padrão (o backup diário da VPS grava fora do contêiner).
    if(args[0]==='--stdout'){process.stdout.write(JSON.stringify(archive));}
    else {
      await mkdir(resolve(root,'backups'),{recursive:true});
      const file=resolve(root,'backups',`gestao-${Date.now()}.json`);
      await writeFile(file,JSON.stringify(archive),{mode:0o600,flag:'wx'});
      console.log(`Backup criptografado: ${file}`);
    }
  } else if(command==='restore') {
    if(!args[0]||!process.env.BACKUP_PASSPHRASE) throw new Error('Informe arquivo e BACKUP_PASSPHRASE. DB_DIR ou DATABASE_URL deve apontar para banco novo.');
    console.log(await restore(db,JSON.parse(await readFile(args[0],'utf8')),process.env.BACKUP_PASSPHRASE));
  } else if(command==='admin') {
    // Admin da gestão: node api/cli.mjs admin EMAIL [NOME]. Cria a conta, ou promove e reativa a que existe.
    const email=String(args[0]||'').trim().toLowerCase();
    if(!validEmail(email))throw new Error('Informe um e-mail válido.');
    const nome=args.slice(1).join(' ').trim().slice(0,120)||email.split('@')[0];
    let u=await conta(email);
    if(u)await db.query("UPDATE users SET papel='admin',desativado=false,version=version+1 WHERE id=$1",[u.id]);
    else {u={id:randomUUID(),email};await db.query("INSERT INTO users(id,email,nome,papel,password_hash) VALUES($1,$2,$3,'admin',$4)",[u.id,email,nome,SEM_SENHA]);}
    console.log(`${email} é admin da gestão.`);
    await mostrarLink(u,'admin_cli');
  } else if(command==='link-senha') {
    // Link novo: node api/cli.mjs link-senha EMAIL (convite sem senha, link de 1 hora com senha).
    const u=await conta(args[0]);
    if(!u||u.desativado)throw new Error('Conta não encontrada ou desativada.');
    await mostrarLink(u,'link_senha_cli');
  } else if(command==='reset-2fa') {
    // Redefinir o 2FA: node api/cli.mjs reset-2fa EMAIL, com o e-mail digitado de novo para confirmar.
    const u=await conta(args[0]);
    if(!u)throw new Error('Conta não encontrada.');
    const rl=createInterface({input:process.stdin,output:process.stdout});
    const confirmacao=(await rl.question(`Para redefinir o 2FA de ${u.email}, digite o e-mail de novo: `)).trim().toLowerCase();rl.close();
    if(confirmacao!==u.email)throw new Error('O e-mail não confere. Nada mudou.');
    await db.transaction(async tx=>{
      await zerar2fa(tx,u.id);
      await audit(tx,{action:'2fa_redefinido_cli',type:'usuario',resource:u.id,after:{email:u.email},ip:'cli'});
    });
    console.log(`2FA de ${u.email} redefinido. No próximo login, a pessoa configura o autenticador de novo.`);
  } else if(command==='sincronizar-planos') {
    // Rotina diária (9.3): sem --aplicar só mostra; o timer de scripts/integracao/ roda com --aplicar às 05:00 de São Paulo.
    const site=siteDoAmbiente();
    if(!site)throw new Error('Integração não configurada: SITE_API_URL, INTEGRACAO_CHAVE_ID e INTEGRACAO_CHAVE.');
    const r=await conferirPlanos(db,{site,aplicar:args.includes('--aplicar')});
    console.log(`Empresas vinculadas: ${r.empresas}. Divergências: ${r.divergencias.length}. O site não conhece: ${r.naoEncontradas.length}. Caches a atualizar: ${r.caches}.`);
    for(const d of r.divergencias)console.log(`  ${d.empresa}: no site ${d.noSite??'sem plano'}, esperado ${d.esperado??'sem plano'}`);
    for(const e of r.naoEncontradas)console.log(`  ${e}: não existe no site`);
    console.log(r.aplicado?`Aplicado. Fila: ${r.envio.enviados} enviados, ${r.envio.falhas} falhas.`:'Nada mudou. Para corrigir, rode de novo com --aplicar.');
    // Na rotina diária, as métricas do site também são lidas (9.5) e, com a chave dos leads ligada, os pedidos do cadastro (14.3).
    if(r.aplicado){mostrarMetricas(await lerMetricas(db,{site}));if(leadsDoAmbiente())mostrarPedidos(await lerPedidos(db,{site}));}
  } else if(command==='metricas') {
    // Métricas do site (9.5): lê na hora e guarda a cópia dos 12 meses dos Indicadores.
    const site=siteDoAmbiente();
    if(!site)throw new Error('Integração não configurada: SITE_API_URL, INTEGRACAO_CHAVE_ID e INTEGRACAO_CHAVE.');
    mostrarMetricas(await lerMetricas(db,{site}));
  } else if(command==='leads') {
    // Interessados (14.3 e 14.8): lê na hora os pedidos novos do cadastro do site. Com a chave desligada, só avisa.
    if(!leadsDoAmbiente())console.log('Os interessados estão desligados (LEADS_LIGADOS).');
    else {
      const site=siteDoAmbiente();
      if(!site)throw new Error('Integração não configurada: SITE_API_URL, INTEGRACAO_CHAVE_ID e INTEGRACAO_CHAVE.');
      mostrarPedidos(await lerPedidos(db,{site}));
    }
  } else if(command==='limpar') {
    // Rotina diária (10): roda antes do sincronizar-planos, pelo mesmo timer.
    const r=await limpar(db);
    console.log(`Prévias expiradas: ${r.importacoes}. Apagados: ${r.links} links, ${r.logins} logins pela metade, ${r.sessoes} sessões e ${r.limites} limites.`);
  } else throw new Error('Comandos: migrate, backup [--stdout], restore ARQUIVO, admin EMAIL [NOME], link-senha EMAIL, reset-2fa EMAIL, sincronizar-planos [--aplicar], metricas, leads, limpar');
} finally { await db.close(); }
