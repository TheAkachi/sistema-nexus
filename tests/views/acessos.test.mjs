import { test } from 'node:test';
import assert from 'node:assert/strict';
import { views } from '../../api/views/index.mjs';
import { tela, ficha } from './exemplos.mjs';

// fe/acessos-painel: o "Acessos ao painel" em cada empresa da ficha (6.7, v0.12.0), para a lista de acessos do admin do site
// já aberta na empresa, em nova aba, com o aviso de que abre o admin do site e pede o login da equipe de lá.
const html=dados=>views.cliente(tela('cliente',dados));
const com=mudar=>{const d=structuredClone(ficha);mudar(d);return d;};
const empresa=(h,id)=>{const i=h.indexOf(`<li class="empresa" data-empresa="${id}">`);assert.ok(i>=0,id);return h.slice(i,h.indexOf('</li>',i)+5);};

test('ficha: "Acessos ao painel" em cada empresa, em nova aba, com o aviso do admin do site',()=>{
  const h=html(ficha);
  for(const [id,nome] of [['clinica-vida-plena-centro','Clínica Vida Plena · Centro'],['clinica-vida-plena-austin','Clínica Vida Plena · Austin']])
    assert.ok(empresa(h,id).includes(`<a class="botao-texto" href="https://nexus.demo/admin/acessos?empresa=${id}" target="_blank" rel="noopener">Acessos ao painel<span class="sr-only">: ${nome} (abre o admin do guia em outra aba e pede o login da equipe do site)</span> <span aria-hidden="true">↗</span></a>`),id);
  assert.match(empresa(h,'clinica-vida-plena-centro'),/<div class="empresa-acoes"><a class="botao-texto" href="https:\/\/nexus[^"]*\/comercio\/[^"]*"[^>]*>Ver no guia[^]*?<\/a><a class="botao-texto" href="https:\/\/nexus[^"]*\/admin\/acessos\?empresa=/,'depois do "Ver no guia"');
  assert.match(h,/<p class="bloco-nota">"Acessos ao painel" abre o admin do guia em outra aba, com o login da equipe do site: é lá que se convida o cliente para o painel do anunciante\.<\/p><\/section>/);
});

test('ficha: sem o endereço, sem o link nem o aviso; e o escape',()=>{
  const sem=html(com(d=>{d.empresas.forEach(m=>{m.acessosUrl='';});}));
  assert.doesNotMatch(sem,/Acessos ao painel|admin\/acessos/);
  const uma=html(com(d=>{d.empresas[1].acessosUrl='';}));
  assert.doesNotMatch(empresa(uma,'clinica-vida-plena-austin'),/Acessos ao painel/);
  assert.match(uma,/"Acessos ao painel" abre o admin do guia/,'com uma empresa com o endereço, o aviso fica');
  assert.doesNotMatch(html(com(d=>{delete d.empresas[0].acessosUrl;d.empresas[1].acessosUrl='';})),/Acessos ao painel/,'sem o campo, como antes da v0.12.0');
  const x=html(com(d=>{d.empresas[0].acessosUrl='https://guia.test/admin/acessos?empresa="><img src=x onerror=alert(1)>';d.empresas[0].nome='<img src=x>';}));
  assert.doesNotMatch(x,/<img src=x/);
});
