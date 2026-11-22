import { randomUUID, createHash } from 'node:crypto';
import { fail } from '../lib/erros.mjs';
import { audit } from '../lib/auditoria.mjs';
import { lerCsv, nomeColuna, nomeEmpresa } from '../lib/csv.mjs';
import { diaValido, somarMeses, MESES } from '../lib/datas.mjs';
import { validEmail, limit } from '../auth.mjs';
import { foraDoAr, empresaDoSite, idEmpresaValido } from '../integracao.mjs';
import { rejectExtra, needVersion, conflito, iso, lista } from './comum.mjs';
import { planosSite } from './planos.mjs';
import { whatsappDe } from './clientes.mjs';
import { contexto } from './assinaturas.mjs';
import { enfileirar, planoEsperado } from './fila.mjs';

// Importação (contrato 6.11, 6.12 e 8): o CSV vira uma prévia, que a equipe confere, resolve e confirma. O arquivo nunca é
// guardado; a prévia vence em 24 horas. O formato do eDirectory veio da documentação pública dele e é provisório (P7).
export const TIPOS=['edirectory','planilha'];
const CONTENT_TYPES=['text/csv','text/plain','application/vnd.ms-excel','application/octet-stream'];
export const MAX_BYTES=2*1024*1024,MAX_LINHAS=2000,VALIDADE_MS=24*3600000;

// Colunas (8.2): para cada dado, os nomes aceitos, do preferido para o último recurso.
const COLUNAS={
  edirectory:{id:['listing db id','id do anuncio','listing id'],empresa:['listing title','titulo','title'],clienteNome:['account contact company'],
    primeiroNome:['account contact first name'],sobrenome:['account contact last name'],email:['account username','account contact email','listing email','email'],
    whatsapp:['account contact phone','listing phone','whatsapp','telefone','celular'],plano:['listing product','listing level','nivel','plano'],
    valor:['valor','preco','price'],ciclo:['ciclo','periodo','renewal period'],inicio:['inicio','data de criacao','created'],
    vencimento:['listing renewal date','renovacao','data de renovacao','vencimento'],status:['listing status','status','situacao']},
  planilha:{empresa:['empresa','nome fantasia','razao social','nome','assinante'],clienteNome:['cliente'],responsavel:['responsavel','contato'],email:['email'],
    whatsapp:['whatsapp','celular','telefone'],plano:['plano','produto','pacote'],valor:['valor','mensalidade','valor mensal','preco'],
    ciclo:['periodicidade','ciclo','recorrencia','frequencia'],inicio:['inicio','data de inicio','adesao','contratacao'],
    vencimento:['vencimento','proximo vencimento','data de vencimento'],status:['situacao','status']}
};
const OBRIGATORIAS={edirectory:{empresa:'Listing Title',vencimento:'Listing Renewal Date'},planilha:{empresa:'empresa',valor:'valor',inicio:'início'}};
function mapear(cabecalho,tipo) {
  const nomes=cabecalho.map(nomeColuna);
  const idx=Object.fromEntries(Object.entries(COLUNAS[tipo]).map(([campo,aliases])=>[campo,aliases.map(nomeColuna).map(a=>nomes.indexOf(a)).find(i=>i>=0)??-1]));
  const faltam=Object.entries(OBRIGATORIAS[tipo]).filter(([campo])=>idx[campo]<0).map(([,rotulo])=>rotulo);
  if(faltam.length)throw fail(`Faltam as colunas: ${faltam.join(', ')}.`,422,'arquivo');
  return idx;
}

