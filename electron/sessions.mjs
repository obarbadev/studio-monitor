import {readdir,stat,open,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
function textOf(message){if(typeof message?.content==='string')return message.content;return (Array.isArray(message?.content)?message.content:[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');}
export function parseTranscript(text,{knownSkills=new Set()}={}){
 const rows=[];for(const line of text.split('\n')){try{const row=JSON.parse(line);if(row&&typeof row==='object')rows.push(row);}catch{}}
 const messages=[],agents=new Map(),tools=new Map();let cwd=null,title=null,tokens=0,runtimeCatalog=null,sessionMetrics=null;const skillUses=[],instructionsLoaded=[];
 for(const row of rows){
   if(row.cwd)cwd=row.cwd;
   if(row.type==='system'&&row.subtype==='init')runtimeCatalog={skills:row.skills||[],agents:row.agents||[],commands:row.slash_commands||[],plugins:row.plugins||[],updatedAt:Date.parse(row.timestamp)||Date.now()};
   if(row.type==='custom-title'&&row.customTitle)title=row.customTitle;
   if(row.type==='summary'&&row.summary&&!title)title=row.summary;
   const content=row.message?.content;
   if(row.type==='user'){const command=textOf(row.message).match(/<command-name>\/([^<\s]+)<\/command-name>/)?.[1];if(command&&(knownSkills.has(command)||runtimeCatalog?.skills.includes(command)))skillUses.push({name:command,agentId:row.agentId||row.agent_id||null,time:Date.parse(row.timestamp)||Date.now(),source:'slash-command'});}
   if(row.type==='assistant'){
     if(!row.isSidechain&&!row.parent_tool_use_id&&row.message?.usage){const u=row.message.usage;sessionMetrics={model:row.message.model||null,lastInputTokens:(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0),lastOutputTokens:u.output_tokens||0,updatedAt:Date.parse(row.timestamp)||Date.now()};}
     const usage=row.message?.usage;if(usage)tokens+=(usage.input_tokens||0)+(usage.output_tokens||0);
     for(const block of Array.isArray(content)?content:[]){
       if(block.type==='tool_use'){
         tools.set(block.id,block);
         if(block.name==='Skill'&&block.input?.skill)skillUses.push({name:block.input.skill,agentId:row.agentId||row.agent_id||null,time:Date.parse(row.timestamp)||Date.now(),source:'tool'});
         if(['Agent','Task'].includes(block.name))agents.set(block.id,{id:block.id,name:block.input?.subagent_type||block.input?.name||'Subagente',status:'observed',startedAt:Date.parse(row.timestamp)||Date.now(),summary:undefined,tool:'Delegação observada',brief:block.input?.prompt||block.input?.description||undefined});
       }
     }
   }
   if(row.type==='user'&&Array.isArray(content))for(const block of content){if(block.type==='tool_result'&&agents.has(block.tool_use_id)){const a=agents.get(block.tool_use_id);a.status=block.is_error?'interrupted':'completed';a.finishedAt=Date.parse(row.timestamp)||Date.now();a.summary=typeof block.content==='string'?block.content:textOf({content:block.content});}}
   if(['user','assistant'].includes(row.type)&&!row.isSidechain&&!row.parent_tool_use_id){
     const text=textOf(row.message);
     if(text&&!text.startsWith('<local-command')&&!text.startsWith('<command-name>'))messages.push({id:row.uuid||`${row.type}-${messages.length}`,role:row.type,text,time:Date.parse(row.timestamp)||Date.now()});
   }
 }
 return {messages,agents:[...agents.values()],cwd,title:title||messages.find(m=>m.role==='user')?.text?.slice(0,140)||'Conversa sem título',tokens,runtimeCatalog,skillUses,instructionsLoaded,sessionMetrics};
}
async function sample(file){const h=await open(file,'r');try{const s=await h.stat();if(s.size<=512000)return await h.readFile('utf8');const head=Buffer.alloc(256000),tail=Buffer.alloc(256000);const a=await h.read(head,0,head.length,0),b=await h.read(tail,0,tail.length,Math.max(0,s.size-tail.length));return head.subarray(0,a.bytesRead).toString()+'\n'+tail.subarray(0,b.bytesRead).toString().split('\n').slice(1).join('\n');}finally{await h.close();}}
export async function discoverConfigDirs(defaultConfig, accountDirs=[], envConfig) {
 const roots=[defaultConfig,...accountDirs];
 if(envConfig&&path.isAbsolute(envConfig))roots.push(envConfig);
 // Claude Code aliases commonly keep independent histories in ~/.claude-<profile>.
 // Inspect only matching profile directories, never unrelated home folders.
 try {
   const home=path.dirname(defaultConfig);
   for(const entry of await readdir(home,{withFileTypes:true})) {
     if(entry.name.startsWith('.claude-')&&(entry.isDirectory()||entry.isSymbolicLink()))roots.push(path.join(home,entry.name));
   }
 }catch(e){if(!['ENOENT','EACCES'].includes(e.code))throw e;}
 const found=[];
 for(const root of [...new Set(roots)]) {
   try{if((await stat(path.join(root,'projects'))).isDirectory())found.push(root);}catch(e){if(!['ENOENT','EACCES','ENOTDIR'].includes(e.code))throw e;}
 }
 return found;
}
function profileLabel(configDir,defaultConfig){return configDir===defaultConfig?'Claude Code local':`Claude Code · ${path.basename(configDir).replace(/^\.claude-?/,'')||'perfil'}`;}
export class SessionBrowser {
 constructor(engine,defaultConfig,{envConfig}={}){this.engine=engine;this.defaultConfig=defaultConfig;this.envConfig=envConfig;this.catalog=new Map();this.timer=null;this.polling=false;}
 async list(){
   const roots=await discoverConfigDirs(this.defaultConfig,this.engine.state.accounts.map(a=>a.configDir),this.envConfig);const candidates=[];
   for(const configDir of roots){let projects=[];try{projects=await readdir(path.join(configDir,'projects'),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')continue;throw e;}
     for(const project of projects.filter(p=>p.isDirectory())){
       const dir=path.join(configDir,'projects',project.name);const files=await readdir(dir,{withFileTypes:true});
       for(const f of files.filter(f=>f.isFile()&&/^[a-f\d-]{36}\.jsonl$/i.test(f.name))){const file=path.join(dir,f.name);const info=await stat(file);candidates.push({file,configDir,sessionId:f.name.slice(0,-6),lastModified:info.mtimeMs,size:info.size});}
     }
   }
   const sessions=[];this.catalog.clear();
   for(const c of candidates.sort((a,b)=>b.lastModified-a.lastModified).slice(0,80)){
     try{const parsed=parseTranscript(await sample(c.file));if(!parsed.cwd)continue;const key=createHash('sha256').update(c.file).digest('hex').slice(0,24);const entry={...c,key,cwd:parsed.cwd,title:parsed.title,accountName:this.engine.state.accounts.find(a=>a.configDir===c.configDir)?.name||profileLabel(c.configDir,this.defaultConfig)};this.catalog.set(key,entry);const {file,configDir,...visible}=entry;sessions.push(visible);}catch{/* A concurrently removed transcript is skipped. */}
   }
   return sessions;
 }
 stop(){this.generation=(this.generation||0)+1;clearInterval(this.timer);this.timer=null;}
 async watch(key,{accountId}={}){
   if(this.engine.state.busy)throw new Error('Interrompa a execução atual antes de conectar outra sessão.');
   const entry=this.catalog.get(key);if(!entry)throw new Error('Atualize a lista de sessões e selecione novamente.');
   this.stop();await this.engine.connect(entry.cwd,true);
   this.engine.state.externalSession={key,title:entry.title,lastModified:entry.lastModified,accountName:entry.accountName};
   this.engine.state.sessionId=entry.sessionId;
   const account=this.engine.state.accounts.find(a=>a.configDir===entry.configDir||(accountId&&a.id===accountId));
   this.engine.state.sessionConfigDir=entry.configDir;
   this.engine.state.sessionAccountId=account?.id||null;
   if(account)this.engine.state.activeAccountId=account.id;
   this.entry=entry;this.engine.state.runtimeCatalog=null;const catalog=await this.engine.getInventory();this.knownSkills=new Set(catalog.resources.filter(r=>r.kind==='skill'&&!r.shadowed).map(r=>r.name));await this.poll(true);this.engine.event('Conectado em modo de acompanhamento. O terminal continua no controle.');
   this.timer=setInterval(()=>{void this.poll().catch(e=>this.engine.event(e.message,'warning'));},1500);this.timer.unref?.();await this.engine.save();return account;
 }
 async poll(force=false){
   if(this.polling||!this.entry||!this.engine.state.externalSession)return;this.polling=true;const entry=this.entry,generation=this.generation;
   try{
     const info=await stat(entry.file);if(!force&&info.mtimeMs===this.lastModified)return;
     if(info.size>80*1024*1024)throw new Error('Transcript acima de 80 MB. Acompanhamento pausado para evitar sobrecarga.');
     const parsed=parseTranscript(await readFile(entry.file,'utf8'),{knownSkills:this.knownSkills});
     if(generation!==this.generation||entry!==this.entry||this.engine.state.externalSession?.key!==entry.key)return;
     this.engine.state.messages=parsed.messages;this.engine.state.agents=parsed.agents;this.engine.state.tokens=parsed.tokens;this.engine.state.runtimeCatalog=parsed.runtimeCatalog;this.engine.state.skillUses=parsed.skillUses;this.engine.state.instructionsLoaded=parsed.instructionsLoaded;this.engine.state.sessionMetrics=parsed.sessionMetrics;
     this.engine.state.externalSession.lastModified=info.mtimeMs;this.lastModified=info.mtimeMs;
     if(!force)this.engine.event('Nova atividade recebida da sessão externa.','tool');else this.engine.publish();
   }catch(e){this.stop();throw e;}finally{this.polling=false;}
 }
 async takeOver(){
   if(!this.engine.state.externalSession)throw new Error('Nenhuma sessão externa conectada.');
   if(this.engine.state.busy)throw new Error('Uma execução já está em andamento.');
   await this.poll(true);this.stop();this.engine.state.externalSession=null;this.engine.event('Conversa retomada neste aplicativo. O próximo envio usará o histórico da sessão.');await this.engine.save();
 }
}
