import {limitFailure,handoffPrompt} from './routing.mjs';
import {randomUUID} from 'node:crypto';
import {providerEnvironment,PROVIDERS} from './catalog.mjs';
import {redactProviderError,nativeArguments} from './process.mjs';
import {normalizeNativeEvent} from './events.mjs';
export async function sendNativeTurn(engine,text,{continuation=false}={}){
 const state=engine.state,provider=state.provider,status=state.providers?.[provider];
 if(!status?.available||!status.binary)throw new Error(`${PROVIDERS[provider].name} não foi encontrado. Verifique a conexão.`);
 if(!status.loggedIn)throw new Error(`Conecte o login do ${PROVIDERS[provider].name} na seção Conexões.`);
 if(state.sessionId&&state.sessionProvider!==provider)throw new Error('Esta sessão pertence a outro executor. Inicie uma nova conversa.');
 state.busy=true;state.runStatus='running';state.mainTool=null;engine.controller=new AbortController();if(!continuation)state.messages.push({id:randomUUID(),role:'user',text:text.trim(),time:Date.now()});
 const reply={id:randomUUID(),role:'assistant',text:'',time:Date.now(),account:PROVIDERS[provider].name};state.messages.push(reply);engine.publish();
 let failure=null,limitWarning=null,finished=false;const parts=new Map(),tools=new Map(),activeTools=new Map();
 try{
  let request=text;
  if(provider==='gemini'&&state.sessionId&&state.sessionRuntime!=='agy'){
   state.legacyNativeSessions=[...(state.legacyNativeSessions||[]),{provider:'gemini-cli',sessionId:state.sessionId,time:Date.now()}];
   request=handoffPrompt(state,text,'Gemini CLI','Antigravity (AGY)');state.sessionId=null;state.nativeContextHash=null;
   engine.event('O histórico do Gemini CLI foi preservado. Iniciando uma sessão própria no AGY com o contexto disponível.','info');
  }
  const project=await engine.prepareNative(engine,provider,request);if(engine.controller.signal.aborted)return;
  for(const warning of project.warnings)engine.event(warning,'warning');
  if(project.usedSkill)engine.recordSkill(project.usedSkill,null,'studio-workflow');
  if(project.instructions)state.instructionsLoaded=[...(state.instructionsLoaded||[]),{path:state.project.path+'/'+project.instructions,agentId:null,reason:'studio-provider-context',time:Date.now()}].slice(-500);
  state.runtimeCatalog={source:'studio-adapter',skills:project.skills,agents:project.roles.map(r=>r.name),commands:project.skills,plugins:[],updatedAt:Date.now()};
  engine.event(`Executando com ${PROVIDERS[provider].name}.`);
  const options={cwd:state.project.path,model:state.model,effort:state.effort||'default',sessionId:state.sessionId};
  const env=providerEnvironment(provider,engine.baseEnv);
  const args=nativeArguments(provider,options);if(engine.teamBridge&&provider==='codex')args.splice(args.length-1,0,...engine.teamBridge.codexArgs());
  if(engine.teamBridge&&provider==='gemini')args.push(...await engine.teamBridge.agyArgs());
  engine.current=engine.nativeRunner({binary:status.binary,args,input:provider==='gemini'?JSON.stringify({event:'user',message:{content:project.prompt}})+'\n':project.prompt,cwd:state.project.path,env,signal:engine.controller.signal});
  for await(const row of engine.current.stream){
   for(const event of normalizeNativeEvent(provider,row,{roles:project.roles,tools})){
    if(event.type==='session'){
     if(typeof event.id!=='string'||!/^[\w-]{1,128}$/.test(event.id))throw new Error('O executor informou uma sessão inválida.');
     state.sessionId=event.id;state.sessionProvider=provider;if(provider==='gemini')state.sessionRuntime='agy';state.sessionMetrics={...state.sessionMetrics,model:event.model||state.sessionMetrics?.model||state.model||'Padrão do executor',provider,requestedEffort:state.effort||'default',updatedAt:Date.now()};
    }else if(event.type==='text'){const previous=parts.get(event.id)||'';parts.set(event.id,event.delta?previous+event.text:event.text);reply.text=[...parts.values()].filter(Boolean).join('\n\n');}
    else if(event.type==='final-text'){reply.text=event.text;}
    else if(event.type==='tool'){if(event.status==='running')activeTools.set(event.id,event.name);else activeTools.delete(event.id);state.mainTool=[...activeTools.values()].at(-1)||null;engine.event(`${PROVIDERS[provider].name} · ${event.name}${event.status==='error'?' · falhou':''}`,event.status==='error'?'tool-error':'tool');}
    else if(event.type==='agent'){
     let agent=state.agents.find(a=>a.id===event.id);const fresh=!agent;
     if(!agent){agent={id:event.id,name:event.name,status:event.status,startedAt:Date.now(),provider};state.agents.push(agent);}
     const previous=agent.status;Object.assign(agent,{status:event.status,brief:event.brief||agent.brief,summary:event.summary||agent.summary,model:event.model||agent.model,parentId:event.parentId});
     if(event.status!=='running')agent.finishedAt=Date.now();
     if(fresh)engine.event(`${agent.name} entrou no estúdio.`,'spawn');
     if(event.status==='completed'&&(fresh||previous!=='completed'))engine.event(`${agent.name} entregou o resultado.`,'done');
    }else if(event.type==='usage'){state.tokens+=event.total;state.sessionMetrics={...state.sessionMetrics,inputTokens:event.input,outputTokens:event.output,cachedTokens:event.cached,usageScope:event.scope,provider,updatedAt:Date.now()};}
    else if(event.type==='warning'){if(limitFailure(event.message))limitWarning=event.message;engine.event(redactProviderError(event.message),'warning');}
    else if(event.type==='failure')failure=event.message;
    else if(event.type==='result')finished=true;
   }
   engine.publish();
  }
  if(!engine.controller.signal.aborted){if(failure)throw new Error(failure);if(!state.sessionId)throw new Error('O executor não informou um identificador de sessão. O histórico foi preservado.');if(!finished&&limitWarning)throw new Error(limitWarning);if(!finished)throw new Error('O executor encerrou sem confirmar a conclusão. O histórico foi preservado.');state.nativeContextHash=project.contextHash;}
 }catch(e){if(!engine.controller.signal.aborted){state.runStatus=limitFailure(failure||e.message)?'limited':'error';state.lastRunFailure={provider,kind:state.runStatus,message:redactProviderError(failure||e.message)};engine.event(redactProviderError(failure||e.message),state.runStatus==='limited'?'warning':'error');}}
 finally{
  const aborted=engine.controller.signal.aborted;engine.current?.close();engine.current=null;engine.controller=null;state.busy=!!engine.routed;state.mainTool=null;state.permission=null;
  for(const agent of state.agents)if(agent.status==='running'&&!agent.managed&&!agent.ownerJob){agent.status=aborted?'interrupted':'stopped';agent.finishedAt=Date.now();}
  state.runStatus=aborted?'interrupted':['error','limited'].includes(state.runStatus)?state.runStatus:'idle';state.messages=state.messages.filter(m=>m.role!=='assistant'||m.text);
  engine.event(aborted?'Execução interrompida. O histórico foi preservado.':state.runStatus==='error'?'Execução encerrada com erro. Consulte a atividade.':'Agente principal aguardando sua próxima mensagem.');await engine.save();engine.publish();
 }
}
