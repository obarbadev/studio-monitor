import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {redactProviderError} from './process.mjs';
const execute=promisify(execFile);
export async function readCodexAccount({binary,env,cwd,timeoutMs=20000,spawnProcess=spawn}){
 const child=spawnProcess(binary,['app-server','--listen','stdio://'],{env,cwd,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});const lines=createInterface({input:child.stdout});const pending=new Map();let sequence=0,closed=false;
 const fail=error=>{for(const request of pending.values())request.reject(error);pending.clear();};
 child.on('error',e=>fail(e));child.on('close',()=>{closed=true;fail(new Error('A consulta do Codex foi encerrada.'));});child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 lines.on('line',line=>{if(line.length>2*1024*1024){fail(new Error('Resposta de conta excede o limite.'));return;}let row;try{row=JSON.parse(line);}catch{return;}const request=pending.get(row.id);if(request){pending.delete(row.id);if(row.error)request.reject(new Error(redactProviderError(row.error.message||'Falha na consulta do Codex.')));else request.resolve(row.result);}});
 const request=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,params})+'\n');});
 const kill=signal=>{try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch{child.kill(signal);}};
 const timer=setTimeout(()=>{fail(new Error('A consulta de limites demorou demais.'));kill('SIGTERM');},timeoutMs);
 try{await request('initialize',{clientInfo:{name:'studio_monitor_limits',title:'Studio Monitor limits',version:'0.2.0'}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');const account=await request('account/read',{refreshToken:false});if(account.account?.type!=='chatgpt')throw new Error('Entre com uma conta ChatGPT neste perfil do Codex.');const limits=await request('account/rateLimits/read');return {account:account.account,limits};}
 finally{clearTimeout(timer);lines.close();fail(new Error('Consulta concluída.'));child.stdin.end();if(!closed){kill('SIGTERM');const killTimer=setTimeout(()=>{if(!closed)kill('SIGKILL');},1000);killTimer.unref?.();}}
}
const percent=v=>typeof v==='number'&&Number.isFinite(v)?Math.min(100,Math.max(0,v)):null;
const reset=v=>typeof v==='number'&&Number.isFinite(v)?new Date(v*1000).toISOString():typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
export function normalizeCodexLimits(result){
 const groups=result.rateLimitsByLimitId&&typeof result.rateLimitsByLimitId==='object'?Object.values(result.rateLimitsByLimitId):[result.rateLimits];const windows=[];
 for(const group of groups.filter(Boolean))for(const key of ['primary','secondary']){const w=group[key],used=percent(w?.usedPercent);if(used===null)continue;windows.push({id:(group.limitId||'codex')+'-'+key,label:group.limitName||group.limitId||'Codex',windowMinutes:Number.isFinite(w.windowDurationMins)?w.windowDurationMins:null,utilization:used,remaining:100-used,resetsAt:reset(w.resetsAt)});}
 if(!windows.length)throw new Error('O Codex não informou percentuais de limite para esta conta.');return {windows,updatedAt:Date.now(),source:'Codex account/rateLimits/read'};
}
export function normalizeAgyLimits(envelope){
 if(envelope.status!=='SUCCESS'||envelope.command?.name!=='usage'||envelope.num_turns!==0)throw new Error('O AGY não retornou a consulta nativa de limites. Atualize o programa.');const groups=envelope.command.data?.groups,windows=[];
 for(const group of Array.isArray(groups)?groups:[])for(const bucket of Array.isArray(group.buckets)?group.buckets:[]){if(typeof bucket.remaining_fraction!=='number'||!Number.isFinite(bucket.remaining_fraction))continue;const remaining=percent(bucket.remaining_fraction*100);windows.push({id:bucket.id||String(windows.length),label:group.name||'AGY',windowMinutes:bucket.window==='weekly'?10080:bucket.window==='5h'?300:null,utilization:100-remaining,remaining,resetsAt:reset(bucket.reset_time)});}
 if(!windows.length)throw new Error('O AGY não informou limites para esta conta.');return {windows,updatedAt:Date.now(),source:'AGY /usage'};
}
export async function readNativeLimits({provider,binary,env,cwd,executeCommand=execute,readCodex=readCodexAccount}){
 if(provider==='codex'){const result=await readCodex({binary,env,cwd});return {usage:normalizeCodexLimits(result.limits),email:result.account.email,plan:result.account.planType};}
 const result=await executeCommand(binary,['-p','/usage','--output-format','json','--print-timeout','15s'],{env,cwd,timeout:20000,maxBuffer:512*1024});return {usage:normalizeAgyLimits(JSON.parse(result.stdout))};
}