// Datas (8.2): dd/mm/aaaa, mm/dd/aaaa ou aaaa-mm-dd, com ou sem hora. A ordem de dia e mês vale para o arquivo inteiro.
function dataBruta(v) {
  const s=String(v??'').trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s);
  if(m)return {iso:true,ano:+m[1],a:+m[2],b:+m[3]};
  m=/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T].*)?$/.exec(s);
  return m?{iso:false,a:+m[1],b:+m[2],ano:+m[3]}:null;
}
export function ordemDatas(valores) {
  const brutas=valores.map(dataBruta).filter(d=>d&&!d.iso);
  if(brutas.some(d=>d.a>12))return 'dia/mês';
  if(brutas.some(d=>d.b>12))return 'mês/dia';
  return 'dia/mês';
}
export function paraDia(v,ordem) {
  const d=dataBruta(v);if(!d)return null;
  const [mes,dia]=d.iso||ordem==='mês/dia'?[d.a,d.b]:[d.b,d.a];
  const s=`${d.ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return diaValido(s)?s:null;
}
// Valores (8.2): 99,00 · R$ 1.250,00 · 1250.00 · 99. Vazio é undefined; inválido é null.
export function centavos(v) {
  let s=String(v??'').replace(/R\$|\s/g,'');if(!s)return undefined;
  if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
  else if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
  const n=Math.round(Number(s)*100);
  return Number.isSafeInteger(n)&&n<=100000000?n:null;
}
const CICLOS={mensal:'mensal',monthly:'mensal',mes:'mensal',trimestral:'trimestral',quarterly:'trimestral',semestral:'semestral',semiannual:'semestral',
  semiannually:'semestral',anual:'anual',yearly:'anual',annual:'anual',annually:'anual'};
const SITUACOES={active:'ativa',ativo:'ativa',ativa:'ativa',pending:'ativa',pendente:'ativa',expired:'ativa',expirado:'ativa',expirada:'ativa',
  suspended:'suspensa',suspenso:'suspensa',suspensa:'suspensa',deleted:'cancelada',excluido:'cancelada',excluida:'cancelada',cancelado:'cancelada',cancelada:'cancelada',
  cancelled:'cancelada',canceled:'cancelada',inativo:'cancelada',inativa:'cancelada',inactive:'cancelada',encerrado:'cancelada',encerrada:'cancelada'};
const sha1=s=>createHash('sha1').update(s).digest('hex');
const umaLinha=s=>String(s??'').replace(/\s+/g,' ').trim();

// Lê uma linha do arquivo: só os dados dela, sem olhar o banco nem as empresas do guia (8.2 e 8.3). O que não está na tabela
// de 8.2 (endereço, descrição, a senha da conta) nem é lido.
function lerLinha(tipo,idx,celulas,n,{planos,ordem}) {
  const v=k=>idx[k]>=0?umaLinha(celulas[idx[k]]):'',avisos=[];
  const empresaNome=v('empresa').slice(0,200);
  const emailBruto=v('email').toLowerCase(),email=emailBruto&&validEmail(emailBruto)?emailBruto:'';
  if(emailBruto&&!email)avisos.push('E-mail inválido no arquivo: ficou em branco.');
  let whatsapp='';try{whatsapp=whatsappDe(v('whatsapp'))||'';}catch{avisos.push('WhatsApp inválido no arquivo: ficou em branco.');}
  const responsavel=(tipo==='edirectory'?umaLinha(`${v('primeiroNome')} ${v('sobrenome')}`):v('responsavel')).slice(0,120);
  const clienteNome=(v('clienteNome')||(tipo==='edirectory'?responsavel:'')||empresaNome).slice(0,160);
  const base={linha:n,empresaNome,cliente:{nome:clienteNome,email,whatsapp,responsavel},clienteChave:email?`email:${email}`:`nome:${nomeEmpresa(clienteNome)}`};
  const comErro=erro=>({...base,erroLeitura:erro,avisosLeitura:[],plano:null,valorCentavos:null,ciclo:null,inicio:null,venceEm:null,status:null,chave:null});
  if(!empresaNome)return comErro(tipo==='edirectory'?'Falta o título do anúncio.':'Falta o nome da empresa.');
  const planoBruto=v('plano'),plano=planoBruto?planos.find(p=>p.id===planoBruto||nomeEmpresa(p.nome)===nomeEmpresa(planoBruto))||null:null;
  if(!planoBruto)avisos.push('Sem plano no arquivo.');else if(!plano)avisos.push(`Plano ${planoBruto} não existe no guia.`);
  const cicloBruto=v('ciclo'),cicloChave=nomeColuna(cicloBruto),ciclo=Object.hasOwn(CICLOS,cicloChave)?CICLOS[cicloChave]:'mensal';
  if(cicloBruto&&!Object.hasOwn(CICLOS,cicloChave))avisos.push(`Ciclo ${cicloBruto} desconhecido: ficou mensal.`);
  const situacaoBruta=v('status'),situacaoChave=nomeColuna(situacaoBruta),status=situacaoBruta?(Object.hasOwn(SITUACOES,situacaoChave)?SITUACOES[situacaoChave]:'ativa'):'ativa';
  if(situacaoBruta&&!Object.hasOwn(SITUACOES,situacaoChave))avisos.push(`Situação ${situacaoBruta} desconhecida: ficou ativa.`);
  const inicioBruto=v('inicio'),vencimentoBruto=v('vencimento');
  let inicio=inicioBruto?paraDia(inicioBruto,ordem):null,venceEm=vencimentoBruto?paraDia(vencimentoBruto,ordem):null,valor=centavos(v('valor'));
  if(tipo==='edirectory') {
    if(!venceEm)return comErro(vencimentoBruto?'Data de renovação inválida.':'Falta a data de renovação.');
    if(inicioBruto&&!inicio)avisos.push('Data de início inválida no arquivo.');
    if(valor===null)avisos.push('Valor inválido no arquivo.');
  } else {
    if(valor===undefined)return comErro('Falta o valor.');
    if(valor===null)return comErro('Valor inválido.');
    if(!inicio)return comErro(inicioBruto?'Data de início inválida.':'Falta a data de início.');
    if(vencimentoBruto&&!venceEm)return comErro('Data de vencimento inválida.');
    if(!venceEm){venceEm=somarMeses(inicio,MESES[ciclo]);avisos.push('Sem vencimento no arquivo: o início mais um ciclo.');}
  }
  if(valor==null) {
    valor=plano?.precoCentavos??0;
    avisos.push(plano?.precoCentavos!=null?'Sem valor no arquivo: usado o preço do plano.':'Sem valor no arquivo nem preço do plano: entra como R$ 0,00.');
  }
  // Sem início: o vencimento recuado um ciclo (P7). O início nunca passa do vencimento.
  if(!inicio)inicio=somarMeses(venceEm,-MESES[ciclo]);
  if(inicio>venceEm)inicio=venceEm;
  const id=tipo==='edirectory'?v('id'):'';
  const chave=tipo==='edirectory'?`edirectory:${id||sha1(`${nomeEmpresa(empresaNome)}|${email}`)}`:`planilha:${sha1(`${nomeEmpresa(empresaNome)}|${nomeEmpresa(planoBruto)}|${inicio}`)}`;
  return {...base,erroLeitura:'',avisosLeitura:avisos,plano:plano?{id:plano.id,nome:plano.nome}:null,valorCentavos:valor,ciclo,inicio,venceEm,status,chave};
}

// Empresas do guia (todas, página a página) e o casamento pelo nome (8.3).
async function empresasDoGuia(site) {
  if(!site)throw foraDoAr();
  const todas=[];
  for(let p=1;p<=500;p++) {
    const r=await site.empresas({page:p});
    todas.push(...(Array.isArray(r?.itens)?r.itens:[]).map(empresaDoSite).filter(Boolean));
    if(!r||p>=(Number(r.paginas)||1))break;
  }
  return todas;
}
const palavras=s=>new Set(nomeEmpresa(s).split(' ').filter(w=>w.length>=3||/\d/.test(w)));
function casar(nome,empresas) {
  const alvo=nomeEmpresa(nome),iguais=empresas.filter(e=>nomeEmpresa(e.nome)===alvo);
  if(iguais.length===1)return {casada:iguais[0],sugestoes:[]};
  const ps=palavras(nome);
  const sugestoes=empresas.map(e=>({e,n:[...palavras(e.nome)].filter(w=>ps.has(w)).length})).filter(x=>x.n>0)
    .sort((a,b)=>b.n-a.n||a.e.nome.localeCompare(b.e.nome,'pt-BR')).slice(0,3).map(x=>({id:x.e.id,nome:x.e.nome}));
  return {casada:null,sugestoes};
}

// O que já existe na gestão: clientes, vínculos, assinaturas importadas e as não canceladas de cada empresa. A confirmação
// acrescenta aqui o que cria, para as linhas seguintes.
async function carregarEstado(db) {
  const [clientes,vinculos,subs,ativas]=await Promise.all([
    db.query('SELECT id,nome,email,source_key,responsavel,whatsapp FROM clients'),
    db.query('SELECT b.business_id,b.client_id,b.nome_cache,c.nome FROM client_businesses b JOIN clients c ON c.id=b.client_id'),
    db.query(`SELECT id,client_id,business_id,plano_site,valor_centavos,ciclo,inicio::text AS inicio,vence_em::text AS vence_em,status,gerida_em,source_key
      FROM subscriptions WHERE source_key IS NOT NULL`),
    db.query("SELECT business_id,source_key FROM subscriptions WHERE status<>'cancelada' AND business_id IS NOT NULL")
  ]).then(r=>r.map(x=>x.rows));
  return {clientes,vinculos,
    cliente:l=>clientes.find(c=>c.source_key===l.clienteChave)||(l.cliente.email&&clientes.find(c=>c.email===l.cliente.email))||null,
    dono:id=>vinculos.find(v=>v.business_id===id)||null,
    assinatura:chave=>subs.find(s=>s.source_key===chave)||null,
    ocupada:(id,chave)=>ativas.some(a=>a.business_id===id&&a.source_key!==chave)};
}
const COMPARADOS=[['empresa',s=>s.business_id,l=>l.empresa?.id??null],['plano',s=>s.plano_site,l=>l.plano?.id??null],['valorCentavos',s=>s.valor_centavos,l=>l.valorCentavos],
  ['ciclo',s=>s.ciclo,l=>l.ciclo],['venceEm',s=>s.vence_em,l=>l.venceEm],['status',s=>s.status,l=>l.status]];
// A ação, a empresa e os avisos de todas as linhas, com o estado atual do banco (8.3 e 8.4). Roda no envio, a cada mudança
// da equipe e de novo na confirmação. A empresa escolhida pela equipe vem antes da achada pelo nome.
function avaliar(linhas,estado) {
  const chaves=new Map(),usadas=new Map();
  const manuais=new Map(linhas.filter(l=>l.empresaManual&&!l.ignorada).map(l=>[l.empresaManual.id,l.linha]));
  for(const l of linhas) {
    // A ação vem sempre do estado atual, inclusive ao desfazer "ignorar" na prévia.
    l.acao=null;l.avisos=[...l.avisosLeitura];l.mudancas=[];l.existente=null;l.empresa=null;l.erro=l.erroLeitura;
    if(!l.erro&&chaves.has(l.chave))l.erro=`Linha repetida no arquivo (igual à linha ${chaves.get(l.chave)}).`;
    if(l.erro){l.acao='erro';continue;}
    chaves.set(l.chave,l.linha);
    const sub=estado.assinatura(l.chave),cliente=sub?{id:sub.client_id}:estado.cliente(l);
    l.existente=sub?.id||null;
    if(l.ignorada)l.acao='ignorar';
    else if(sub?.gerida_em){l.acao='ignorar';l.avisos.push('Editada na gestão depois da importação.');}
    // Reimportação: sem nome igual no guia, a assinatura continua com a empresa que já tem.
    let e=l.empresaManual!==undefined?l.empresaManual:l.casada;
    if(!e&&l.empresaManual===undefined&&sub?.business_id)e={id:sub.business_id,nome:estado.dono(sub.business_id)?.nome_cache||sub.business_id};
    if(e&&l.acao!=='ignorar') {
      const dono=estado.dono(e.id),reservada=manuais.get(e.id);
      if(dono&&dono.client_id!==cliente?.id)l.avisos.push(`A empresa ${e.nome} já é do cliente ${dono.nome}.`);
      else if(usadas.has(e.id)||(reservada&&reservada!==l.linha))l.avisos.push(`A empresa ${e.nome} já está na linha ${usadas.get(e.id)||reservada}.`);
      else if(l.status!=='cancelada'&&estado.ocupada(e.id,l.chave))l.avisos.push(`A empresa ${e.nome} já tem uma assinatura na gestão.`);
      else {l.empresa=e;usadas.set(e.id,l.linha);}
    } else l.empresa=e;
    if(l.acao==='ignorar')continue;
    if(!sub){l.acao='novo';continue;}
    l.mudancas=COMPARADOS.filter(([,a,b])=>a(sub)!==b(l)).map(([k])=>k);
    l.acao=l.mudancas.length?'atualizar':'igual';
  }
  return linhas;
}
const resumoDe=linhas=>({novos:linhas.filter(l=>l.acao==='novo').length,atualizados:linhas.filter(l=>l.acao==='atualizar').length,
  iguais:linhas.filter(l=>l.acao==='igual').length,semEmpresa:linhas.filter(l=>['novo','atualizar'].includes(l.acao)&&!l.empresa).length,
  ignorados:linhas.filter(l=>l.acao==='ignorar').length,erros:linhas.filter(l=>l.acao==='erro').length});
const linhaVM=l=>({linha:l.linha,acao:l.acao,cliente:{nome:l.cliente.nome,email:l.cliente.email,whatsapp:l.cliente.whatsapp},
  empresa:l.empresa?{id:l.empresa.id,nome:l.empresa.nome}:null,sugestoes:l.empresa||l.acao==='erro'?[]:(l.sugestoes||[]),plano:l.plano,valorCentavos:l.valorCentavos,
  ciclo:l.ciclo,venceEm:l.venceEm,status:l.status,mudancas:l.mudancas,aviso:l.avisos.join(' '),erro:l.erro});

// A prévia vencida (24 horas) fica expirada, sem as linhas (8.5). Roda na leitura e no limpar da rotina diária.
export const expirarImportacoes=async(db,now=new Date())=>
  (await db.query("UPDATE imports SET status='expirada',previa=NULL,version=version+1 WHERE status='previa' AND expira_em<=$1 RETURNING id",[now.toISOString()])).rows.length;
const SELECT='SELECT i.*,u.nome AS criado_nome FROM imports i LEFT JOIN users u ON u.id=i.criado_por';
const criadaPor=r=>r.criado_por?{id:r.criado_por,nome:r.criado_nome||''}:null;
export async function listarImportacoes(db,url,now=new Date()) {
  await expirarImportacoes(db,now);
  const rows=(await db.query(`${SELECT} ORDER BY i.criado_em DESC,i.id DESC`)).rows;
  return lista(rows.map(r=>({id:r.id,tipo:r.tipo,status:r.status,criadaEm:iso(r.criado_em),criadaPor:criadaPor(r),linhas:r.linhas,resumo:r.resumo,
    confirmadaEm:iso(r.confirmado_em)})),url);
}
async function carregar(db,id,{lock=false}={}) {
  const r=(await db.query(`${SELECT} WHERE i.id=$1${lock?' FOR UPDATE OF i':''}`,[id])).rows[0];
  if(!r)throw fail('Importação não encontrada.',404);
  return r;
}
const importacaoVM=r=>({id:r.id,tipo:r.tipo,status:r.status,arquivo:{sha256:r.arquivo_sha256,linhas:r.linhas,...r.arquivo_info},criadaEm:iso(r.criado_em),
  criadaPor:criadaPor(r),expiraEm:iso(r.expira_em),confirmadaEm:iso(r.confirmado_em),resumo:r.resumo,linhas:(r.previa?.linhas||[]).map(linhaVM),version:r.version});
export async function obterImportacao(db,id,now=new Date()){await expirarImportacoes(db,now);return importacaoVM(await carregar(db,id));}
const aberta=r=>{if(r.status!=='previa')throw fail('Esta importação já foi fechada.',422);};

// Envio (8.1): confere o tipo e o limite antes de ler o corpo; lê o CSV, casa as linhas e grava só a prévia.
export async function enviarImportacao(db,{tipo,contentType,ler,session,ip,now=new Date(),site}) {
  if(!TIPOS.includes(tipo))throw fail('Escolha o tipo: edirectory ou planilha.',422,'tipo');
  if(!CONTENT_TYPES.includes(String(contentType||'').split(';')[0].trim().toLowerCase()))throw fail('Envie um arquivo CSV.',415,'arquivo');
  await limit(db,`importar:${session.user_id}`,10,3600000,now);
  const buf=await ler();
  const sha256=createHash('sha256').update(buf).digest('hex');
  await expirarImportacoes(db,now);
  const mesma=(await db.query("SELECT id FROM imports WHERE status='previa' AND tipo=$1 AND arquivo_sha256=$2",[tipo,sha256])).rows[0];
  if(mesma)return {criada:false,importacao:await obterImportacao(db,mesma.id,now)};
  const {cabecalho,dados,separador,codificacao}=lerCsv(buf);
  const idx=mapear(cabecalho,tipo);
  if(dados.length>MAX_LINHAS)throw fail('O arquivo tem mais de 2.000 linhas. Divida em partes.',422,'arquivo');
  const {itens:planos}=await planosSite(db,{site,now});
  const empresas=await empresasDoGuia(site);
  const ordem=ordemDatas(dados.flatMap(c=>[idx.vencimento,idx.inicio].filter(i=>i>=0).map(i=>c[i])));
  const linhas=dados.map((c,i)=>lerLinha(tipo,idx,c,i+2,{planos,ordem}));
  for(const l of linhas)if(!l.erroLeitura)Object.assign(l,casar(l.empresaNome,empresas));
  avaliar(linhas,await carregarEstado(db));
  const id=randomUUID();
  await db.transaction(async tx=>{
    await tx.query(`INSERT INTO imports(id,tipo,arquivo_sha256,arquivo_info,linhas,previa,resumo,criado_por,criado_em,expira_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id,tipo,sha256,JSON.stringify({separador,codificacao,datas:ordem}),linhas.length,JSON.stringify({linhas}),JSON.stringify(resumoDe(linhas)),session.user_id,
        now.toISOString(),new Date(now.getTime()+VALIDADE_MS).toISOString()]);
    await audit(tx,{actor:session.user_id,action:'importacao_enviada',type:'importacao',resource:id,after:{tipo,linhas:linhas.length,sha256},ip});
  });
  return {criada:true,importacao:await obterImportacao(db,id,now)};
}

