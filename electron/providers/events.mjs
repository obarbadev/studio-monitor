const number=v=>Number.isFinite(v)&&v>=0?v:0;
const message=value=>typeof value==='string'?value:value&&typeof value==='object'?[value.type,value.code,value.message].filter(v=>typeof v==='string'||typeof v==='number').join(' · ')||JSON.stringify(value):JSON.stringify(value||'Falha do executor');
export function normalizeNativeEvent(provider,row,{roles=[],tools=new Map()}={}){
 const out=[];
 if(provider==='codex'){
  if(row.type==='thread.started')out.push({type:'session',id:row.thread_id});
  if(/^item\./.test(row.type||'')&&row.item){const item=row.item;const complete=row.type==='item.completed';
   if(item.type==='agent_message')out.push({type:'text',id:item.id,text:item.text||'',delta:false});
   else if(['command_execution','file_change','mcp_tool_call','web_search'].includes(item.type))out.push({type:'tool',id:item.id,name:item.type==='command_execution'?'Executar comando':item.type==='file_change'?'Editar arquivos':item.type==='web_search'?'Busca na web':`${item.server||'MCP'}/${item.tool||'tool'}`,status:complete?(item.status==='failed'?'error':'done'):'running'});
   else if(['collab_tool_call','collab_agent_tool_call','collabAgentToolCall'].includes(item.type)){
    const ids=item.receiver_thread_ids||item.receiverThreadIds||[];const states=item.agents_states||item.agentsStates||{};
    for(const id of [...new Set([...ids,...Object.keys(states)])]){const s=states[id]||{},status=typeof s==='string'?s:s.status;const role=(item.receiver_agents||item.receiverAgents||[]).find(a=>(a.thread_id||a.threadId)===id);const nativeName=role?.agent_role||role?.agentRole;const name=roles.find(r=>r.nativeName===nativeName)?.name||nativeName||'Subagente Codex';
     const normalized={completed:'completed',errored:'interrupted',shutdown:'stopped',running:'running',pending_init:'running',pendingInit:'running'}[status]||(item.tool==='close_agent'?'stopped':'running');
     out.push({type:'agent',id,name,status:normalized,brief:item.prompt||undefined,summary:s.message||undefined,model:item.model||undefined,parentId:item.sender_thread_id||item.senderThreadId});
    }
   }
  }
  if(row.type==='turn.completed'){const u=row.usage||{};out.push({type:'usage',input:number(u.input_tokens),output:number(u.output_tokens),cached:number(u.cached_input_tokens),total:number(u.input_tokens)+number(u.output_tokens),scope:'turn'});out.push({type:'result'});}
  if(row.type==='turn.failed')out.push({type:'failure',message:message(row.error)});
  if(row.type==='error')out.push({type:'warning',message:message(row.error||{code:row.code,message:row.message})});
 }else if(row.event){
  if(row.event==='init')out.push({type:'session',id:row.conversation_id,model:row.init?.model});
  if(row.event==='step_update'){
   const step=row.step_update||{},id='agy-step-'+step.step_index;
   if(step.step_type==='agent_response'&&step.text_delta)out.push({type:'text',id,text:step.text_delta,delta:true});
   if(step.step_type==='tool')out.push({type:'tool',id,name:step.tool_name||step.tool_info?.name||'Ferramenta AGY',status:step.state==='DONE'?(step.tool_info?.error?'error':'done'):'running'});
   for(const agent of step.subagent_info?.subagents||[])if(agent.conversation_id)out.push({type:'agent',id:agent.conversation_id,name:roles.find(r=>r.nativeName===agent.type_name)?.name||agent.role||agent.type_name||'Subagente AGY',status:step.state==='DONE'?'completed':'running',parentId:step.conversation_id});
  }
  if(row.event==='result'){
   const result=row.result||{};
   if(result.conversation_id)out.push({type:'session',id:result.conversation_id});
   if(result.status==='SUCCESS'){
    if(typeof result.response==='string')out.push({type:'final-text',text:result.response});
    const u=result.usage||{};out.push({type:'usage',input:number(u.input_tokens),output:number(u.output_tokens),cached:number(u.cache_read_tokens),total:number(u.total_tokens)||number(u.input_tokens)+number(u.output_tokens),scope:'invocation'});out.push({type:'result'});
   }else out.push({type:'failure',message:message(result.error||`AGY encerrou com estado ${result.status||'desconhecido'}.`)});
  }
 }else{
  // Retain old wire decoding for archived fixtures; new executions use AGY only.
  if(row.type==='init')out.push({type:'session',id:row.session_id,model:row.model});
  if(row.type==='message'&&row.role==='assistant')out.push({type:'text',id:row.id||'assistant',text:row.content||'',delta:row.delta!==false});
  if(row.type==='tool_use'){
   const role=roles.find(r=>r.nativeName===row.tool_name);tools.set(row.tool_id,{name:row.tool_name,role});
   if(role)out.push({type:'agent',id:row.tool_id,name:role.name,status:'running',brief:typeof row.parameters?.query==='string'?row.parameters.query:JSON.stringify(row.parameters||{})});
   else out.push({type:'tool',id:row.tool_id,name:row.tool_name,status:'running'});
  }
  if(row.type==='tool_result'){const tool=tools.get(row.tool_id);if(tool?.role)out.push({type:'agent',id:row.tool_id,name:tool.role.name,status:row.status==='success'?'completed':'interrupted',summary:row.output||row.error?.message});else out.push({type:'tool',id:row.tool_id,name:tool?.name||'Ferramenta',status:row.status==='success'?'done':'error'});}
  if(row.type==='error')out.push({type:row.severity==='warning'?'warning':'failure',message:message(row.error||{code:row.code,message:row.message})});
  if(row.type==='result'){if(row.status==='success'){const u=row.stats||{};out.push({type:'usage',input:number(u.input_tokens),output:number(u.output_tokens),cached:number(u.cached),total:number(u.total_tokens)||number(u.input_tokens)+number(u.output_tokens),scope:'invocation'});out.push({type:'result'});}else out.push({type:'failure',message:message(row.error||row.message||'O Gemini não concluiu a execução.')});}
 }
 return out;
}
