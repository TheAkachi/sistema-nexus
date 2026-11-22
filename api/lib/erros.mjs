// Erro com status HTTP para as APIs: {erro, campo?} (contrato 2.3), com campo igual ao nome do campo recusado.
// extra: campos a mais na resposta, como {reautenticar:true} (contrato 4.6).
export const fail=(message,status=422,campo,extra)=>Object.assign(new Error(message),{status,...(campo?{campo}:{}),...(extra?{extra}:{})});