// A equipe resolve uma linha (8.3): escolhe a empresa do guia (conferida no site) ou nenhuma, ou ignora a linha.
export async function mudarLinha(db,{id,numero,p,now=new Date(),site}) {
  await expirarImportacoes(db,now);aberta(await carregar(db,id));
  rejectExtra(p,['empresa','ignorar','version']);const version=needVersion(p);
  if(p.empresa===undefined&&p.ignorar===undefined)throw fail('Informe a empresa ou se a linha é ignorada.',422);
  if(p.ignorar!==undefined&&typeof p.ignorar!=='boolean')throw fail('Valor inválido.',422,'ignorar');
  let escolhida=null;
  if(p.empresa!==undefined&&p.empresa!==null) {
    if(!idEmpresaValido(p.empresa))throw fail('Empresa não encontrada no guia.',422,'empresa');
    if(!site)throw foraDoAr();
    escolhida=((await site.empresas({ids:[p.empresa]}))?.itens||[]).map(empresaDoSite).find(x=>x?.id===p.empresa);
    if(!escolhida)throw fail('Empresa não encontrada no guia.',422,'empresa');
  }
  return db.transaction(async tx=>{
    const r=await carregar(tx,id,{lock:true});aberta(r);if(r.version!==version)throw conflito();
    const linhas=r.previa.linhas,l=Number.isInteger(numero)?linhas.find(x=>x.linha===numero):null;
    if(!l)throw fail('Linha não encontrada.',404);
    if(l.acao==='erro')throw fail('Esta linha tem erro e não entra.',422);
    if(p.empresa!==undefined)l.empresaManual=escolhida;
    if(p.ignorar!==undefined)l.ignorada=p.ignorar;
    avaliar(linhas,await carregarEstado(tx));
    if(escolhida&&!l.ignorada&&l.acao!=='ignorar'&&l.empresa?.id!==escolhida.id)
      throw fail(l.avisos.find(a=>a.startsWith('A empresa'))||'Esta empresa não pode ficar nesta linha.',422,'empresa');
    await tx.query('UPDATE imports SET previa=$2,resumo=$3,version=version+1 WHERE id=$1',[id,JSON.stringify({linhas}),JSON.stringify(resumoDe(linhas))]);
    return importacaoVM(await carregar(tx,id));
  });
}

