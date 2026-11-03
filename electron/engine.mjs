import {sendRouted,validateRouting,limitFailure} from './providers/routing.mjs';
import {StudioTeam} from './providers/team.mjs';
import {TeamBridge,teamInstructions} from './providers/team-bridge.mjs';
import {nativeProcess} from './providers/process.mjs';
import {prepareProviderProject} from './providers/project.mjs';
import {sendNativeTurn} from './providers/turn.mjs';
import {ensureStudioStatusline,StudioTelemetry} from './studio-telemetry.mjs';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, copyFile, cp, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import {StudioInventory} from './inventory.mjs';
import {projectMetadata} from './project.mjs';


export function engineFromYaml(yaml) {
  const inline=yaml.match(/^engine:[ \t]*([^\r\n]*)/m)?.[1]?.trim();
  const nested=yaml.match(/^engine:[ \t]*\r?\n[ \t]+(?:name|type):[ \t]*([^\r\n]+)/m)?.[1]?.trim();
  return (inline||nested||'Não definido').replace(/^["']|["']$/g,'');
}

export function cleanEnvironment(base, configDir) {
  const env = { ...base, CLAUDE_CONFIG_DIR: configDir };
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_OAUTH_TOKEN|CLAUDECODE$|CLAUDE_CODE_USE_|CLAUDE_CODE_SESSION_ACCESS_TOKEN|CLAUDE_CONFIG_DIR$)/.test(key)) delete env[key];
  }
  env.CLAUDE_CONFIG_DIR = configDir;
  env.PATH = [base.PATH, path.join(base.HOME || '', '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(path.delimiter);
  return env;
}
export function isLimit(message) {
  return message.type === 'rate_limit_event' && message.rate_limit_info?.status === 'rejected'
    || message.type === 'assistant' && message.error === 'rate_limit'
    || message.type === 'result' && message.is_error && /rate.?limit|usage limit|limit reached|out of extra usage/i.test(JSON.stringify(message.errors || message.result || ''));
}
export function availableAccount(accounts, tried = new Set(), now = Date.now()) {
  return accounts.find(a => a.enabled && a.loggedIn && !tried.has(a.id) && (!a.cooldownUntil || a.cooldownUntil <= now));
}
export async function transferSession(from, to, sessionId) {
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new Error('Sessão inválida.');
  const projects = path.join(from, 'projects');
  for (const dir of await readdir(projects, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const source = path.join(projects, dir.name, `${sessionId}.jsonl`);
    try { await readFile(source); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    const destination = path.join(to, 'projects', dir.name);
    await mkdir(destination, {recursive:true, mode:0o700});
    await copyFile(source, path.join(destination, `${sessionId}.jsonl`));
    try { await cp(path.join(projects, dir.name, sessionId), path.join(destination, sessionId), {recursive:true}); } catch(e) { if(e.code !== 'ENOENT') throw e; }
    return;
  }
  throw new Error('O histórico da sessão não foi encontrado. A troca foi interrompida para preservar o contexto.');
}
export class StudioEngine extends EventEmitter {
  constructor({ directory, query, cliPath, env = process.env, nativeRunner=nativeProcess, prepareNative=prepareProviderProject, enableTeamBridge=false,telemetryProjectStatus=true }) {
    super();this.enableTeamBridge=enableTeamBridge;this.team=new StudioTeam(this);this.teamBridge=null;this.routed=false;this.nativeRunner=nativeRunner;this.prepareNative=prepareNative; this.directory=directory; this.query=query; this.cliPath=cliPath; this.baseEnv=env;
    this.state={routingProfiles:{},activeProvider:null,provider:'claude',providers:{},providerPreferences:{claude:{model:'sonnet',effort:'default'},codex:{model:'',effort:'default'},gemini:{model:'',effort:'default'}},conversations:{}, project:null, accounts:[], activeAccountId:null, autoFallback:true, model:'sonnet', effort:'default', theme:'light', messages:[], agents:[], events:[], busy:false, sessionId:null, sessionAccountId:null, tokens:0, permission:null };
    this.inventory=new StudioInventory();this.telemetry=new StudioTelemetry(e=>this.event(`Não foi possível atualizar a telemetria do Studio: ${e.message}`,'warning'),{projectStatus:telemetryProjectStatus});
    this.pending = null; this.current = null; this.controller=null;
  }
  async load() {
    await mkdir(this.directory,{recursive:true,mode:0o700});
    try { this.state={...this.state,...JSON.parse(await readFile(path.join(this.directory,'studio.json'),'utf8')),busy:false,stopping:false,permission:null}; } catch(e) { if(e.code !== 'ENOENT') throw e; }
    if(!['claude','codex','gemini'].includes(this.state.provider))this.state.provider='claude';this.state.providers??={};
    if(this.state.externalSession){Object.assign(this.state,{sessionId:null,sessionAccountId:null,messages:[],agents:[]});}
    this.state.externalSession=null;this.state.sessionProvider=this.state.sessionId?(this.state.sessionProvider||this.state.provider):null;
    if(this.state.runStatus==='running')this.state.runStatus='interrupted';this.state.mainTool=null;
    this.state.accounts.forEach(a=>{a.loggingIn=false;a.usageLoading=false;});
    if(this.state.project){Object.assign(this.state.project,await projectMetadata(this.state.project.path));try{await ensureStudioStatusline(this.state.project.path);}catch(e){this.state.events.push({id:randomUUID(),kind:'warning',text:`Statusline do Studio: ${e.message}`,time:Date.now()});}}
    this.state.agents=this.state.agents.map(a=>a.status==='running'?{...a,status:'interrupted',finishedAt:Date.now()-10000}:a);
    this.telemetry.update(this.state);await this.telemetry.flush();return this.state;
  }
  async getInventory() {
    const account=this.state.accounts.find(a=>a.id===this.state.activeAccountId);
    const configDir=this.state.provider==='claude'?this.state.sessionConfigDir||account?.configDir:undefined;
    const catalog=await this.inventory.scan({projectPath:this.state.project?.path,configDir,plugins:this.state.runtimeCatalog?.plugins||[]});
    return {...catalog,runtime:this.state.runtimeCatalog||null,skillUses:this.state.skillUses||[],instructionsLoaded:this.state.instructionsLoaded||[]};
  }
  recordSkill(name,agentId=null,source='tool') {
    if(typeof name!=='string'||!name)return;
    this.state.skillUses=[...(this.state.skillUses||[]),{name,agentId,time:Date.now(),source}].slice(-500);
  }
  publish() { this.telemetry.update(this.state);this.emit('state', structuredClone(this.state)); }
  async save() {
    const snapshot=JSON.stringify({...this.state,busy:false,permission:null},null,2);
    this.saves=(this.saves||Promise.resolve()).catch(()=>{}).then(()=>writeFile(path.join(this.directory,'studio.json'),snapshot,{mode:0o600}));
    await this.saves;await this.telemetry.flush();
  }
  event(text,kind='info') { this.state.events.push({id:randomUUID(),text,kind,time:Date.now()}); this.state.events=this.state.events.slice(-300); this.publish(); }
  conversationKey(){return this.state.project?this.state.project.path+'|'+this.state.provider:null;}
  archiveConversation(){const key=this.conversationKey();if(!key)return;this.state.conversations??={};const fields=['messages','agents','events','sessionId','sessionAccountId','sessionConfigDir','tokens','runtimeCatalog','skillUses','instructionsLoaded','sessionMetrics','sessionProvider','nativeContextHash','activeProvider','sessionRuntime','legacyNativeSessions'];this.state.conversations[key]=structuredClone(Object.fromEntries(fields.map(k=>[k,this.state[k]??null])));}
  restoreConversation(){const saved=this.state.conversations?.[this.conversationKey()];if(saved)Object.assign(this.state,structuredClone(saved));}
  switchProvider(provider){
    if(!['claude','codex','gemini'].includes(provider))throw new Error('Executor inválido.');if(provider===this.state.provider)return;
    if(this.team.running)throw new Error('Interrompa a equipe antes de trocar a conversa principal.');
    if(this.state.externalSession)throw new Error('Crie uma nova conversa antes de trocar o executor de uma sessão em acompanhamento.');
    this.archiveConversation();this.state.providerPreferences??={};this.state.providerPreferences[this.state.provider]={model:this.state.model,effort:this.state.effort||'default'};
    this.state.provider=provider;const preference=this.state.providerPreferences[provider]||{model:provider==='claude'?'sonnet':'',effort:'default'};
    Object.assign(this.state,{...preference,activeProvider:null,messages:[],agents:[],events:[],sessionId:null,sessionProvider:null,sessionRuntime:null,sessionAccountId:null,sessionConfigDir:null,tokens:0,runtimeCatalog:null,skillUses:[],instructionsLoaded:[],sessionMetrics:null,runStatus:'idle',mainTool:null,nativeContextHash:null});this.restoreConversation();
  }
  async connect(projectPath, allowGeneric=true) {
    if(this.state.busy||this.team.running) throw new Error('Interrompa a equipe antes de trocar de projeto.');
    const root=await realpath(projectPath);if(!(await stat(root)).isDirectory())throw new Error('Selecione uma pasta de projeto.');
    let files=[];try{files=await readdir(path.join(root,'.claude','agents'));}catch(e){if(!allowGeneric)throw e;}
    const definitions=[];
    for(const file of files.filter(f=>f.endsWith('.md'))) {
      const text=await readFile(path.join(root,'.claude','agents',file),'utf8');
      definitions.push({name:text.match(/^name:\s*(.+)$/m)?.[1]?.replace(/["']/g,'')||file.slice(0,-3),model:text.match(/^model:\s*(.+)$/m)?.[1]||'inherit'});
    }
    try{await readFile(path.join(root,'CLAUDE.md'));}catch(e){if(!allowGeneric)throw e;}
    const metadata=await projectMetadata(root);
    const changed=root!==this.state.project?.path;if(changed)this.archiveConversation();
    if(changed) Object.assign(this.state,{activeProvider:null,externalSession:null,messages:[],agents:[],events:[],sessionId:null,sessionProvider:null,sessionRuntime:null,nativeContextHash:null,sessionAccountId:null,sessionConfigDir:null,tokens:0,runStatus:'idle',mainTool:null,runtimeCatalog:null,skillUses:[],instructionsLoaded:[],sessionMetrics:null});
    this.state.project={path:root,name:path.basename(root),definitions,...metadata};if(changed)this.restoreConversation();
    try{await ensureStudioStatusline(root);}catch(e){this.event(`Statusline do Studio: ${e.message}`,'warning');}
    this.event('Projeto conectado. Configurações, skills e hooks originais serão carregados.'); await this.save();
  }
  async addAccount(name) {
    if(this.state.busy) throw new Error('Aguarde o fim da execução.');
    if(typeof name !== 'string'|| !name.trim()||name.length>80) throw new Error('Informe um nome de até 80 caracteres.');
    const id=randomUUID(); const configDir=path.join(this.directory,'profiles',id);
    await mkdir(configDir,{recursive:true,mode:0o700});
    const account={id,name:name.trim(),configDir,enabled:true,loggedIn:false,usage:null};
    this.state.accounts.push(account); if(!this.state.activeAccountId)this.state.activeAccountId=id;
    this.publish(); await this.save(); return account;
  }
  async editAccount({id,name}) {
    if(this.state.busy)throw new Error('Aguarde o fim da execução antes de editar contas.');
    const account=this.state.accounts.find(a=>a.id===id);
    if(!account)throw new Error('Conta não encontrada.');
    if(typeof name!=='string'||!name.trim()||name.length>80)throw new Error('Informe um nome de até 80 caracteres.');
    account.name=name.trim();this.publish();await this.save();return account;
  }
  async removeAccount(id) {
    if(this.state.busy)throw new Error('Aguarde o fim da execução antes de remover contas.');
    const account=this.state.accounts.find(a=>a.id===id);
    if(!account)throw new Error('Conta não encontrada.');
    if(account.loggingIn)throw new Error('Cancele o login antes de remover esta conta.');
    if(this.state.sessionAccountId===id && !this.state.sessionConfigDir)this.state.sessionConfigDir=account.configDir;
    this.state.accounts=this.state.accounts.filter(a=>a.id!==id);
    if(this.state.activeAccountId===id)this.state.activeAccountId=this.state.accounts.find(a=>a.enabled&&a.loggedIn)?.id||this.state.accounts[0]?.id||null;
    if(this.state.sessionAccountId===id)this.state.sessionAccountId=null;
    // Removing a registration never logs out the CLI or deletes its credentials/transcripts.
    this.publish();await this.save();
  }
  async configure({autoFallback,model,activeAccountId,accountId,enabled,theme,effort,projectPhase,provider,routingProfile,providerPreference}) {
    if(this.state.busy&&((theme===undefined&&projectPhase===undefined&&routingProfile===undefined)||[autoFallback,model,activeAccountId,accountId,enabled,effort,provider,providerPreference].some(v=>v!==undefined))) throw new Error('Aguarde ou interrompa a execução antes de alterar contas.');
    if(providerPreference!==undefined){const p=providerPreference?.provider,m=providerPreference?.model,e=providerPreference?.effort;if(!['claude','codex','gemini'].includes(p)||typeof m!=='string'||(p==='claude'?!['sonnet','opus','haiku'].includes(m):m!==''&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(m))||!['default','low','medium','high','xhigh','max'].includes(e))throw new Error('Preferência de modelo ou esforço inválida.');this.state.providerPreferences??={};this.state.providerPreferences[p]={model:m,effort:e};if(p===this.state.provider){this.state.model=m;this.state.effort=e;}}
    if(routingProfile!==undefined){if(!this.state.project)throw new Error('Conecte um projeto.');const value=validateRouting(routingProfile);this.state.routingProfiles??={};this.state.routingProfiles[this.state.project.path]=value;}
    if(provider!==undefined)this.switchProvider(provider);
    if(projectPhase!==undefined){if(!this.state.project)throw new Error('Conecte um projeto.');if(projectPhase!==null&&(typeof projectPhase!=='string'||!projectPhase.trim()||projectPhase.length>160))throw new Error('Informe uma etapa de até 160 caracteres.');this.state.projectPhases??={};if(projectPhase===null)delete this.state.projectPhases[this.state.project.path];else this.state.projectPhases[this.state.project.path]={name:projectPhase.trim(),updatedAt:Date.now()};}
    if(effort!==undefined){if(!['default','low','medium','high','xhigh','max'].includes(effort))throw new Error('Nível de esforço inválido.');this.state.effort=effort;}
    if(['light','dark'].includes(theme))this.state.theme=theme;
    if(typeof autoFallback==='boolean')this.state.autoFallback=autoFallback;
    if(model!==undefined){if(typeof model!=='string'||(this.state.provider==='claude'?!['sonnet','opus','haiku'].includes(model):model!==''&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)))throw new Error('Modelo inválido.');this.state.model=model;}
    this.state.providerPreferences??={};this.state.providerPreferences[this.state.provider]={model:this.state.model,effort:this.state.effort||'default'};
    if(activeAccountId && this.state.accounts.some(a=>a.id===activeAccountId))this.state.activeAccountId=activeAccountId;
    if(accountId && typeof enabled==='boolean'){const a=this.state.accounts.find(a=>a.id===accountId);if(a)a.enabled=enabled;}
    this.publish();await this.save();
  }
  resolvePermission({id,allow,answers}) {
    if(!this.pending||this.state.permission?.id!==id)throw new Error('Esta solicitação já foi encerrada.');
    const {resolve,input}=this.pending;
    if(answers && (typeof answers !== 'object'||Object.values(answers).some(a=>typeof a!=='string')))throw new Error('Resposta inválida.');
    this.pending=null; this.state.permission=null;this.publish();
    resolve(allow?{behavior:'allow',updatedInput:{...input,...(answers?{answers}:{})}}:{behavior:'deny',message:'O usuário recusou esta ação.'});
  }
  requestPermission(...args) {
    const task=(this.permissionChain||Promise.resolve()).then(()=>this.showPermission(...args));
    this.permissionChain=task.catch(()=>{});
    return task;
  }
  async showPermission(tool,input,{signal,agentID}) {
    if(signal.aborted)return {behavior:'deny',message:'Execução interrompida.'};
    return new Promise(resolve=>{
      const id=randomUUID();
      const finish=(result)=>{signal.removeEventListener('abort',abort);resolve(result);};
      const abort=()=>{if(this.state.permission?.id===id){this.pending=null;this.state.permission=null;this.publish();}finish({behavior:'deny',message:'Execução interrompida.'});};
      this.pending={resolve:finish,input};this.state.permission={id,tool,input,agentId:agentID||null};signal.addEventListener('abort',abort,{once:true});this.publish();
    });
  }
  async startTeamBridge(){this.turnId=randomUUID();this.teamBridge=await new TeamBridge(this).start();}
  async closeTeamBridge(){const bridge=this.teamBridge;this.teamBridge=null;if(bridge)await bridge.close();}
  stop() { if(this.state.stopping)return;if(this.state.busy||this.team.running){this.state.stopping=true;this.event('Interrompendo a execução. Aguardando o encerramento dos processos.');}if(this.pending){this.pending.resolve({behavior:'deny',message:'Execução interrompida pelo usuário.'});this.pending=null;this.state.permission=null;}this.routeController?.abort();this.team.stopAll();this.controller?.abort(); if(this.current) {try{this.current.close();}catch{}} }
  async newSession() {
    if(this.state.busy||this.team.running)throw new Error('Interrompa a equipe antes de criar outra sessão.');
    Object.assign(this.state,{activeProvider:null,externalSession:null,messages:[],agents:[],sessionId:null,sessionProvider:null,sessionRuntime:null,nativeContextHash:null,sessionAccountId:null,sessionConfigDir:null,tokens:0,runStatus:'idle',mainTool:null,runtimeCatalog:null,skillUses:[],instructionsLoaded:[],sessionMetrics:null});this.event('Nova conversa iniciada.');this.archiveConversation();await this.save();
  }
  async send(text){return sendRouted(this,text);}
  async sendDirect(text,{continuation=false,routed=false}={}) {
    if(this.state.busy&&!routed)throw new Error('Aguarde a resposta atual.');
    if(!this.state.project)throw new Error('Conecte a pasta do seu projeto primeiro.');
    if(this.state.externalSession)throw new Error('Esta sessão está em acompanhamento. Retome-a neste aplicativo antes de enviar mensagens.');
    if(typeof text!=='string'||!text.trim()||text.length>100000)throw new Error('Mensagem inválida.');
    if(this.state.provider!=='claude')return sendNativeTurn(this,text,{continuation});
    let account=this.state.accounts.find(a=>a.id===this.state.activeAccountId);
    if(!account?.loggedIn || !account.enabled || account.cooldownUntil>Date.now())account=availableAccount(this.state.accounts);
    if(!account)throw new Error('Conecte uma conta disponível na aba Contas Claude.');
    if(!continuation)this.state.messages.push({id:randomUUID(),role:'user',text:text.trim(),time:Date.now()});
    this.state.runStatus='running';this.state.mainTool=null;this.state.busy=true;this.controller=new AbortController();this.publish();
    const tried=new Set();let prompt=text.trim();let slashRecorded=false;if(/^\//.test(prompt))this.event(`Executando comando ${prompt.split(/\s/)[0]}.`);
    try {
      while(account) {
        tried.add(account.id);
        const previous=this.state.accounts.find(a=>a.id===this.state.sessionAccountId);
        const sourceConfig=this.state.sessionConfigDir||previous?.configDir;
        if(this.state.sessionId&&sourceConfig&&sourceConfig!==account.configDir)await transferSession(sourceConfig,account.configDir,this.state.sessionId);
        this.state.sessionConfigDir=account.configDir;
        this.state.activeAccountId=account.id;this.state.sessionAccountId=account.id;
        this.event(`Executando com ${account.name}.`);
        let limited=false,limitReset=null,failed=null;
        const reply={id:randomUUID(),role:'assistant',text:'',time:Date.now(),account:account.name};this.state.messages.push(reply);
        const hook=async input=>{
          if(input.hook_event_name==='SubagentStart') {
            this.state.agents.push({id:input.agent_id,name:input.agent_type,status:'running',startedAt:Date.now(),sessionId:input.session_id,provider:'claude'});
            this.event(`${input.agent_type} entrou no estúdio.`,'spawn');
          } else if(input.hook_event_name==='SubagentStop') {
            const agent=this.state.agents.find(a=>a.id===input.agent_id);
            if(agent)Object.assign(agent,{status:'completed',activity:'done',finishedAt:Date.now(),summary:input.last_assistant_message});
            this.event(`${input.agent_type} concluiu sua tarefa.`,'done');
          } else if(input.hook_event_name==='InstructionsLoaded') {
            this.state.instructionsLoaded=[...(this.state.instructionsLoaded||[]),{path:input.file_path,reason:input.load_reason,agentId:input.agent_id||null,time:Date.now()}].slice(-500);
          } else if(input.hook_event_name==='PreToolUse') {
            if(input.tool_name==='Skill')this.recordSkill(input.tool_input?.skill,input.agent_id||null);
            const agent=this.state.agents.find(a=>a.id===input.agent_id);if(agent){agent.tool=input.tool_name;agent.activity='tool';agent.updatedAt=Date.now();}else if(!input.agent_id)this.state.mainTool=input.tool_name;
            if(['Agent','Task'].includes(input.tool_name))this.event(`${input.agent_type||'Agente principal'} → ${input.tool_input?.subagent_type||'Subagente'}: ${String(input.tool_input?.description||input.tool_input?.prompt||'Tarefa delegada').slice(0,2000)}`,'delegation');
            this.event(`${input.agent_type||'Agente principal'} · ${input.tool_name}`,'tool');
          } else if(['PostToolUse','PostToolUseFailure'].includes(input.hook_event_name)){
            const agent=this.state.agents.find(a=>a.id===input.agent_id);const failed=input.hook_event_name==='PostToolUseFailure';
            if(agent){agent.activity=failed?'tool-error':'thinking';agent.updatedAt=Date.now();}else if(!input.agent_id)this.state.mainTool=null;
            if(failed)this.event(`${input.agent_type||'Agente principal'} · ${input.tool_name}: ${String(input.error||'Falha na ferramenta').slice(0,2000)}`,'tool-error');
          }
          this.publish();return {};
        };
        const executionEnv=cleanEnvironment(this.baseEnv,account.configDir);if(this.state.effort&&this.state.effort!=='default')executionEnv.CLAUDE_CODE_EFFORT_LEVEL=this.state.effort;
        const options={...(this.state.effort&&this.state.effort!=='default'?{effort:this.state.effort}:{}),cwd:this.state.project.path,env:executionEnv,pathToClaudeCodeExecutable:this.cliPath,
          settingSources:['user','project','local'],systemPrompt:{type:'preset',preset:'claude_code',...(this.teamBridge?{append:teamInstructions}:{})},...(this.teamBridge?{mcpServers:{studio_router:this.teamBridge.config}}:{}),model:this.state.model,
          permissionMode:'bypassPermissions',allowDangerouslySkipPermissions:true,canUseTool:(...args)=>this.requestPermission(...args),includePartialMessages:true,
          abortController:this.controller,...(this.state.sessionId?{resume:this.state.sessionId}:{}),
          hooks:Object.fromEntries(['SubagentStart','SubagentStop','PreToolUse','PostToolUse','PostToolUseFailure','InstructionsLoaded'].map(e=>[e,[{hooks:[hook]}]]))};
        this.current=this.query({prompt,options});
        try {
          for await(const m of this.current) {
            if(m.type==='system' && m.subtype==='init') {this.state.sessionId=m.session_id;this.state.sessionProvider='claude';this.state.sessionMetrics={...this.state.sessionMetrics,...(m.model&&m.model!==this.state.sessionMetrics?.model?{contextWindow:undefined,lastInputTokens:undefined,lastOutputTokens:undefined}:{}),model:m.model||null,appliedEffort:m.effort||null,requestedEffort:this.state.effort||'default',updatedAt:Date.now()};const invoked=text.trim().match(/^\/([\w:.-]+)(?:\s|$)/)?.[1];if(!slashRecorded&&invoked&&(m.skills||[]).some(s=>s.replace(/^\//,'')===invoked)){this.recordSkill(invoked,null,'slash-command');slashRecorded=true;}this.state.runtimeCatalog={skills:m.skills||[],agents:m.agents||[],commands:m.slash_commands||[],plugins:m.plugins||[],updatedAt:Date.now()};this.publish();void this.save();}
            if(m.type==='system'&&['local_command_output','informational'].includes(m.subtype)&&typeof m.content==='string'){
              reply.text+=(reply.text?'\n\n':'')+m.content;
              if(m.subtype==='informational')this.event(m.content,m.level==='warning'?'warning':'info');
              this.publish();
            }
            if(m.type==='system'&&m.subtype==='commands_changed'&&this.state.runtimeCatalog){this.state.runtimeCatalog.commands=m.commands.map(c=>c.name);this.state.runtimeCatalog.updatedAt=Date.now();this.publish();}
            if(m.type==='stream_event' && !m.parent_tool_use_id && m.event?.delta?.type==='text_delta') {reply.text+=m.event.delta.text;this.publish();}
            if(m.type==='assistant' && !m.parent_tool_use_id) {
              const text=(m.message?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
              if(text && !reply.text.endsWith(text))reply.text+=(reply.text?'\n\n':'')+text;
              const u=m.message?.usage;if(u){this.state.tokens+=(u.input_tokens||0)+(u.output_tokens||0);this.state.sessionMetrics={...this.state.sessionMetrics,model:m.message.model||this.state.sessionMetrics?.model,lastInputTokens:(u.input_tokens||0)+(u.cache_read_input_tokens||0)+(u.cache_creation_input_tokens||0),lastOutputTokens:u.output_tokens||0,updatedAt:Date.now()};}
              this.publish();
            }
            if(m.type==='rate_limit_event'||m.type==='result')this.emit('usage-refresh',account.id);
            if(isLimit(m)) {limited=true;limitReset=m.rate_limit_info?.resetsAt;}
            if(m.type==='result') {
              const modelUsage=m.modelUsage?.[this.state.sessionMetrics?.model];
              if(Number.isFinite(modelUsage?.contextWindow)&&modelUsage.contextWindow>0)this.state.sessionMetrics={...this.state.sessionMetrics,contextWindow:modelUsage.contextWindow};
              if(m.session_id)this.state.sessionId=m.session_id;
              this.state.sessionMetrics={...this.state.sessionMetrics,costUsd:Number.isFinite(m.total_cost_usd)?m.total_cost_usd:this.state.sessionMetrics?.costUsd,updatedAt:Date.now()};
              if(!reply.text && m.result)reply.text=m.result;
              if(m.is_error&&!limited)failed=(m.errors||[m.result||'O Claude Code não conseguiu concluir a execução.']).join('\n');
            }
          }
        }catch(e){if(e.status===429||limitFailure(e.message))limited=true;else if(!limited)throw e;}
        finally{this.current=null;}
        if(this.controller.signal.aborted)break;
        if(failed)throw new Error(failed);
        if(!limited)break;
        account.cooldownUntil=limitReset?limitReset*1000:Date.now()+5*60*1000;
        this.event(`${account.name} atingiu o limite. ${limitReset?'Aguardando a renovação da janela.':'Nova tentativa disponível em 5 minutos.'}`,'warning');
        const next=this.state.autoFallback?availableAccount(this.state.accounts,tried):null;
        if(!next){this.state.runStatus='limited';this.event('Execução pausada: nenhuma outra conta disponível.','warning');break;}
        this.state.agents.forEach(a=>{if(a.status==='running'&&!a.managed&&!a.ownerJob){a.status='interrupted';a.finishedAt=Date.now();}});
        this.event(`Fallback automático: ${account.name} → ${next.name}. Preparando retomada da sessão.`,'fallback');
        account=next;prompt='Continue a solicitação anterior a partir do ponto em que parou. Antes de executar ferramentas, confira no histórico o que já foi concluído. Não repita ações concluídas nem commits ou comandos com efeitos externos.';
        // Without a persisted session, retain the original prompt instead of claiming a resumable context.
        if(!this.state.sessionId)prompt=text.trim();
      }
    }catch(e){if(!this.controller.signal.aborted){this.state.runStatus='error';this.event(e.message,'error');}}
    finally {
      if(this.pending){this.pending.resolve({behavior:'deny',message:'Sessão encerrada.'});this.pending=null;}
      this.state.permission=null;
      const aborted=this.controller.signal.aborted;
      this.state.agents.forEach(a=>{if(a.status==='running'&&!a.managed&&!a.ownerJob){a.status=aborted?'interrupted':'stopped';a.finishedAt=Date.now();}});
      if(aborted)this.state.runStatus='interrupted';else if(this.state.runStatus==='running')this.state.runStatus='idle';
      this.state.mainTool=null;this.state.busy=!!this.routed;this.controller=null;this.current=null;
      this.state.messages=this.state.messages.filter(m=>m.role!=='assistant'||m.text);
      this.event(aborted?'Execução interrompida. O histórico foi preservado.':'Agente principal aguardando sua próxima mensagem.');
      await this.save();this.publish();
    }
  }
}
