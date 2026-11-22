import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { assinar } from '../../api/integracao.mjs';

// Site falso para os testes: as rotas de 9.1 do contrato, com a conferência da assinatura de 9.2 (chave, carimbo de até
// 5 minutos, nonce sem repetição), como faz o site de verdade (api/integracao-api.mjs do nexus, v0.18.0).
const EMPRESAS=[
  {id:'auto-pecas-iguacu',nome:'Auto Peças Iguaçu',slug:'auto-pecas-iguacu',status:'publicado',bairro:'Centro',plano:null,foto:'/midia/5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e/320.webp'},
  {id:'clinica-vida-plena-austin',nome:'Clínica Vida Plena · Austin',slug:'clinica-vida-plena-austin',status:'publicado',bairro:'Austin',plano:null,foto:'/midia/4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d/320.webp'},
  {id:'clinica-vida-plena-centro',nome:'Clínica Vida Plena · Centro',slug:'clinica-vida-plena-centro',status:'publicado',bairro:'Centro',plano:null,foto:'/midia/3f2a9c1b7d4e5f60718293a4b5c6d7e8/320.webp'},
  {id:'padaria-pao-dourado',nome:'Padaria Pão Dourado',slug:'padaria-pao-dourado',status:'publicado',bairro:'Comendador Soares',plano:null,foto:null},
  {id:'studio-bella',nome:'Studio Bella',slug:'studio-bella',status:'publicado',bairro:'Centro',plano:null,foto:'javascript:alert(1)'}
];
const PLANOS=[
  {id:'plano-premium',nome:'Premium',pago:true,status:'ativo',precoCentavos:9900},
  {id:'plano-avancado',nome:'Avançado',pago:true,status:'ativo',precoCentavos:6700},
  {id:'plano-antigo',nome:'Antigo',pago:true,status:'pausado',precoCentavos:5000},
  {id:'plano-presenca',nome:'Presença',pago:false,status:'ativo',precoCentavos:null}
];
const igual=(a,b)=>{const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);};
export async function siteFalso({chave,chaveId='k1'}) {
  const estado={empresas:structuredClone(EMPRESAS).map(e=>({...e,gerida:false})),planos:structuredClone(PLANOS),fora:false,nonces:new Set(),pedidos:[],puts:[],cadastros:[],leadsLigados:true};
  const json=(res,status,v)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(v));};
  const server=createServer(async(req,res)=>{
    const partes=[];for await(const p of req)partes.push(p);const corpo=Buffer.concat(partes).toString();
    const h=req.headers,carimbo=String(h['x-gestao-carimbo']||''),nonce=String(h['x-gestao-nonce']||'');
    const ok=h['x-gestao-chave']===chaveId&&/^\d+$/.test(carimbo)&&Math.abs(Date.now()/1000-Number(carimbo))<=300&&/^[a-f0-9]{32}$/.test(nonce)&&!estado.nonces.has(nonce)
      &&igual(h['x-gestao-assinatura'],assinar({chave,metodo:req.method,caminho:req.url,carimbo,nonce,corpo}));
    estado.pedidos.push({metodo:req.method,url:req.url,ok});
    if(!ok)return json(res,401,{erro:'Não autorizado.'});
    estado.nonces.add(nonce);
    if(estado.fora)return json(res,500,{erro:'fora'});
    const url=new URL(req.url,'http://site'),norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    if(req.method==='GET'&&url.pathname==='/api/integracao/v1/planos')return json(res,200,{itens:estado.planos});
    if(req.method==='GET'&&url.pathname==='/api/integracao/v1/empresas') {
      const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean),q=norm(url.searchParams.get('q')||''),page=Number(url.searchParams.get('page')||1);
      const todas=estado.empresas.filter(e=>(!ids.length||ids.includes(e.id))&&(!q||norm(e.nome).includes(q)));
      return json(res,200,{itens:todas.slice((page-1)*20,page*20),total:todas.length,pagina:page,paginas:Math.max(1,Math.ceil(todas.length/20))});
    }
    // Métricas (19.6 do contrato do site): o teste pode trocar estado.metricas; o padrão traz as empresas com zero.
    if(req.method==='GET'&&url.pathname==='/api/integracao/v1/metricas') {
      const de=url.searchParams.get('de'),ate=url.searchParams.get('ate'),page=Number(url.searchParams.get('page')||1);
      if(estado.metricas)return json(res,200,estado.metricas({de,ate,page}));
      const zero={whatsapp:0,telefone:0,rota:0,site:0};
      return json(res,200,{de,ate,medidoDesde:{contatos:null,buscas:null},site:{meses:[],buscasMaisFeitas:[],buscasSemResultado:[],bairros:[],categorias:[]},
        empresas:{itens:estado.empresas.map(e=>({id:e.id,nome:e.nome,meses:[],ultimos30:{visitas:0,contatos:zero}})),total:estado.empresas.length,pagina:1,paginas:1},banners:[]});
    }
    // Pedidos do cadastro (23.3 do contrato do site, v0.23.0): o teste põe os pedidos em estado.cadastros; com
    // estado.leadsLigados false, a rota não existe, como no site com a chave desligada.
    if(req.method==='GET'&&url.pathname==='/api/integracao/v1/pedidos') {
      if(!estado.leadsLigados)return json(res,404,{erro:'Endpoint não encontrado.'});
      const desde=url.searchParams.get('desde')||'',d=new Date(desde),page=Number(url.searchParams.get('page')||1);
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(desde)||Number.isNaN(d.getTime()))return json(res,422,{erro:'Informe desde como data e hora ISO.',campo:'desde'});
      const todos=estado.cadastros.filter(p=>p.criadoEm>=d.toISOString()).sort((a,b)=>a.criadoEm.localeCompare(b.criadoEm)||a.codigo.localeCompare(b.codigo));
      return json(res,200,{itens:todos.slice((page-1)*100,page*100),total:todos.length,pagina:page,paginas:Math.max(1,Math.ceil(todos.length/100))});
    }
    // PUT do plano (19.1 do contrato do site): grava o plano e o gerida; repetir não muda nada.
    const m=/^\/api\/integracao\/v1\/empresas\/([^/]+)\/plano$/.exec(url.pathname);
    if(req.method==='PUT'&&m) {
      const e=estado.empresas.find(x=>x.id===m[1]);if(!e)return json(res,404,{erro:'Empresa não encontrada.'});
      const p=JSON.parse(corpo);
      if(p.plano!==null&&!estado.planos.some(x=>x.id===p.plano))return json(res,422,{erro:'Plano não encontrado.',campo:'plano'});
      const alterado=e.plano!==p.plano||e.gerida!==p.gerida;e.plano=p.plano;e.gerida=p.gerida;estado.puts.push({id:e.id,...p});
      return json(res,200,{id:e.id,plano:p.plano,alterado});
    }
    return json(res,404,{erro:'Endpoint não encontrado.'});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {url:`http://127.0.0.1:${server.address().port}`,estado,fechar:()=>new Promise(r=>server.close(r))};
}
