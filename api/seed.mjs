import { hashPassword } from './auth.mjs';
import { chaveDoAmbiente, cifrar } from './lib/cifra.mjs';
import { novoSegredo } from './lib/totp.mjs';
import { hoje as hojeSP, somarMeses } from './lib/datas.mjs';
import { audit } from './lib/auditoria.mjs';

// Seed demonstrativo para portfólio do Sistema Nexus (idempotente).
// Cria contas @nexus.demo, planos do guia, 8 clientes reais do Rio de Janeiro alinhados ao guia Nexus,
// assinaturas em diferentes status (em dia, lembrar hoje, a vencer, vencida, inadimplente, suspensa),
// histórico de pagamentos, contatos, métricas do site (12 meses) e interessados.

const DEMO_SENHA='NexusDemo2026!';

function somarDias(iso,dias) {
  const [a,m,d]=iso.split('-').map(Number);
  const dt=new Date(Date.UTC(a,m-1,d+dias));
  return dt.toISOString().slice(0,10);
}
function mesAnterior(iso,n) {
  const [a,m]=iso.split('-').map(Number);
  const dt=new Date(Date.UTC(a,m-1-n,1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`;
}

export async function seedDemo(db,{now=new Date(),chave=chaveDoAmbiente(process.env,()=>{})}={}) {
  const hoje=hojeSP(now);
  const passHash=await hashPassword(DEMO_SENHA);

  const usuarios=[
    ['00000000-0000-4000-8000-00000000d001','admin@nexus.demo','Pedro Siqueira (Admin)','admin'],
    ['00000000-0000-4000-8000-00000000d002','financeiro@nexus.demo','Camila Rocha (Financeiro)','financeiro'],
    ['00000000-0000-4000-8000-00000000d003','comercial@nexus.demo','Lucas Mendes (Comercial)','comercial'],
    ['00000000-0000-4000-8000-00000000d004','leitura@nexus.demo','Ana Clara (Leitura)','leitura']
  ];

  const planos=[
    ['plano-basico','Plano Presença',true,'ativo',7900],
    ['plano-destaque','Plano Destaque',true,'ativo',14900],
    ['plano-premium','Plano Curadoria Premium',true,'ativo',24900]
  ];

  const clientes=[
    {id:'00000000-0000-4000-8000-00000000c001',nome:'Confeitaria Colombo',responsavel:'Beatriz Alencar',whatsapp:'5521988110001',email:'contato@colombo.nexus.demo',notas:'Parceiro fundador no Centro. Prefere contato comercial pela manhã.',
      empresa:{id:'confeitaria-colombo',nome:'Confeitaria Colombo',slug:'confeitaria-colombo',bairro:'Centro'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a001',plano:'plano-premium',planoNome:'Plano Curadoria Premium',valor:24900,ciclo:'mensal',inicio:somarMeses(hoje,-6),venceEm:somarDias(hoje,18),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c002',nome:'Bar do Mineiro',responsavel:'Diogo Tavares',whatsapp:'5521988110002',email:'financeiro@bardomineiro.nexus.demo',notas:'Unidade Santa Teresa com alto volume de cliques no mapa.',
      empresa:{id:'bar-do-mineiro',nome:'Bar do Mineiro',slug:'bar-do-mineiro',bairro:'Santa Teresa'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a002',plano:'plano-destaque',planoNome:'Plano Destaque',valor:14900,ciclo:'mensal',inicio:somarMeses(hoje,-5),venceEm:somarDias(hoje,-3),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c003',nome:'Livraria da Travessa · Ipanema',responsavel:'Mariana Peixoto',whatsapp:'5521988110003',email:'marketing@travessa.nexus.demo',notas:'Renovação trimestral combinada via Pix.',
      empresa:{id:'livraria-da-travessa-ipanema',nome:'Livraria da Travessa · Ipanema',slug:'livraria-da-travessa-ipanema',bairro:'Ipanema'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a003',plano:'plano-premium',planoNome:'Plano Curadoria Premium',valor:69900,ciclo:'trimestral',inicio:somarMeses(hoje,-4),venceEm:somarDias(hoje,1),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c004',nome:'Teatro Rival Petrobras',responsavel:'Rafael Bastos',whatsapp:'5521988110004',email:'producao@teatrorival.nexus.demo',notas:'Recebe relatório mensal de cliques e agenda cultural.',
      empresa:{id:'teatro-rival-petrobras',nome:'Teatro Rival Petrobras',slug:'teatro-rival-petrobras',bairro:'Cinelândia'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a004',plano:'plano-destaque',planoNome:'Plano Destaque',valor:14900,ciclo:'mensal',inicio:somarMeses(hoje,-3),venceEm:somarDias(hoje,7),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c005',nome:'Aprazível Restaurante',responsavel:'Helena Duarte',whatsapp:'5521988110005',email:'reservas@aprazivel.nexus.demo',notas:'Plano anual com destaque editorial.',
      empresa:{id:'aprazivel',nome:'Aprazível',slug:'aprazivel',bairro:'Santa Teresa'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a005',plano:'plano-premium',planoNome:'Plano Curadoria Premium',valor:249000,ciclo:'anual',inicio:somarMeses(hoje,-8),venceEm:somarDias(hoje,120),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c006',nome:'Estação NET Botafogo',responsavel:'Bruno Salles',whatsapp:'5521988110006',email:'cinema@estacaonet.nexus.demo',notas:'Aguardando confirmação do financeiro após reajuste.',
      empresa:{id:'estacao-net-botafogo',nome:'Estação NET Botafogo',slug:'estacao-net-botafogo',bairro:'Botafogo'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a006',plano:'plano-destaque',planoNome:'Plano Destaque',valor:14900,ciclo:'mensal',inicio:somarMeses(hoje,-4),venceEm:somarDias(hoje,-16),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c007',nome:'Café Lamas',responsavel:'Sérgio Nogueira',whatsapp:'5521988110007',email:'adm@cafelamas.nexus.demo',notas:'Vence em breve; lembrar 15 dias antes.',
      empresa:{id:'cafe-lamas',nome:'Café Lamas',slug:'cafe-lamas',bairro:'Flamengo'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a007',plano:'plano-basico',planoNome:'Plano Presença',valor:7900,ciclo:'mensal',inicio:somarMeses(hoje,-2),venceEm:somarDias(hoje,14),status:'ativa'}},
    {id:'00000000-0000-4000-8000-00000000c008',nome:'Braseiro da Gávea',responsavel:'Fernanda Lemos',whatsapp:'5521988110008',email:'gerencia@braseiro.nexus.demo',notas:'Pausou campanha durante reforma do salão.',
      empresa:{id:'braseiro-da-gavea',nome:'Braseiro da Gávea',slug:'braseiro-da-gavea',bairro:'Gávea'},
      assinatura:{id:'00000000-0000-4000-8000-00000000a008',plano:'plano-basico',planoNome:'Plano Presença',valor:7900,ciclo:'mensal',inicio:somarMeses(hoje,-5),venceEm:somarDias(hoje,-25),status:'suspensa',suspensaEm:somarDias(hoje,-10),motivo:'Reforma temporária do salão'}}
  ];

  await db.transaction(async tx=>{
    for(const [id,email,nome,papel] of usuarios) {
      const secret=cifrar(chave,novoSegredo(),id);
      await tx.query(`INSERT INTO users(id,email,nome,papel,password_hash,totp_secret,totp_ativo,criado_em)
        VALUES($1,$2,$3,$4,$5,$6,true,$7) ON CONFLICT(email) DO NOTHING`,[id,email,nome,papel,passHash,secret,now.toISOString()]);
    }

    await tx.query(`UPDATE settings SET chave_pix='financeiro@nexus.demo', whatsapp_atendimento='5521999990000',
      modelos_lembrete=$1 WHERE id=1 AND chave_pix=''`,[JSON.stringify({
      '7':'Olá, {responsavel}! Aqui é do Nexus. Passando para lembrar que a assinatura do plano {plano} da {empresa} {prazo} ({valor}). Qualquer dúvida, estamos por aqui!',
      '1':'Olá, {responsavel}! A assinatura da {empresa} no Nexus vence amanhã ({valor}). Para renovar, faça o Pix para {chave_pix} e envie o comprovante.'
    })]);

    for(const [id,nome,pago,status,preco] of planos) {
      await tx.query(`INSERT INTO site_plans(id,nome,pago,status,preco_centavos,atualizado_em)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET nome=$2,pago=$3,status=$4,preco_centavos=$5,atualizado_em=$6`,
        [id,nome,pago,status,preco,now.toISOString()]);
    }

    const adminId=usuarios[0][0];
    const finId=usuarios[1][0];
    const comId=usuarios[2][0];

    for(const c of clientes) {
      await tx.query(`INSERT INTO clients(id,nome,responsavel,whatsapp,email,notas,status,criado_em,atualizado_em)
        VALUES($1,$2,$3,$4,$5,$6,'ativo',$7,$7) ON CONFLICT(id) DO NOTHING`,
        [c.id,c.nome,c.responsavel,c.whatsapp,c.email,c.notas,now.toISOString()]);
      await tx.query(`INSERT INTO client_businesses(client_id,business_id,nome_cache,slug_cache,bairro_cache,vinculado_em,vinculado_por)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(client_id,business_id) DO NOTHING`,
        [c.id,c.empresa.id,c.empresa.nome,c.empresa.slug,c.empresa.bairro,now.toISOString(),adminId]);
      const a=c.assinatura;
      const diaBase=Number(a.venceEm.slice(8,10));
      await tx.query(`INSERT INTO subscriptions(id,client_id,business_id,plano_site,plano_nome,valor_centavos,ciclo,inicio,vence_em,dia_base,status,suspensa_em,motivo,origem,gerida_em,criado_em,atualizado_em)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual',$14,$14,$14) ON CONFLICT(id) DO NOTHING`,
        [a.id,c.id,c.empresa.id,a.plano,a.planoNome,a.valor,a.ciclo,a.inicio,a.venceEm,diaBase,a.status,a.suspensaEm||null,a.motivo||'',now.toISOString()]);
    }

    // Histórico de pagamentos realistas nos últimos 6 meses (idempotente por ID).
    const pagamentos=[
      ['00000000-0000-4000-8000-00000000p001','00000000-0000-4000-8000-00000000a001',24900,somarDias(hoje,-12),'pix',1],
      ['00000000-0000-4000-8000-00000000p002','00000000-0000-4000-8000-00000000a001',24900,somarMeses(hoje,-1),'pix',1],
      ['00000000-0000-4000-8000-00000000p003','00000000-0000-4000-8000-00000000a001',24900,somarMeses(hoje,-2),'pix',1],
      ['00000000-0000-4000-8000-00000000p004','00000000-0000-4000-8000-00000000a002',14900,somarMeses(hoje,-1),'transferencia',1],
      ['00000000-0000-4000-8000-00000000p005','00000000-0000-4000-8000-00000000a002',14900,somarMeses(hoje,-2),'transferencia',1],
      ['00000000-0000-4000-8000-00000000p006','00000000-0000-4000-8000-00000000a003',69900,somarMeses(hoje,-3),'pix',3],
      ['00000000-0000-4000-8000-00000000p007','00000000-0000-4000-8000-00000000a004',14900,somarDias(hoje,-23),'boleto',1],
      ['00000000-0000-4000-8000-00000000p008','00000000-0000-4000-8000-00000000a004',14900,somarMeses(hoje,-2),'boleto',1],
      ['00000000-0000-4000-8000-00000000p009','00000000-0000-4000-8000-00000000a005',249000,somarMeses(hoje,-8),'transferencia',12],
      ['00000000-0000-4000-8000-00000000p010','00000000-0000-4000-8000-00000000a007',7900,somarDias(hoje,-16),'pix',1]
    ];
    for(const [id,subId,valor,pagoEm,forma,meses] of pagamentos) {
      const venceDepois=somarMeses(pagoEm,meses);
      await tx.query(`INSERT INTO payments(id,subscription_id,valor_centavos,pago_em,forma,meses,vence_antes,vence_depois,referencia_de,referencia_ate,obs,registrado_por,registrado_em)
        VALUES($1,$2,$3,$4,$5,$6,$4,$7,$4,$7,'Baixa demonstrativa',$8,$9) ON CONFLICT(id) DO NOTHING`,
        [id,subId,valor,pagoEm,forma,meses,venceDepois,finId,now.toISOString()]);
    }

    // Contatos recentes na linha do tempo.
    await tx.query(`INSERT INTO contacts(id,subscription_id,canal,tipo,vence_em,feito_em,feito_por)
      VALUES('00000000-0000-4000-8000-00000000k001','00000000-0000-4000-8000-00000000a002','whatsapp','cobranca',$1,$2,$3) ON CONFLICT(id) DO NOTHING`,
      [somarDias(hoje,-3),new Date(now.getTime()-86400000).toISOString(),comId]);

    // Métricas simuladas do guia Nexus para preencher gráficos e rankings de Indicadores.
    const mesesSite=Array.from({length:6},(_,i)=>{
      const m=mesAnterior(hoje,5-i);
      const base=2400+i*420;
      return {mes:m,visitas:base,contatos:{whatsapp:Math.round(base*0.09),telefone:Math.round(base*0.02),rota:Math.round(base*0.07),site:Math.round(base*0.05)},buscas:Math.round(base*0.42),buscasSemResultado:Math.round(base*0.03)};
    });
    const metricas={
      medidoDesde:{contatos:somarMeses(hoje,-6),buscas:somarMeses(hoje,-5)},
      site:{
        meses:mesesSite,
        buscasMaisFeitas:[{termo:'café especial',vezes:184},{termo:'samba ao vivo',vezes:142},{termo:'feijoada santa teresa',vezes:118},{termo:'cinema de rua',vezes:96},{termo:'restaurante centro',vezes:81}],
        buscasSemResultado:[{termo:'jazz madrugada',vezes:19},{termo:'vinil ipanema',vezes:14},{termo:'café 24h',vezes:11}],
        bairros:[{bairro:'Centro',vezes:620},{bairro:'Santa Teresa',vezes:540},{bairro:'Ipanema',vezes:480},{bairro:'Botafogo',vezes:410},{bairro:'Flamengo',vezes:290}],
        categorias:[{categoria:'restaurantes',nome:'Restaurantes',vezes:890},{categoria:'cafes',nome:'Cafés & Confeitarias',vezes:640},{categoria:'bares',nome:'Bares & Botecos',vezes:530},{categoria:'cultura',nome:'Teatros, Cinemas & Livrarias',vezes:470}]
      },
      empresas:[
        {id:'confeitaria-colombo',nome:'Confeitaria Colombo',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:420+i*35,contatos:{whatsapp:42+i*4,telefone:12,rota:38+i*3,site:29}})),ultimos30:{visitas:595,contatos:{whatsapp:62,telefone:14,rota:53,site:34}}},
        {id:'bar-do-mineiro',nome:'Bar do Mineiro',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:310+i*20,contatos:{whatsapp:28+i*2,telefone:8,rota:31+i*2,site:14}})),ultimos30:{visitas:410,contatos:{whatsapp:38,telefone:9,rota:41,site:18}}},
        {id:'livraria-da-travessa-ipanema',nome:'Livraria da Travessa · Ipanema',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:280+i*18,contatos:{whatsapp:19+i*2,telefone:6,rota:24,site:35}})),ultimos30:{visitas:370,contatos:{whatsapp:29,telefone:7,rota:27,site:42}}},
        {id:'teatro-rival-petrobras',nome:'Teatro Rival Petrobras',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:240+i*15,contatos:{whatsapp:16+i,telefone:5,rota:22,site:44}})),ultimos30:{visitas:315,contatos:{whatsapp:21,telefone:6,rota:25,site:51}}},
        {id:'aprazivel',nome:'Aprazível',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:360+i*28,contatos:{whatsapp:51+i*3,telefone:15,rota:44,site:39}})),ultimos30:{visitas:500,contatos:{whatsapp:66,telefone:16,rota:49,site:45}}},
        {id:'estacao-net-botafogo',nome:'Estação NET Botafogo',meses:mesesSite.map((x,i)=>({mes:x.mes,visitas:110-i*8,contatos:{whatsapp:3,telefone:1,rota:4,site:8}})),ultimos30:{visitas:68,contatos:{whatsapp:2,telefone:0,rota:3,site:5}}}
      ],
      banners:[
        {id:'bn-colombo',titulo:'Chá da Tarde Histórico · Confeitaria Colombo',empresa:{id:'confeitaria-colombo',nome:'Confeitaria Colombo'},impressoes:4820,cliques:214},
        {id:'bn-rival',titulo:'Programação de Música ao Vivo · Teatro Rival',empresa:{id:'teatro-rival-petrobras',nome:'Teatro Rival Petrobras'},impressoes:3190,cliques:148}
      ]
    };
    await tx.query(`INSERT INTO site_metrics(id,de,ate,dados,lido_em,erro,tentado_em)
      VALUES(1,$1,$2,$3,$4,'',$4) ON CONFLICT(id) DO UPDATE SET de=$1,ate=$2,dados=$3,lido_em=$4,erro='',tentado_em=$4`,
      [mesesSite[0].mes,mesesSite[mesesSite.length-1].mes,JSON.stringify(metricas),now.toISOString()]);

    // Interessados (leads) vindos do guia Nexus.
    const leads=[
      ['00000000-0000-4000-8000-00000000l001','NX7K4','Olá! Tenho interesse em destacar nosso café especial em Botafogo no guia Nexus.','plano-destaque','novo','Café Curto Botafogo','5521988220001','Enviar apresentação de planos'],
      ['00000000-0000-4000-8000-00000000l002','PR9M3','Queremos anunciar a programação mensal da galeria no Nexus.','plano-premium','em-conversa','Galeria Laura Alvim','5521988220002','Agendar ligação na quarta-feira'],
      ['00000000-0000-4000-8000-00000000l003','TR4V9','Gostaria de saber os valores do plano anual para bistrô na Lapa.','plano-basico','proposta','Bistrô da Lapa','5521988220003','Aguardar retorno da proposta']
    ];
    for(const [id,codigo,texto,origem,situacao,nome,whatsapp,proximaAcao] of leads) {
      await tx.query(`INSERT INTO leads(id,codigo,texto,respostas,origem,pedido_em,recebido_em,nome,whatsapp,situacao,proxima_acao,proxima_em,atualizado_em)
        VALUES($1,$2,$3,'{}',$4,$5,$5,$6,$7,$8,$9,$10,$5) ON CONFLICT(id) DO NOTHING`,
        [id,codigo,texto,origem,now.toISOString(),nome,whatsapp,situacao,proximaAcao,somarDias(hoje,2)]);
    }

    await audit(tx,{actor:adminId,action:'seed_demo',type:'sistema',resource:'demo',after:{clientes:clientes.length,usuarios:usuarios.length},ip:'cli'});
  });

  return {usuarios:usuarios.length,clientes:clientes.length,planos:planos.length};
}