// Confirmação (8.5): grava tudo numa transação só, sem marcar as assinaturas como geridas, e apaga a prévia.
async function clienteDaLinha(tx,l,estado,now) {
  // Na atualização, o cliente é o da assinatura; na nova, o achado pela chave ou pelo e-mail, ou um cliente novo.
  const c=l.existente?estado.clientes.find(x=>x.id===estado.assinatura(l.chave).client_id):estado.cliente(l);
  if(c) {
    const f={responsavel:c.responsavel||l.cliente.responsavel,whatsapp:c.whatsapp||l.cliente.whatsapp,
      email:c.email||(estado.clientes.some(x=>x.email===l.cliente.email)?'':l.cliente.email)};
    if(f.responsavel!==c.responsavel||f.whatsapp!==c.whatsapp||f.email!==c.email) {
      await tx.query('UPDATE clients SET responsavel=$2,whatsapp=$3,email=$4,atualizado_em=$5,version=version+1 WHERE id=$1',[c.id,f.responsavel,f.whatsapp,f.email,now.toISOString()]);
      Object.assign(c,f);
    }
    return {id:c.id,novo:false};
  }
  const nome=[l.cliente.nome,l.empresaNome].find(x=>x.length>=2)||`Cliente ${l.empresaNome}`.slice(0,160);
  const novo={id:randomUUID(),nome,email:l.cliente.email,source_key:l.clienteChave,responsavel:l.cliente.responsavel,whatsapp:l.cliente.whatsapp};
  await tx.query('INSERT INTO clients(id,nome,responsavel,whatsapp,email,source_key,criado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$7)',
    [novo.id,novo.nome,novo.responsavel,novo.whatsapp,novo.email,novo.source_key,now.toISOString()]);
  estado.clientes.push(novo);
  return {id:novo.id,novo:true};
}
export async function confirmarImportacao(db,{id,p,session,ip,now=new Date()}) {
  await expirarImportacoes(db,now);aberta(await carregar(db,id));
  rejectExtra(p,['version']);const version=needVersion(p);
  const cx=await contexto(db,{now});
  return db.transaction(async tx=>{
    const r=await carregar(tx,id,{lock:true});aberta(r);if(r.version!==version)throw conflito();
    const estado=await carregarEstado(tx),linhas=avaliar(r.previa.linhas,estado),feito=resumoDe(linhas);
    feito.semEmpresa=0;let clientesNovos=0;
    for(const l of linhas.filter(x=>['novo','atualizar'].includes(x.acao))) {
      const cliente=await clienteDaLinha(tx,l,estado,now);if(cliente.novo)clientesNovos++;
      let empresa=l.empresa?.id||null;
      if(empresa&&l.status!=='cancelada'&&(await tx.query("SELECT 1 FROM subscriptions WHERE business_id=$1 AND status<>'cancelada' AND source_key IS DISTINCT FROM $2",[empresa,l.chave])).rows.length)empresa=null;
      if(empresa&&!estado.dono(empresa)) {
        await tx.query('INSERT INTO client_businesses(client_id,business_id,nome_cache,slug_cache,bairro_cache,foto_cache,vinculado_em,vinculado_por) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [cliente.id,empresa,l.empresa.nome,l.empresa.slug||empresa,l.empresa.bairro||'',l.empresa.foto||'',now.toISOString(),session.user_id]);
        estado.vinculos.push({business_id:empresa,client_id:cliente.id,nome_cache:l.empresa.nome,nome:''});
      } else if(empresa&&estado.dono(empresa).client_id!==cliente.id)empresa=null;
      if(!empresa)feito.semEmpresa++;
      const suspensaEm=l.status==='suspensa'?cx.hoje:null,canceladaEm=l.status==='cancelada'?l.venceEm:null,diaBase=+l.venceEm.slice(8,10);
      let subId=l.existente,antes=null;
      if(l.acao==='novo') {
        subId=randomUUID();
        await tx.query(`INSERT INTO subscriptions(id,client_id,business_id,plano_site,plano_nome,valor_centavos,ciclo,inicio,vence_em,dia_base,status,suspensa_em,
          cancelada_em,origem,source_key,criado_em,atualizado_em) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
          [subId,cliente.id,empresa,l.plano?.id||null,l.plano?.nome||'',l.valorCentavos,l.ciclo,l.inicio,l.venceEm,diaBase,l.status,suspensaEm,canceladaEm,r.tipo,l.chave,now.toISOString()]);
      } else {
        antes=(await tx.query('SELECT business_id FROM subscriptions WHERE id=$1 FOR UPDATE',[subId])).rows[0];
        // A gerida não muda (8.4): a avaliação acima já a ignorou, e o WHERE confere de novo.
        const u=await tx.query(`UPDATE subscriptions SET business_id=$2,plano_site=$3,plano_nome=$4,valor_centavos=$5,ciclo=$6,inicio=LEAST(inicio,$7::date),vence_em=$7,
          dia_base=$8,status=$9,suspensa_em=CASE WHEN $9='suspensa' THEN COALESCE(suspensa_em,$10::date) END,
          cancelada_em=CASE WHEN $9='cancelada' THEN COALESCE(cancelada_em,$11::date) END,atualizado_em=$12,version=version+1
          WHERE id=$1 AND gerida_em IS NULL RETURNING id`,[subId,empresa,l.plano?.id||null,l.plano?.nome||'',l.valorCentavos,l.ciclo,l.venceEm,diaBase,l.status,
          suspensaEm,canceladaEm,now.toISOString()]);
        if(!u.rows.length){feito.atualizados--;feito.ignorados++;if(!empresa)feito.semEmpresa--;continue;}
      }
      // A fila do plano (9.3), só quando o plano no guia pode mudar: a empresa que saiu volta a não ter plano; a da linha recebe
      // o plano esperado.
      if(l.acao==='atualizar'&&!l.mudancas.some(k=>['empresa','plano','status','venceEm'].includes(k))&&(antes?.business_id??null)===empresa)continue;
      const s=(await tx.query('SELECT status,vence_em::text AS vence_em,plano_site FROM subscriptions WHERE id=$1',[subId])).rows[0];
      if(antes?.business_id&&antes.business_id!==empresa)await enfileirar(tx,{businessId:antes.business_id,plano:null,assinatura:subId,motivo:'importacao',now});
      if(empresa)await enfileirar(tx,{businessId:empresa,plano:planoEsperado(s,cx.hoje,cx.tolerancia),assinatura:subId,motivo:'importacao',now});
    }
    await tx.query("UPDATE imports SET status='confirmada',previa=NULL,resumo=$2,confirmado_em=$3,confirmado_por=$4,version=version+1 WHERE id=$1",
      [id,JSON.stringify(feito),now.toISOString(),session.user_id]);
    await audit(tx,{actor:session.user_id,action:'importacao_confirmada',type:'importacao',resource:id,after:{tipo:r.tipo,...feito,clientesNovos},ip});
    return importacaoVM(await carregar(tx,id));
  });
}

export async function descartarImportacao(db,{id,session,ip,now=new Date()}) {
  await expirarImportacoes(db,now);
  return db.transaction(async tx=>{
    const r=await carregar(tx,id,{lock:true});aberta(r);
    await tx.query("UPDATE imports SET status='descartada',previa=NULL,version=version+1 WHERE id=$1",[id]);
    await audit(tx,{actor:session.user_id,action:'importacao_descartada',type:'importacao',resource:id,after:{tipo:r.tipo,linhas:r.linhas},ip});
    return {ok:true};
  });
}
