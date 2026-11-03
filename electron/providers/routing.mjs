import {availableNativeAccounts} from './accounts.mjs';
import {PROVIDERS} from './catalog.mjs';
export const PROVIDER_ORDER=['claude','codex','gemini'];
export function routingProfile(state){return {enabled:true,order:state.project?.template?.execution?.fallbackOrder||PROVIDER_ORDER,maxAgents:state.project?.template?.execution?.maxParallelAgents||3,agents:{},...(state.routingProfiles?.[state.project?.path]||{})};}
export function providerReady(state,provider){if(provider==='claude')return state.providers?.claude?.available!==false&&state.accounts.some(a=>a.enabled&&a.loggedIn&&(!a.cooldownUntil||a.cooldownUntil<=Date.now()));const s=state.providers?.[provider];return !!(s?.available&&s.binary&&(state.nativeProfilesInitialized?.includes(provider)?availableNativeAccounts(state,provider).length:s.loggedIn));}
export function limitFailure(message){return /(?:\brate[_ -]?limit(?:[_ -]?(?:exceeded|reached))?\b|usage[_ -]?limit|insufficient[_ -]?quota|resource_exhausted|quota[_ -]?(?:exceeded|exhausted)|usage_limit_reached|out of extra usage|\bHTTP\s*429\b|\b429\s+Too Many Requests\b|exhausted.{0,30}(?:capacity|quota))/i.test(String(message||''));}
export function validateRouting(value){
 if(!value||typeof value!=='object'||typeof value.enabled!=='boolean'||!Array.isArray(value.order)||value.order.length!==3||new Set(value.order).size!==3||value.order.some(p=>!PROVIDER_ORDER.includes(p)))throw new Error('Defina os três provedores em uma ordem válida.');
 if(!Number.isInteger(value.maxAgents)||value.maxAgents<1||value.maxAgents>6)throw new Error('Escolha de 1 a 6 agentes em paralelo.');
 if(!value.agents||typeof value.agents!=='object'||Array.isArray(value.agents))throw new Error('Rotas dos agentes inválidas.');
 for(const [role,route] of Object.entries(value.agents)){if(!/^[\w:.-]{1,100}$/.test(role)||!route||typeof route!=='object'||(route.provider!=='inherit'&&!PROVIDER_ORDER.includes(route.provider))||typeof route.model!=='string'||(route.model&&!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(route.model)))throw new Error('Provedor ou modelo de um agente inválido.');}
 return structuredClone(value);
}
export function handoffPrompt(state,request,from,to){
 const history=state.messages.slice(-24).map(m=>`[${m.role}${m.account?' · '+m.account:''}]\n${m.text.slice(-7000)}`).join('\n\n').slice(-34000);
 const agents=state.agents.slice(-16).map(a=>({id:a.id,name:a.name,provider:a.provider,status:a.status,task:a.brief?.slice(0,500),result:a.summary?.slice(-1000)}));
 const activity=state.events.filter(e=>['tool','done','fallback','error','spawn'].includes(e.kind)).slice(-35).map(e=>e.text).join('\n').slice(-8000);
 return `CONTINUIDADE DO STUDIO: ${from} → ${to}. Esta é uma nova sessão do provedor, com contexto parcial preparado pelo Studio; não é uma retomada do identificador de outro programa.\nSolicitação original: ${request.slice(0,18000)}\n\nHistórico recente (pode estar truncado):\n${history}\n\nTarefas e resultados observados:\n${JSON.stringify(agents)}\n\nAtividade recente:\n${activity}\n\nAntes de agir, confira os arquivos e os resultados já concluídos. Não repita commits, publicações, comandos com efeitos externos ou trabalho ainda em execução. Consulte studio_agents para tarefas gerenciadas pelo Studio e espere as existentes em vez de duplicá-las. Se o histórico parcial não bastar para continuar com segurança, explique o contexto que falta e pergunte ao usuário.`;
}
export async function sendRouted(engine,text){
 if(engine.routed||engine.state.busy)throw new Error('Aguarde a execução atual.');if(!engine.state.project)throw new Error('Conecte um projeto.');if(engine.state.externalSession)throw new Error('Esta sessão está em acompanhamento. Retome-a antes de enviar mensagens.');if(typeof text!=='string'||!text.trim()||text.length>100000)throw new Error('Mensagem inválida.');
 const state=engine.state,preferred=state.provider,preference={model:state.model,effort:state.effort||'default'},profile=routingProfile(state);let current=state.activeProvider||preferred,prompt=text,continuation=false;const attempted=new Set();engine.routed=true;engine.routeController=new AbortController();state.busy=true;state.lastRunFailure=null;engine.publish();
 try{
  if(engine.enableTeamBridge)await engine.startTeamBridge();
  while(current&&!engine.routeController.signal.aborted){
   if(!providerReady(state,current)){
    attempted.add(current);const next=profile.enabled?profile.order.find(p=>!attempted.has(p)&&providerReady(state,p)):null;if(!next)throw new Error('Nenhuma conexão disponível na ordem de fallback. Verifique suas conexões.');
    engine.event(`${PROVIDERS[current].name} indisponível. Usando ${PROVIDERS[next].name}.`,'fallback');current=next;
   }
   attempted.add(current);const target=state.providerPreferences?.[current]||{model:current==='claude'?'sonnet':'',effort:'default'};
   state.activeProvider=current===preferred?null:current;state.provider=current;state.model=current===preferred?preference.model:target.model;state.effort=current===preferred?preference.effort:target.effort;
   if(state.sessionId&&state.sessionProvider!==current){prompt=handoffPrompt(state,text,state.sessionProvider,current);state.sessionId=null;state.sessionAccountId=null;state.sessionConfigDir=null;state.sessionMetrics=null;state.nativeContextHash=null;}
   state.lastRunFailure=null;await engine.sendDirect(prompt,{continuation,routed:true});continuation=true;
   if(engine.routeController.signal.aborted)break;
   if(state.runStatus!=='limited'||!profile.enabled)break;
   const next=profile.order.find(p=>!attempted.has(p)&&providerReady(state,p));if(!next)break;
   engine.event(`Fallback entre provedores: ${PROVIDERS[current].name} → ${PROVIDERS[next].name}. Preparando contexto de continuidade.`,'fallback');prompt=handoffPrompt(state,text,current,next);state.sessionId=null;state.sessionAccountId=null;state.sessionConfigDir=null;state.sessionMetrics=null;state.nativeContextHash=null;current=next;
  }
  if(engine.routeController.signal.aborted)engine.team?.stopAll();await engine.team?.drain();
 }catch(e){if(!engine.routeController.signal.aborted){state.runStatus='error';engine.event(e.message,'error');}else state.runStatus='interrupted';}
 finally{
  state.activeProvider=current&&current!==preferred?current:null;state.provider=preferred;Object.assign(state,preference);state.busy=false;state.stopping=false;engine.routed=false;engine.routeController=null;await engine.closeTeamBridge();engine.publish();await engine.save();
 }
}
