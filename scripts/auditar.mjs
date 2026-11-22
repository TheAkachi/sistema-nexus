import { spawnSync } from 'node:child_process';
// pnpm audit dentro do pnpm check (Parte B do briefing de segurança, item 12). Usa o mesmo pnpm que roda o script
// (npm_execpath), porque nem toda máquina tem o pnpm no PATH: no Windows ele pode vir só pelo corepack.
const pnpm=process.env.npm_execpath;
const [cmd,args]=!pnpm?['pnpm',[]]:/\.[cm]?js$/.test(pnpm)?[process.execPath,[pnpm]]:[pnpm,[]];
const result=spawnSync(cmd,[...args,'audit','--audit-level=moderate'],{stdio:'inherit',shell:!pnpm});
process.exit(result.status??1);
