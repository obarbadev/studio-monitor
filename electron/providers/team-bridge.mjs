import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile,rm,lstat,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
const tools=[{name:'studio_spawn_agent',description:'Create a bounded project subagent using Claude, Codex or Antigravity (provider ID: gemini). Omit provider/model to use the role routing defaults. Returns an ID; wait before claiming completion.',inputSchema:{type:'object',properties:{role:{type:'string'},task:{type:'string',maxLength:30000},provider:{enum:['claude','codex','gemini']},model:{type:'string',maxLength:128},effort:{enum:['default','low','medium','high','xhigh','max']}},required:['task'],additionalProperties:false}},{name:'studio_agents',description:'List Studio tasks, their provider and observed state/results.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'studio_wait_agents',description:'Wait up to 20 seconds for named Studio tasks, returning their current state and results.',inputSchema:{type:'object',properties:{ids:{type:'array',items:{type:'string'},minItems:1,maxItems:24}},required:['ids'],additionalProperties:false}}];
export const teamInstructions=`Use the Studio MCP tools to delegate project roles across providers: studio_spawn_agent(role, task, provider?, model?, effort?), studio_agents, studio_wait_agents(ids). Omit provider/model to follow the role defaults. Check existing tasks before spawning replacements. Wait and inspect task results before claiming completion. Keep tasks bounded and avoid overlapping writes. Never claim a cross-provider session ID was resumed; only task context is transferred. If a required provider is unavailable, report the limitation.`;
export class TeamBridge{
 constructor(engine){this.engine=engine;this.token=randomBytes(32).toString('hex');this.server=null;this.directory=null;}
 async start(){
  const root=this.engine.state.project.path;this.server=createServer(async(req,res)=>{
   const expected=Buffer.from('Bearer '+this.token),actual=Buffer.from(String(req.headers.authorization||''));
   if(req.url!=='/mcp'||req.headers.origin||actual.length!==expected.length||!timingSafeEqual(actual,expected)||this.engine.state.project?.path!==root){res.writeHead(403).end();return;}
   if(req.method!=='POST'){res.writeHead(405,{'Allow':'POST'}).end();return;}
   let requestId=null,toolCall=false;try{const chunks=[];let size=0;for await(const chunk of req){chunks.push(chunk);size+=chunk.length;if(size>65536){res.writeHead(413).end();return;}}const message=JSON.parse(Buffer.concat(chunks).toString());requestId=message.id;toolCall=message.method==='tools/call';if(message.id===undefined){res.writeHead(202).end();return;}let result;
    if(message.method==='initialize')result={protocolVersion:message.params?.protocolVersion||'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'studio-router',version:'1.0.0'}};
    else if(message.method==='ping')result={};else if(message.method==='tools/list')result={tools};
    else if(message.method==='tools/call'){
     if(!this.engine.routed)throw new Error('A execução principal já foi encerrada.');const {name,arguments:args={}}=message.params||{};let data;
     if(name==='studio_spawn_agent')data=await this.engine.team.spawn(args);else if(name==='studio_agents')data=this.engine.team.list();else if(name==='studio_wait_agents')data=await this.engine.team.wait(args.ids);else throw new Error('Ferramenta desconhecida.');result={content:[{type:'text',text:JSON.stringify(data)}]};
    }else{res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Método desconhecido.'}}));return;}
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
   }catch(e){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({jsonrpc:'2.0',id:requestId,...(toolCall?{result:{isError:true,content:[{type:'text',text:e.message}]}}:{error:{code:-32603,message:e.message}})}));}
  });
  await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve);});this.url=`http://127.0.0.1:${this.server.address().port}/mcp`;return this;
 }
 get config(){return {type:'http',url:this.url,headers:{Authorization:'Bearer '+this.token}};}
 codexArgs(){return ['-c',`mcp_servers.studio_router.url=${JSON.stringify(this.url)}`,'-c',`mcp_servers.studio_router.http_headers.Authorization=${JSON.stringify('Bearer '+this.token)}`,'-c','mcp_servers.studio_router.default_tools_approval_mode="approve"'];}
 async agyArgs(){
  // AGY discovers workspace MCP config; settings.json does not load MCP servers.
  const root=this.engine.state.project.path,directory=path.join(root,'.agents'),file=path.join(directory,'mcp_config.json');
  for(const entry of [directory,file]){try{if((await lstat(entry)).isSymbolicLink())throw new Error('A conexão AGY não altera configuração MCP por link simbólico.');}catch(e){if(e.code!=='ENOENT')throw e;}}
  await mkdir(directory,{recursive:true});
  let original=null;try{original=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  let config;try{config=original===null?{}:JSON.parse(original);}catch{throw new Error('O arquivo .agents/mcp_config.json precisa ser JSON válido para conectar a equipe AGY.');}
  if(!config||typeof config!=='object'||Array.isArray(config)||config.mcpServers&&(typeof config.mcpServers!=='object'||Array.isArray(config.mcpServers)))throw new Error('Configuração MCP do AGY inválida.');
  const name='studio_router_'+this.token.slice(0,12),entry={serverUrl:this.url,headers:{Authorization:'Bearer '+this.token}};
  const content=JSON.stringify({...config,mcpServers:{...config.mcpServers,[name]:entry}},null,2)+'\n';
  const temporary=file+'.'+this.token.slice(0,12)+'.tmp';
  try{await writeFile(temporary,content,{mode:0o600,flag:'wx'});let current=null;try{current=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}if(current!==original)throw new Error('Configuração MCP alterada durante a conexão. Tente novamente.');await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
  this.agyConfig={file,name,entry,original,content};return [];
 }
 async removeAgyConfig(){
  if(!this.agyConfig)return;const {file,name,entry,original,content}=this.agyConfig;
  if((await lstat(file)).isSymbolicLink())throw new Error('A configuração MCP foi substituída por um link; revise a entrada temporária do Studio.');
  const current=await readFile(file,'utf8');
  if(current===content){if(original===null)await unlink(file);else await writeFile(file,original,{mode:0o600});}
  else{const config=JSON.parse(current);if(JSON.stringify(config.mcpServers?.[name])===JSON.stringify(entry)){delete config.mcpServers[name];await writeFile(file,JSON.stringify(config,null,2)+'\n',{mode:0o600});}}
  this.agyConfig=null;
 }
 async close(){if(this.server){this.server.closeAllConnections?.();await new Promise(resolve=>this.server.close(resolve));this.server=null;}if(this.directory)await rm(this.directory,{recursive:true,force:true});await this.removeAgyConfig();}
}
