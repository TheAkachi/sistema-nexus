// Indicadores (contrato 6.17): a dica de cada faixa dos gráficos, ao passar o mouse ou tocar. O gráfico é decorativo e a
// tabela ao lado traz os mesmos números, então a dica só ajuda a ler: nunca é o único caminho até um valor. O texto vem dos
// data-dica da faixa e entra com textContent.
for(const grafico of document.querySelectorAll('.grafico')) {
  const dica=document.createElement('div'),valor=document.createElement('strong'),titulo=document.createElement('span'),nota=document.createElement('span');
  dica.className='dica';dica.hidden=true;dica.append(valor,titulo,nota);grafico.append(dica);
  let atual=null;

  const mostrar=(faixa,y)=>{
    if(faixa!==atual){
      atual=faixa;valor.textContent=faixa.dataset.dicaValor||'';titulo.textContent=faixa.dataset.dica||'';
      nota.textContent=faixa.dataset.dicaNota||'';nota.hidden=!nota.textContent;dica.hidden=false;
    }
    // Ao lado da faixa (à direita; à esquerda quando não cabe), na altura do ponteiro: a dica nunca cobre a marca lida.
    const caixa=grafico.getBoundingClientRect(),r=faixa.getBoundingClientRect(),largura=dica.offsetWidth,altura=dica.offsetHeight;
    let x=r.right-caixa.left+6;
    if(x+largura>caixa.width)x=r.left-caixa.left-6-largura;
    dica.style.left=`${Math.round(Math.max(0,x))}px`;
    dica.style.top=`${Math.round(Math.min(Math.max(0,y-caixa.top-altura/2),Math.max(0,caixa.height-altura)))}px`;
  };
  const esconder=()=>{atual=null;dica.hidden=true;};

  const seguir=ev=>{const f=ev.target.closest?.('[data-dica]');if(f)mostrar(f,ev.clientY);else esconder();};
  grafico.addEventListener('pointermove',seguir);
  grafico.addEventListener('pointerdown',seguir);
  // No toque, o pointerleave chega logo depois de soltar o dedo: a dica fica até o próximo toque fora do gráfico.
  grafico.addEventListener('pointerleave',ev=>{if(ev.pointerType!=='touch')esconder();});
  document.addEventListener('pointerdown',ev=>{if(!grafico.contains(ev.target))esconder();});
}
