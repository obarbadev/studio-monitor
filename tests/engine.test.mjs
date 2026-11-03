import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {StudioEngine,engineFromYaml,cleanEnvironment,availableAccount,isLimit,transferSession} from '../electron/engine.mjs';
const session='12345678-1234-1234-1234-123456789abc';
async function fixture(t,query){const dir=await mkdtemp(path.join(os.tmpdir(),'studio-engine-'));t.after(()=>rm(dir,{recursive:true,force:true}));const engine=new StudioEngine({directory:dir,query,cliPath:'/test/claude',env:{HOME:dir,PATH:'/bin',ANTHROPIC_API_KEY:'should-not-inherit'}});await engine.load();const project=path.join(dir,'game');await mkdir(path.join(project,'.claude/agents'),{recursive:true});await writeFile(path.join(project,'CLAUDE.md'),'Game studio');await writeFile(path.join(project,'project.yaml'),'engine: godot\n');await writeFile(path.join(project,'.claude/agents/designer.md'),'---\nname: game-designer\nmodel: sonnet\n---\n');await engine.connect(project);const a=await engine.addAccount('Primary');a.loggedIn=true;return {engine,a,dir,project};}
test('isolates subscription environments and clears API/provider credentials',()=>{const env=cleanEnvironment({HOME:'/tmp/test',PATH:'/bin',ANTHROPIC_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',ANTHROPIC_BASE_URL:'https://other',CLAUDE_CODE_OAUTH_TOKEN:'secret',CLAUDE_CODE_USE_BEDROCK:'1',CLAUDECODE:'1'},'/profile');assert.equal(env.CLAUDE_CONFIG_DIR,'/profile');assert.equal(env.ANTHROPIC_API_KEY,undefined);assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN,undefined);assert.equal(env.CLAUDE_CODE_USE_BEDROCK,undefined);assert.match(env.PATH,/\.local\/bin/);});
test('fallback selection excludes disabled, disconnected, cooling and already tried accounts',()=>{const accounts=[{id:'a',enabled:true,loggedIn:false},{id:'b',enabled:false,loggedIn:true},{id:'c',enabled:true,loggedIn:true,cooldownUntil:200},{id:'d',enabled:true,loggedIn:true}];assert.equal(availableAccount(accounts,new Set(),100).id,'d');assert.equal(availableAccount(accounts,new Set(['d']),100),undefined);assert.equal(availableAccount(accounts,new Set(['d']),300).id,'c');});
test('recognizes actual limit failures without retrying ordinary errors',()=>{assert.equal(isLimit({type:'rate_limit_event',rate_limit_info:{status:'rejected'}}),true);assert.equal(!!isLimit({type:'result',is_error:true,errors:['Usage limit reached']}),true);assert.equal(!!isLimit({type:'result',is_error:true,errors:['Connection refused']}),false);});
test('connects template projects and ordinary folders while rejecting missing paths',async t=>{const {engine,dir}=await fixture(t,async function*(){});assert.equal(engine.state.project.definitions[0].name,'game-designer');assert.equal(engine.state.project.engine,'godot');await assert.rejects(()=>engine.connect(path.join(dir,'missing')));assert.equal(engine.state.project.name,'game');await engine.connect(dir);assert.deepEqual(engine.state.project.definitions,[]);assert.equal(engine.state.project.engine,'Projeto local');});
test('streams the main chat, tracks spawn/stop hooks, and resumes the same session',async t=>{const calls=[];function query(input){calls.push(input);return (async function*(){yield {type:'system',subtype:'init',session_id:session};const hook=input.options.hooks.SubagentStart[0].hooks[0];await hook({hook_event_name:'SubagentStart',agent_id:'a1',agent_type:'game-designer'});yield {type:'stream_event',event:{delta:{type:'text_delta',text:'Olá'}}};yield {type:'assistant',message:{content:[{type:'text',text:'Olá'}],usage:{input_tokens:5,output_tokens:2}}};await hook({hook_event_name:'SubagentStop',agent_id:'a1',agent_type:'game-designer',last_assistant_message:'GDD concluído'});yield {type:'result',session_id:session,is_error:false,result:'Olá'};})();}const {engine}=await fixture(t,query);await engine.send('Crie um jogo');assert.equal(engine.state.messages[1].text,'Olá');assert.equal(engine.state.agents[0].status,'completed');assert.equal(engine.state.agents[0].summary,'GDD concluído');assert.equal(engine.state.busy,false);assert.equal(engine.state.tokens,7);await engine.send('Continue');assert.equal(calls[1].options.resume,session);assert.equal(calls[0].options.env.ANTHROPIC_API_KEY,undefined);assert.deepEqual(calls[0].options.settingSources,['user','project','local']);for(const call of calls){assert.equal(call.options.permissionMode,'bypassPermissions');assert.equal(call.options.allowDangerouslySkipPermissions,true);assert.equal(typeof call.options.canUseTool,'function');}});
test('serializes concurrent permission prompts and rejects stale responses',async t=>{const {engine}=await fixture(t,async function*(){});const controller=new AbortController();const first=engine.requestPermission('Bash',{command:'test'},{signal:controller.signal});const second=engine.requestPermission('Edit',{file_path:'game.gd'},{signal:controller.signal});await new Promise(r=>setImmediate(r));const id=engine.state.permission.id;engine.resolvePermission({id,allow:true});assert.equal((await first).behavior,'allow');await new Promise(r=>setImmediate(r));assert.equal(engine.state.permission.tool,'Edit');assert.throws(()=>engine.resolvePermission({id,allow:true}));controller.abort();assert.equal((await second).behavior,'deny');assert.equal(engine.state.permission,null);});
test('automatically transfers only transcript context and retries once on the next account',async t=>{let calls=0;let engine;function query({options,prompt}){assert.equal(options.permissionMode,'bypassPermissions');assert.equal(options.allowDangerouslySkipPermissions,true);return(async function*(){calls++;if(calls===1){const folder=path.join(options.env.CLAUDE_CONFIG_DIR,'projects','game');await mkdir(folder,{recursive:true});await writeFile(path.join(folder,`${session}.jsonl`),'completed tool context');await writeFile(path.join(options.env.CLAUDE_CONFIG_DIR,'private-credentials'),'never copy');yield {type:'system',subtype:'init',session_id:session};yield {type:'rate_limit_event',rate_limit_info:{status:'rejected',resetsAt:Math.ceil(Date.now()/1000)+300}};yield {type:'result',session_id:session,is_error:true,errors:['Usage limit reached']};}else{assert.equal(options.resume,session);assert.equal(await readFile(path.join(options.env.CLAUDE_CONFIG_DIR,'projects','game',`${session}.jsonl`),'utf8'),'completed tool context');await assert.rejects(readFile(path.join(options.env.CLAUDE_CONFIG_DIR,'private-credentials')));assert.match(prompt,/Não repita/);yield {type:'result',session_id:session,is_error:false,result:'Concluído'};}})();}({engine}=await fixture(t,query));const second=await engine.addAccount('Backup');second.loggedIn=true;await engine.send('Implemente o combate');assert.equal(calls,2);assert.equal(engine.state.activeAccountId,second.id);assert.equal(engine.state.messages.filter(m=>m.role==='user').length,1);assert.equal(engine.state.events.filter(e=>e.kind==='fallback').length,1);assert.equal(engine.state.messages.at(-1).text,'Concluído');});
test('does not fallback on arbitrary failures; persists chat and interrupted states',async t=>{let calls=0;const {engine,dir}=await fixture(t,()=>{calls++;return(async function*(){throw new Error('Network unavailable');})();});const second=await engine.addAccount('Backup');second.loggedIn=true;await engine.send('Test');assert.equal(calls,1);assert.equal(engine.state.busy,false);assert.ok(engine.state.events.some(e=>e.kind==='error'&&e.text==='Network unavailable'));const reloaded=new StudioEngine({directory:dir});await reloaded.load();assert.equal(reloaded.state.messages[0].text,'Test');assert.equal(reloaded.state.busy,false);});
test('does not loop when all accounts are exhausted and respects disabled fallback',async t=>{let calls=0;const {engine}=await fixture(t,()=> (async function*(){calls++;yield {type:'rate_limit_event',rate_limit_info:{status:'rejected'}};yield {type:'result',is_error:true,errors:['limit reached']};})());const second=await engine.addAccount('Backup');second.loggedIn=true;engine.state.autoFallback=false;await engine.send('Test');assert.equal(calls,1);engine.state.autoFallback=true;engine.state.accounts[0].cooldownUntil=0;await engine.send('Test again');assert.equal(calls,3);assert.equal(engine.state.busy,false);});
test('missing transcript fails closed instead of starting a contextless fallback',async t=>{let calls=0;const {engine}=await fixture(t,()=> (async function*(){calls++;yield {type:'system',subtype:'init',session_id:session};yield {type:'rate_limit_event',rate_limit_info:{status:'rejected'}};})());const second=await engine.addAccount('Backup');second.loggedIn=true;await engine.send('Test');assert.equal(calls,1);assert.ok(engine.state.events.some(e=>e.kind==='error'));});
test('transfer rejects invalid session identifiers',async()=>{await assert.rejects(()=>transferSession('/tmp/a','/tmp/b','../../credentials'));});

test('reads inline and nested game engine metadata',()=>{assert.equal(engineFromYaml('engine: godot\n'),'godot');assert.equal(engineFromYaml('engine:\n  name: unreal\n  version: 5.6'),'unreal');assert.equal(engineFromYaml('engine:\n  name: \"Unity\"'),'Unity');assert.equal(engineFromYaml('other: true'),'Não definido');});

test('renames/removes account registrations without deleting credentials or losing session source',async t=>{
 const {engine,a}=await fixture(t,async function*(){});
 const backup=await engine.addAccount('Backup');backup.loggedIn=true;
 await writeFile(path.join(a.configDir,'private-credentials'),'test-only-secret');
 await engine.editAccount({id:a.id,name:'Pessoal'});assert.equal(a.name,'Pessoal');
 await assert.rejects(()=>engine.editAccount({id:a.id,name:' '}),/Informe/);
 engine.state.sessionAccountId=a.id;engine.state.sessionId=session;
 await engine.removeAccount(a.id);
 assert.equal(engine.state.accounts.length,1);assert.equal(engine.state.activeAccountId,backup.id);
 assert.equal(engine.state.sessionAccountId,null);assert.equal(engine.state.sessionConfigDir,a.configDir);
 assert.equal(await readFile(path.join(a.configDir,'private-credentials'),'utf8'),'test-only-secret');
 await assert.rejects(()=>engine.removeAccount('missing'),/Conta não encontrada/);
});
test('persists theme selection and allows appearance changes during an execution',async t=>{
 const {engine,dir}=await fixture(t,async function*(){});
 engine.state.busy=true;await engine.configure({theme:'dark'});assert.equal(engine.state.theme,'dark');
 await assert.rejects(()=>engine.configure({theme:'light',activeAccountId:'x'}),/Aguarde/);
 const restored=new StudioEngine({directory:dir});await restored.load();assert.equal(restored.state.theme,'dark');
});

test('records runtime capabilities, observed skill calls and loaded instruction evidence',async t=>{
 const {engine}=await fixture(t,({options})=>(async function*(){
   yield {type:'system',subtype:'init',session_id:session,skills:['brainstorm'],agents:['game-designer'],slash_commands:['brainstorm'],plugins:[]};
   await options.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',tool_name:'Skill',tool_input:{skill:'brainstorm'},agent_id:'designer-1'});
   await options.hooks.InstructionsLoaded[0].hooks[0]({hook_event_name:'InstructionsLoaded',file_path:'/game/CLAUDE.md',load_reason:'session_start'});
   yield {type:'result',is_error:false,result:'Pronto',session_id:session};
 })());
 await engine.send('Planeje o jogo');
 assert.deepEqual(engine.state.runtimeCatalog.skills,['brainstorm']);assert.equal(engine.state.skillUses[0].name,'brainstorm');assert.equal(engine.state.skillUses[0].agentId,'designer-1');assert.equal(engine.state.instructionsLoaded[0].path,'/game/CLAUDE.md');
 const inventory=await engine.getInventory();assert.equal(inventory.resources.find(r=>r.kind==='agent').name,'game-designer');assert.equal(inventory.skillUses.length,1);
});

test('persists effort and forwards it to the native execution independently of template rigor',async t=>{let captured;const {engine,dir}=await fixture(t,input=>{captured=input;return(async function*(){yield {type:'system',subtype:'init',session_id:session,effort:'high',model:'sonnet'};yield {type:'result',is_error:false,result:'Done'};})();});await engine.configure({effort:'max'});await engine.send('Check this task');assert.equal(captured.options.effort,'max');assert.equal(captured.options.env.CLAUDE_CODE_EFFORT_LEVEL,'max');assert.equal(engine.state.sessionMetrics.appliedEffort,'high');assert.equal(engine.state.sessionMetrics.requestedEffort,'max');const reload=new StudioEngine({directory:dir});await reload.load();assert.equal(reload.state.effort,'max');await assert.rejects(()=>engine.configure({effort:'unknown'}),/inválido/);});

test('exposes observed delegation, tool transitions, failures and agent-scoped questions',async t=>{
 const {engine}=await fixture(t,({options})=>(async function*(){
  const hook=e=>options.hooks[e.hook_event_name][0].hooks[0](e);
  await hook({hook_event_name:'PreToolUse',tool_name:'Agent',tool_input:{subagent_type:'reviewer',description:'Revisar alterações'}});
  assert.ok(engine.state.events.some(e=>e.kind==='delegation'&&e.text.includes('Revisar alterações')));
  await hook({hook_event_name:'SubagentStart',agent_id:'review-1',agent_type:'reviewer'});
  await hook({hook_event_name:'PreToolUse',agent_id:'review-1',tool_name:'Bash'});
  assert.equal(engine.state.agents[0].activity,'tool');
  await hook({hook_event_name:'PostToolUseFailure',agent_id:'review-1',agent_type:'reviewer',tool_name:'Bash',error:'Command failed'});
  assert.equal(engine.state.agents[0].activity,'tool-error');assert.ok(engine.state.events.some(e=>e.kind==='tool-error'));
  const pending=options.canUseTool('AskUserQuestion',{questions:[]},{signal:options.abortController.signal,agentID:'review-1'});
  await new Promise(r=>setImmediate(r));assert.equal(engine.state.permission.agentId,'review-1');
  engine.resolvePermission({id:engine.state.permission.id,allow:true});await pending;
  await hook({hook_event_name:'PreToolUse',agent_id:'review-1',tool_name:'Read'});
  await hook({hook_event_name:'PostToolUse',agent_id:'review-1',tool_name:'Read'});
  assert.equal(engine.state.agents[0].activity,'thinking');
  await hook({hook_event_name:'SubagentStop',agent_id:'review-1',agent_type:'reviewer',last_assistant_message:'Revisão concluída'});
  yield {type:'result',is_error:false,result:'Pronto'};
 })());
 await engine.send('Revise');assert.equal(engine.state.agents[0].status,'completed');assert.ok(engine.state.agents[0].finishedAt);assert.equal(engine.state.runStatus,'idle');
});
test('retains failure state and timestamps unfinished nodes for canvas expiry',async t=>{
 const {engine}=await fixture(t,({options})=>(async function*(){await options.hooks.SubagentStart[0].hooks[0]({hook_event_name:'SubagentStart',agent_id:'unfinished',agent_type:'reviewer'});throw new Error('Connection lost');})());
 await engine.send('Revise');assert.equal(engine.state.runStatus,'error');assert.ok(engine.state.agents[0].finishedAt);assert.equal(engine.state.agents[0].status,'stopped');
});

test('takes context capacity only from the current main model, not cumulative subagent usage',async t=>{
 const {engine}=await fixture(t,()=> (async function*(){
  yield {type:'system',subtype:'init',session_id:session,model:'claude-main'};
  yield {type:'assistant',message:{model:'claude-main',content:[],usage:{input_tokens:100,cache_read_input_tokens:500,output_tokens:30}}};
  yield {type:'result',is_error:false,result:'Done',modelUsage:{'claude-main':{contextWindow:200000,inputTokens:10000},'claude-subagent':{contextWindow:1000000}}};
 })());await engine.send('Check');assert.equal(engine.state.sessionMetrics.contextWindow,200000);assert.equal(engine.state.sessionMetrics.lastInputTokens,600);
});

test('passes slash skills and their arguments intact to the project runtime',async t=>{
 let received;const {engine}=await fixture(t,({prompt,options})=>(async function*(){received=prompt;assert.deepEqual(options.settingSources,['user','project','local']);yield {type:'result',is_error:false,result:'Ready'};})());await engine.send('/start Meu projeto com espaços');assert.equal(received,'/start Meu projeto com espaços');
});

test('persists a project-specific work phase separately from the product configuration',async t=>{
 const {engine,dir}=await fixture(t,async function*(){});const project=engine.state.project.path;engine.state.busy=true;await engine.configure({projectPhase:'Adequação da documentação ao template'});assert.equal(engine.state.projectPhases[project].name,'Adequação da documentação ao template');await assert.rejects(engine.configure({projectPhase:' '}),/etapa/);const reloaded=new StudioEngine({directory:dir});await reloaded.load();assert.equal(reloaded.state.projectPhases[project].name,'Adequação da documentação ao template');await engine.configure({projectPhase:null});assert.equal(engine.state.projectPhases[project],undefined);
});

test('shows slash command output and informational hook feedback in the chat',async t=>{
 const {engine}=await fixture(t,async function*(){yield {type:'system',subtype:'local_command_output',content:'Architecture review started'};yield {type:'system',subtype:'informational',level:'warning',content:'Project hook requires updated documentation'};yield {type:'result',is_error:false,result:''};});await engine.send('/architecture-review');assert.match(engine.state.messages.at(-1).text,/Architecture review started/);assert.match(engine.state.messages.at(-1).text,/Project hook requires updated documentation/);assert.ok(engine.state.events.some(e=>e.text==='Executando comando /architecture-review.'));assert.ok(engine.state.events.some(e=>e.kind==='warning'&&e.text.includes('Project hook')));
});
test('publishes stopping immediately and only clears it after the execution ends',async t=>{
 let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);const {engine}=await fixture(t,({options})=>(async function*(){entered();await gate;yield {type:'result',is_error:false,result:'Done'};})());const pending=engine.send('Work');await ready;engine.stop();assert.equal(engine.state.stopping,true);assert.equal(engine.state.busy,true);assert.equal(engine.routeController.signal.aborted,true);release();await pending;assert.equal(engine.state.stopping,false);assert.equal(engine.state.busy,false);assert.equal(engine.state.runStatus,'interrupted');
});
