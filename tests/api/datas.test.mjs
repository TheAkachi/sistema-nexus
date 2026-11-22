import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoje, dias, diaValido, somarMeses, situacao } from '../../api/lib/datas.mjs';

// Dias em São Paulo, vencimento com o dia base e a situação nas bordas (contrato 5.3 e 5.4; briefing do back, "Testes
// obrigatórios": hoje, tolerância, fim de mês e 29/02).
test('hoje é o dia em São Paulo, não o do servidor',()=>{
  assert.equal(hoje(new Date('2026-10-21T02:59:59Z')),'2026-10-20','23h59 em São Paulo ainda é o dia 20');
  assert.equal(hoje(new Date('2026-10-21T03:00:00Z')),'2026-10-21');
  assert.equal(hoje(new Date('2027-01-01T02:00:00Z')),'2026-12-31','virada do ano');
});

test('dias e dia válido no calendário, com o 29/02 só nos anos bissextos',()=>{
  assert.equal(dias('2026-10-20','2026-10-15'),-5);assert.equal(dias('2026-10-20','2026-11-15'),26);assert.equal(dias('2026-12-31','2027-01-01'),1);
  assert.equal(dias('2028-02-28','2028-03-01'),2,'2028 é bissexto');
  for(const v of ['2028-02-29','2026-10-20','2000-02-29'])assert.equal(diaValido(v),true,v);
  for(const v of ['2027-02-29','2026-13-01','2026-04-31','2026-1-01','20/10/2026','',null,'1900-02-29'])assert.equal(diaValido(v),false,String(v));
});

test('somar meses mantém o dia base: o fim do mês não escorrega',()=>{
  let d='2026-01-31';const seq=[];for(let i=0;i<4;i++){d=somarMeses(d,1,31);seq.push(d);}
  assert.deepEqual(seq,['2026-02-28','2026-03-31','2026-04-30','2026-05-31']);
  assert.equal(somarMeses('2028-02-29',12,29),'2029-02-28');
  assert.equal(somarMeses('2029-02-28',12,29),'2030-02-28');
  assert.equal(somarMeses('2031-02-28',12,29),'2032-02-29','volta ao 29 no ano bissexto');
  assert.equal(somarMeses('2026-11-30',3,30),'2027-02-28','trimestral virando o ano');
  assert.equal(somarMeses('2026-10-15',6),'2027-04-15');
  assert.equal(somarMeses('2026-03-31',-1,31),'2026-02-28','recuar (estorno)');
  assert.equal(somarMeses('2026-01-15',-1),'2025-12-15');
  assert.equal(somarMeses('2026-02-28',-1,31),'2026-01-31');
});

test('situação: 30 dias, hoje, tolerância e um dia depois dela',()=>{
  const s=(venceEm,tolerancia=10,status='ativa')=>situacao({status,venceEm},'2026-10-20',tolerancia);
  assert.equal(s('2026-11-20'),'em-dia','31 dias');
  assert.equal(s('2026-11-19'),'a-vencer','30 dias');
  assert.equal(s('2026-10-20'),'a-vencer','vence hoje');
  assert.equal(s('2026-10-19'),'vencida','venceu ontem');
  assert.equal(s('2026-10-10'),'vencida','último dia da tolerância');
  assert.equal(s('2026-10-09'),'inadimplente','um dia depois da tolerância');
  assert.equal(s('2026-10-19',0),'inadimplente','sem tolerância');
  assert.equal(s('2026-10-01',10,'suspensa'),'suspensa');assert.equal(s('2026-10-01',10,'cancelada'),'cancelada');
});
