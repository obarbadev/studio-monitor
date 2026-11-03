import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {routingProfile,providerReady,PROVIDER_ORDER} from './routing.mjs';
const modelValid=model=>typeof model==='string'&&(!model||/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model));
export class StudioTeam{
 constructor(engine){this.engine=engine;this.jobs=new Map();}
 get running(){return [...this.jobs.values()].filter(j=>j.running).length;}
 async spawn({role='generalist',task,provider,model,effort='default'}={}){
  const parent=this.engine;if(typeof role!=='string'||!/^[A-Za-z0-9][\w:.-]{0,99}$/.test(role))throw new Error('Papel de agente inválido.');if(!parent.state.project)throw new Error('Conecte um projeto.');if(typeof task!=='string'||!task.trim()||task.length>30000)throw new Error('Descreva uma tarefa de até 30 mil caracteres.');
  const profile=routingProfile(parent.state);if(this.running>=profile.maxAgents)throw new Error(`O limite é de ${profile.maxAgents} agentes em paralelo.`);
  if(parent.routed&&[...this.jobs.values()].filter(j=>j.turn===parent.turnId).length>=24)throw new Error('Este envio já criou 24 tarefas. Conclua a equipe antes de criar outras.');
  const configured=profile.agents[role]||{},selected=provider|| (configured.provider==='inherit'?null:configured.provider)||parent.state.activeProvider||parent.state.provider;
  if(!PROVIDER_ORDER.includes(selected))throw new Error('Provedor inválido.');if(!providerReady(parent.state,selected)&&!profile.enabled)throw new Error('Conecte o provedor escolhido.');
  const selectedModel=model??(configured.model||parent.state.providerPreferences?.[selected]?.model||(selected==='claude'?'sonnet':''));if(!modelValid(selectedModel)||(selected==='claude'&&selectedModel&&!['sonnet','opus','haiku'].includes(selectedModel)))throw new Error('Modelo inválido para o provedor escolhido.');
  if(!['default','low','medium','high','xhigh','max'].includes(effort))throw new Error('Esforço inválido para este provedor.');
  const id='studio-'+randomUUID(),root=parent.state.project.path;const node={id,name:role,provider:selected,requestedProvider:selected,model:selectedModel||'Padrão do provedor',status:'running',startedAt:Date.now(),managed:true,brief:task,parentId:'principal'};
  const job={id,root,node,running:true,turn:parent.turnId,child:null,promise:null,stopped:false};this.jobs.set(id,job);parent.state.agents.push(node);parent.publish();
  job.promise=this.execute(job,{role,task,provider:selected,model:selectedModel,effort}).catch(e=>{node.status='interrupted';node.summary=e.message;node.activity='tool-error';return {id,ok:false,status:node.status,result:e.message};}).finally(async()=>{job.running=false;node.finishedAt=Date.now();parent.publish();await parent.save();});
  return {id,provider:selected,model:node.model,status:'running'};
 }
 async execute(job,input){
  const parent=this.engine,index=await parent.getInventory();const resource=index.resources.find(r=>r.kind==='agent'&&r.name===input.role&&!r.shadowed);if(input.role!=='generalist'&&!resource)throw new Error('A definição desse agente não foi encontrada no projeto.');
  const definition=resource?await parent.inventory.read(resource.id):null;job.node.instructions=definition?.body||'Execute a tarefa delimitada pelo agente principal.';job.node.declaredSkills=definition?.skills||[];
  const directory=path.join(parent.directory,'agent-runs',job.id);await mkdir(directory,{recursive:true,mode:0o700});
  const child=new parent.constructor({directory,query:parent.query,cliPath:parent.cliPath,env:parent.baseEnv,nativeRunner:parent.nativeRunner,prepareNative:parent.prepareNative,enableTeamBridge:false,telemetryProjectStatus:false});job.child=child;
  child.state.project=structuredClone(parent.state.project);child.state.accounts=parent.state.accounts;child.state.activeAccountId=parent.state.activeAccountId;child.state.providers=structuredClone(parent.state.providers);child.state.providerPreferences=structuredClone(parent.state.providerPreferences||{});child.state.routingProfiles=structuredClone(parent.state.routingProfiles||{});child.state.autoFallback=parent.state.autoFallback;
  child.requestPermission=(tool,input,options)=>parent.requestPermission(tool,input,{...options,agentID:job.id});
  await child.configure({provider:input.provider,model:input.model|| (input.provider==='claude'?'sonnet':''),effort:input.effort});
  let lastEvent=null,skillCount=0,observedTokens=0;child.on('usage-refresh',id=>parent.emit('usage-refresh',id));
  child.on('state',state=>{
   if(state.tokens>observedTokens)parent.state.tokens+=state.tokens-observedTokens;observedTokens=state.tokens;job.node.sessionMetrics=state.sessionMetrics;
   job.node.provider=state.activeProvider||state.provider;job.node.model=state.sessionMetrics?.model||state.model||'Padrão do provedor';job.node.tool=state.mainTool||undefined;job.node.activity=state.mainTool?'tool':'thinking';
   for(const nested of state.agents){const id=job.id+':'+nested.id;let existing=parent.state.agents.find(a=>a.id===id);if(!existing){existing={...nested,id,parentId:job.id,ownerJob:job.id};parent.state.agents.push(existing);}else Object.assign(existing,{...nested,id,parentId:job.id,ownerJob:job.id});}
   for(const use of (state.skillUses||[]).slice(skillCount))parent.state.skillUses=[...(parent.state.skillUses||[]),{...use,agentId:job.id}].slice(-500);skillCount=state.skillUses?.length||0;
   const event=state.events.at(-1);if(event&&event.id!==lastEvent){lastEvent=event.id;if(['tool','tool-error','fallback','error'].includes(event.kind))parent.event(`${job.node.name} · ${event.text}`,event.kind);}
   parent.publish();
  });
  if(job.stopped)return {id:job.id,ok:false,status:'interrupted',result:'Tarefa interrompida.'};
  parent.event(`Delegação Studio → ${input.role} · ${input.provider}.`,'delegation');
  await child.send(`Você é o subagente ${input.role}. Trabalhe somente nesta tarefa e retorne resultado, arquivos, verificações e pendências. Não inicie novos agentes do Studio; a coordenação pertence ao principal.\n\nINSTRUÇÕES DO PAPEL:\n${job.node.instructions}\n\nTAREFA:\n${input.task}`);
  const failed=['error','limited','interrupted'].includes(child.state.runStatus),last=child.state.messages.filter(m=>m.role==='assistant'&&m.text).at(-1)?.text;const error=child.state.events.filter(e=>['error','warning'].includes(e.kind)).at(-1)?.text;
  job.node.status=failed?'interrupted':'completed';job.node.activity=failed?'tool-error':'done';job.node.summary=last||error||'O agente não forneceu um resultado.';job.node.sessionId=child.state.sessionId;
  parent.event(`${job.node.name} ${failed?'encerrou com pendências':'entregou seu resultado'} · ${job.node.provider}.`,failed?'warning':'done');await parent.save();return {id:job.id,ok:!failed,status:job.node.status,provider:job.node.provider,result:job.node.summary};
 }
 list(){return [...this.jobs.values()].filter(j=>j.root===this.engine.state.project?.path).map(j=>({id:j.id,role:j.node.name,provider:j.node.provider,model:j.node.model,status:j.node.status,task:j.node.brief,result:j.node.summary}));}
 async wait(ids,timeoutMs=20000){if(!Array.isArray(ids)||!ids.length||ids.length>24)throw new Error('Informe de 1 a 24 agentes.');const jobs=ids.map(id=>{const job=this.jobs.get(id);if(!job||job.root!==this.engine.state.project?.path)throw new Error('Agente não encontrado neste projeto.');return job;});let timer;await Promise.race([Promise.all(jobs.map(j=>j.promise)),new Promise(resolve=>{timer=setTimeout(resolve,Math.min(Math.max(timeoutMs,0),25000));})]);clearTimeout(timer);return this.list().filter(j=>ids.includes(j.id));}
 stop(id){const job=this.jobs.get(id);if(!job||job.root!==this.engine.state.project?.path)throw new Error('Agente não encontrado.');job.stopped=true;job.node.status='interrupted';job.child?.stop();this.engine.publish();}
 stopAll(){for(const job of this.jobs.values())if(job.running){job.stopped=true;job.node.status='interrupted';job.child?.stop();}}
 async drain(){await Promise.allSettled([...this.jobs.values()].filter(j=>j.running).map(j=>j.promise));}
}
