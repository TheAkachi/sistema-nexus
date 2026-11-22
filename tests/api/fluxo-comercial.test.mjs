import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ambiente } from './ambiente.mjs';
import { processarFila } from '../../api/data/fila.mjs';

// Fluxo integrado local da Fase 1. O Guia é o servidor HTTP simulado dos testes;
// esta verificação não substitui o aceite na homologação com o repositório do site.
test('carteira: importar, cobrar, receber, estornar, cancelar e liberar empresa no guia',async()=>{
  const t=await ambiente();
  try {
    const s=await t.sessao('operacao@exemplo.test');
    const req=async(path,options,status=200)=>{
      const r=await t.req(path,{...options,s});assert.equal(r.status,status,r.text);return r.json;
    };
    const csv=Buffer.from('empresa;cliente;email;whatsapp;plano;valor;inicio;vencimento\nPadaria Pão Dourado;Cliente de teste;cliente@exemplo.test;21900000002;Avançado;67,00;15/09/2026;15/10/2026');
    const previa=await req('/api/importacoes?tipo=planilha',{method:'POST',body:csv,headers:{'Content-Type':'text/csv'}},201);
    assert.equal(previa.resumo.novos,1);assert.equal(previa.resumo.erros,0);
    await req(`/api/importacoes/${previa.id}/confirmar`,{method:'POST',body:{version:previa.version}});
    let assinatura=(await req('/api/assinaturas')).itens[0];
    const empresa=t.site.empresas.find(e=>e.id==='padaria-pao-dourado');
    const enviar=async()=>assert.equal((await processarFila(t.db,{site:t.integracao,now:t.agora})).falhas,0);
    await enviar();assert.deepEqual([empresa.plano,empresa.gerida],['plano-avancado',true]);
    const renovacoes=await req('/api/renovacoes?janela=vencidas');
    assert.equal(renovacoes.itens[0].id,assinatura.id);
    assert.match(renovacoes.itens[0].linkWhatsapp,/^https:\/\/wa\.me\//);
    await req(`/api/assinaturas/${assinatura.id}/contatos`,{method:'POST',body:{}},201);
    const pagamento=await req(`/api/assinaturas/${assinatura.id}/pagamentos`,{method:'POST',body:{valorCentavos:6700,pagoEm:'2026-10-20',forma:'pix',version:assinatura.version}},201);
    assert.equal(pagamento.assinatura.venceEm,'2026-11-15');
    assert.equal((await req('/api/resumo')).recebidoMes,6700);
    await enviar();
    const estorno=await req(`/api/pagamentos/${pagamento.pagamento.id}/estornar`,{method:'POST',body:{motivo:'Pagamento de teste estornado'}});
    assert.equal(estorno.assinatura.venceEm,'2026-10-15');
    assert.equal((await req('/api/resumo')).recebidoMes,0);
    assinatura=await req(`/api/assinaturas/${assinatura.id}`);
    await req(`/api/assinaturas/${assinatura.id}/cancelar`,{method:'POST',body:{motivo:'Encerramento do teste',version:assinatura.version}});
    await enviar();assert.equal(empresa.plano,null);
    await req(`/api/clientes/${assinatura.cliente.id}/empresas/${empresa.id}`,{method:'DELETE'});
    await enviar();assert.deepEqual([empresa.plano,empresa.gerida],[null,false]);
    const ficha=await req(`/api/clientes/${assinatura.cliente.id}`);
    assert.ok(ficha.linhaDoTempo.some(x=>x.tipo==='pagamento'));
    assert.ok(ficha.linhaDoTempo.some(x=>x.tipo==='estorno'));
    assert.equal((await t.db.query('SELECT count(*)::int AS n FROM plan_sync WHERE enviado_em IS NULL')).rows[0].n,0);
  } finally {await t.fim();}
});
