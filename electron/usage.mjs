import {cleanEnvironment} from './engine.mjs';
export function normalizeUsage(result) {
 if(!result?.rate_limits_available||!result.rate_limits)throw new Error('O Claude Code não forneceu os limites desta assinatura. Verifique o login do perfil.');
 const windows={};
 for(const key of ['five_hour','seven_day']) {
   const value=result.rate_limits[key];
   if(value&&typeof value.utilization==='number'&&Number.isFinite(value.utilization))windows[key]={utilization:Math.max(0,Math.min(100,value.utilization)),resets_at:typeof value.resets_at==='string'&&Number.isFinite(Date.parse(value.resets_at))?value.resets_at:null};
 }
 if(!Object.keys(windows).length)throw new Error('A resposta do Claude Code não contém percentuais de uso.');
 return {windows,updatedAt:Date.now(),source:'Claude Code /usage'};
}
export async function readAccountUsage({query,cliPath,configDir,cwd,env=process.env,timeoutMs=25000}) {
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 async function* noPrompts(){await waiting;}
 const controller=new AbortController();let session;
 const timeout=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(new Error('A consulta de uso demorou demais. Tente atualizar novamente.')),{once:true});});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try {
   session=query({prompt:noPrompts(),options:{cwd,env:cleanEnvironment(env,configDir),pathToClaudeCodeExecutable:cliPath,settingSources:[],persistSession:false,tools:[],strictMcpConfig:true,mcpServers:{},settings:{disableAllHooks:true},abortController:controller}});
   return await Promise.race([(async()=>{await session.initializationResult();const method=session.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;if(!method)throw new Error('Atualize o Claude Code para consultar o uso da assinatura.');return normalizeUsage(await method.call(session,{skipBehaviors:true}));})(),timeout]);
 }finally{clearTimeout(timer);release();session?.close();}
}
export class UsageMonitor {
 constructor(engine,{query,cliPath,cwd,env}){Object.assign(this,{engine,query,cliPath,cwd,env});this.pending=new Map();}
 refresh(id,{force=true}={}){
   if(this.pending.has(id))return this.pending.get(id);
   const account=this.engine.state.accounts.find(a=>a.id===id);
   if(!account)return Promise.reject(new Error('Conta não encontrada.'));
   if(!force&&account.usage&&Date.now()-account.usage.updatedAt<30000)return Promise.resolve(account.usage);
   if(!this.cliPath)return Promise.reject(new Error('Claude Code não encontrado.'));
   account.usageLoading=true;delete account.usageError;this.engine.publish();
   const task=(async()=>{
     try {const usage=await readAccountUsage({query:this.query,cliPath:this.cliPath,configDir:account.configDir,cwd:this.cwd,env:this.env});if(this.engine.state.accounts.includes(account))account.usage=usage;return usage;}
     catch(e){account.usageError=e.message;throw e;}
     finally {account.usageLoading=false;this.pending.delete(id);this.engine.publish();await this.engine.save();}
   })();this.pending.set(id,task);return task;
 }
 async refreshAll(){if(this.sweeping)return;this.sweeping=true;try{for(const a of [...this.engine.state.accounts])if(a.loggedIn&&!a.loggingIn)await this.refresh(a.id,{force:false}).catch(()=>{});}finally{this.sweeping=false;}}
}
