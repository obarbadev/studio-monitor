import {mkdir,lstat,realpath,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {TemplateManager} from './templates.mjs';
import {projectActivity} from './project-activity.mjs';
const installer=new TemplateManager(fileURLToPath(new URL('../templates',import.meta.url)));
export async function ensureStudioStatusline(root){const plan=await installer.previewStatusline(root,{studio:true});return installer.install(plan.token);}
async function safeWrite(root,relative,value){
 root=await realpath(root);const file=path.join(root,relative);let directory=root;
 for(const segment of path.dirname(relative).split('/')){directory=path.join(directory,segment);try{if((await lstat(directory)).isSymbolicLink())throw new Error('Diretório de telemetria não pode ser um link.');}catch(e){if(e.code!=='ENOENT')throw e;await mkdir(directory);}}
 try{if((await lstat(file)).isSymbolicLink())throw new Error('Arquivo de telemetria não pode ser um link.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const temporary=file+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
}
export class StudioTelemetry{
 constructor(onError,{projectStatus=true}={}){this.projectStatus=projectStatus;this.onError=onError;this.tail=Promise.resolve();this.lastKey=null;this.error=null;}
 update(state){
  if(!state.project)return;
  const data={provider:state.activeProvider||state.provider||'claude',root:state.project.path,sessionId:state.externalSession?null:state.sessionId,metrics:state.sessionMetrics||null,model:state.sessionMetrics?.model||state.model,phase:state.projectPhases?.[state.project.path]?.name||null,activeAgents:state.agents.filter(a=>a.status==='running').length,tool:state.mainTool||null,busy:state.busy};
  const key=JSON.stringify(data);if(key===this.lastKey)return;this.lastKey=key;
  this.tail=this.tail.catch(()=>{}).then(async()=>{
   let activity={};try{const file=path.join(data.root,'production/session-state/active.md');const text=await readFile(file,'utf8');activity=projectActivity({activeText:text});}catch{}
   if(this.projectStatus)await safeWrite(data.root,'.studio/runtime/project-status.json',{schemaVersion:1,model:data.model,provider:data.provider,phase:data.phase||activity.phase,phaseSource:data.phase?'manual':'inferred',activeAgents:data.activeAgents,tool:data.tool,busy:data.busy,updatedAt:Date.now()});
   const m=data.metrics;if(!data.sessionId||!m?.updatedAt||!/^[\w-]{1,128}$/.test(data.sessionId))return;
   const used=Number.isFinite(m.contextWindow)&&m.contextWindow>0&&Number.isFinite(m.lastInputTokens)?Math.min(100,(m.lastInputTokens+(m.lastOutputTokens||0))/m.contextWindow*100):null;
   await safeWrite(data.root,`.studio/runtime/statusline-sdk/${data.provider==='claude'?'':data.provider+'/'}${data.sessionId}.json`,{schemaVersion:1,source:'studio-sdk',provider:data.provider,sessionId:data.sessionId,projectPath:await realpath(data.root),writtenAt:new Date(m.updatedAt).toISOString(),model:{id:data.model,name:data.model},context:{usedPercentage:used,windowTokens:m.contextWindow||null,inputTokens:m.lastInputTokens??null,outputTokens:m.lastOutputTokens??null,lastInputTokens:m.lastInputTokens??null},cost:{totalUsd:m.costUsd??null}});
   this.error=null;
  }).catch(e=>{if(this.error!==e.message){this.error=e.message;this.onError?.(e);}});
 }
 async flush(){await this.tail;}
}
