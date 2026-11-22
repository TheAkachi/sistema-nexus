// Formato de toda rota de página (contrato 6.1): {title, status, view, vm}, ou {redirect} para mandar a outra página.
// title já vem completo, com a marca; view é o nome de uma view registrada em api/views/index.mjs.
export const MARCA='Gestão Nexus';
export const titulo=texto=>`${texto} | ${MARCA}`;
export const rota=(view,vm={},{title,status=200}={})=>({title,status,view,vm});
export const naoEncontrada=()=>rota('erro',{status:404,mensagem:'Esta página não existe.'},{title:titulo('Página não encontrada'),status:404});
