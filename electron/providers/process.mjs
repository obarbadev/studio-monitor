import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
export function redactProviderError(value){return String(value).replace(/\x1b\[[0-9;]*m/g,'').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redigido]').replace(/((?:api[_-]?key|access_token|refresh_token)["'\s:=]+)[^\s,"'}]+/gi,'$1[redigido]').replace(/\b(?:sk|AIza)[-_A-Za-z0-9]{20,}/g,'[redigido]');}
export function nativeProcess({binary,args,input,cwd,env,signal,spawnProcess=spawn}){
 if(signal.aborted)throw new Error('Execução interrompida.');
 const child=spawnProcess(binary,args,{cwd,env,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});let stderr='',settled=false,killTimer;
 const kill=()=>{if(settled)return;try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch{}killTimer=setTimeout(()=>{if(!settled){try{if(process.platform!=='win32'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}}},1500);killTimer.unref?.();};
 const completion=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,term)=>resolve({code,term}));});completion.catch(()=>{});
 signal.addEventListener('abort',kill,{once:true});child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-12000);});child.stdin.on('error',()=>{});child.stdin.end(input);
 const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
 async function* stream(){try{for await(const line of lines){if(!line.trim())continue;if(line.length>8*1024*1024)throw new Error('Evento do executor excede 8 MB.');let event;try{event=JSON.parse(line);}catch{throw new Error('O executor retornou uma saída inválida. Atualize o programa oficial.');}yield event;}const {code}=await completion;if(!signal.aborted&&code!==0)throw new Error(redactProviderError(stderr.trim())||`O executor encerrou com código ${code}.`);}finally{if(!settled)kill();await completion.catch(()=>{});settled=true;clearTimeout(killTimer);signal.removeEventListener('abort',kill);lines.close();}}
 // Track process completion separately: finishing stdout does not imply the process is gone.
 completion.finally(()=>{settled=true;clearTimeout(killTimer);}).catch(()=>{});
 return {stream:stream(),close:kill};
}
export function nativeArguments(provider,{model='',effort='default',sessionId=null,cwd=null}={}){
 if(model&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model))throw new Error('Identificador de modelo inválido.');
 if(sessionId&&!/^[\w-]{1,128}$/.test(sessionId))throw new Error('Identificador de sessão inválido.');
 if(provider==='codex')return ['exec',...(sessionId?['resume',sessionId]:[]),'--json','--skip-git-repo-check','--dangerously-bypass-approvals-and-sandbox',...(cwd?['-c',`projects.${JSON.stringify(cwd)}.trust_level="trusted"`]:[]),...(model?['--model',model]:[]),...(effort!=='default'?['-c',`model_reasoning_effort=${JSON.stringify(effort)}`]:[]),'-'];
 if(provider==='gemini')return ['--input-format','stream-json','--output-format','stream-json','--dangerously-skip-permissions',...(model?['--model',model]:[]),...(effort!=='default'?['--effort',effort]:[]),...(sessionId?['--conversation',sessionId]:[])];
 throw new Error('Executor inválido.');
}
