// Escape de HTML usado por todas as views: todo texto vindo de um vm passa por aqui antes de entrar no HTML.
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
