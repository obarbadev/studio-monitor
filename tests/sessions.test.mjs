import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {SessionBrowser,parseTranscript,discoverConfigDirs} from '../electron/sessions.mjs';
import {StudioEngine} from '../electron/engine.mjs';
const id='12345678-1234-1234-1234-123456789abc';
const line=o=>JSON.stringify(o)+'\n';
const transcript=(cwd)=>line({type:'user',uuid:'u1',cwd,timestamp:'2026-11-02T20:00:00Z',message:{content:'Vamos fazer um jogo'}})+line({type:'assistant',uuid:'a1',cwd,message:{content:[{type:'text',text:'Vou chamar o designer'},{type:'tool_use',id:'task-1',name:'Agent',input:{subagent_type:'game-designer',description:'Criar o mundo'}}],usage:{input_tokens:10,output_tokens:20}}});
test('parses external chat and distinguishes observed delegation from confirmed completion',()=>{const text=transcript('/game');const initial=parseTranscript(text);assert.equal(initial.cwd,'/game');assert.equal(initial.title,'Vamos fazer um jogo');assert.equal(initial.agents[0].name,'game-designer');assert.equal(initial.agents[0].status,'observed');assert.equal(initial.messages.length,2);assert.equal(initial.tokens,30);const completed=parseTranscript(text+line({type:'user',message:{content:[{type:'tool_result',tool_use_id:'task-1',content:'Mundo pronto'}]}}));assert.equal(completed.agents[0].status,'completed');assert.equal(completed.agents[0].summary,'Mundo pronto');assert.equal(completed.messages.length,2);});
test('ignores partially written lines, nulls and sidechain messages',()=>{const parsed=parseTranscript('null\n{incomplete\n'+line({type:'assistant',isSidechain:true,message:{content:'private subagent text'}})+line({type:'user',message:{content:'Hello'}}));assert.deepEqual(parsed.messages.map(m=>m.text),['Hello']);});
test('discovers, watches and resumes an existing local session without invoking the model',async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'studio-sessions-'));t.after(()=>rm(dir,{recursive:true,force:true}));const game=path.join(dir,'game');const config=path.join(dir,'.claude');const logs=path.join(config,'projects','game');await mkdir(logs,{recursive:true});await mkdir(game);const file=path.join(logs,`${id}.jsonl`);await writeFile(file,transcript(game));let modelCalls=0;const engine=new StudioEngine({directory:path.join(dir,'data'),query:()=>{modelCalls++;throw new Error('Must not call model');}});await engine.load();const browser=new SessionBrowser(engine,config);t.after(()=>browser.stop());const sessions=await browser.list();assert.equal(sessions.length,1);assert.equal(sessions[0].cwd,game);assert.equal('file' in sessions[0],false);await browser.watch(sessions[0].key);assert.equal(engine.state.sessionId,id);assert.equal(engine.state.externalSession.title,'Vamos fazer um jogo');assert.equal(engine.state.messages.length,2);assert.equal(engine.state.agents[0].status,'observed');await assert.rejects(()=>engine.send('must refuse'),/acompanhamento/);assert.equal(modelCalls,0);await writeFile(file,transcript(game)+line({type:'assistant',uuid:'a2',message:{content:'Nova resposta ao vivo'}}));await browser.poll(true);assert.equal(engine.state.messages.at(-1).text,'Nova resposta ao vivo');await browser.takeOver();assert.equal(engine.state.externalSession,null);assert.equal(engine.state.sessionId,id);assert.equal(engine.state.accounts.length,0);assert.equal(engine.state.sessionConfigDir,config);assert.equal(browser.timer,null);assert.equal(modelCalls,0);});
test('rejects paths and unknown session keys from the renderer',async t=>{const dir=await mkdtemp(path.join(os.tmpdir(),'studio-sessions-'));t.after(()=>rm(dir,{recursive:true,force:true}));const engine=new StudioEngine({directory:dir});await engine.load();const browser=new SessionBrowser(engine,path.join(dir,'missing'));assert.deepEqual(await browser.list(),[]);await assert.rejects(()=>browser.watch('../../private'),/Atualize/);});

test('discovers unregistered named profiles and keeps their session ownership',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'studio-profile-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const standard=path.join(dir,'.claude'),personal=path.join(dir,'.claude-personal'),custom=path.join(dir,'custom-config'),unrelated=path.join(dir,'unrelated');
 for(const root of [standard,personal,custom,unrelated])await mkdir(path.join(root,'projects'),{recursive:true});
 const game=path.join(dir,'game');await mkdir(game);
 const logs=path.join(personal,'projects','game');await mkdir(logs);await writeFile(path.join(logs,`${id}.jsonl`),transcript(game));
 assert.deepEqual(new Set(await discoverConfigDirs(standard,[standard],custom)),new Set([standard,personal,custom]));
 const engine=new StudioEngine({directory:path.join(dir,'data')});await engine.load();
 const browser=new SessionBrowser(engine,standard);t.after(()=>browser.stop());
 const sessions=await browser.list();assert.equal(sessions.length,1);assert.equal(sessions[0].accountName,'Claude Code · personal');
 await browser.watch(sessions[0].key);
 assert.equal(engine.state.accounts.length,0);assert.equal(engine.state.sessionConfigDir,personal);assert.equal(engine.state.sessionId,id);assert.equal(engine.state.messages.length,2);
});

test('extracts observed external Skill calls and delegation briefs without claiming a completed result',()=>{
 const parsed=parseTranscript(line({type:'assistant',agentId:'agent-a',message:{content:[{type:'tool_use',id:'skill1',name:'Skill',input:{skill:'brainstorm'}},{type:'tool_use',id:'task1',name:'Agent',input:{subagent_type:'designer',description:'Planejar',prompt:'Use o briefing do jogo.'}}]}}));
 assert.equal(parsed.skillUses[0].name,'brainstorm');assert.equal(parsed.skillUses[0].agentId,'agent-a');assert.equal(parsed.agents[0].brief,'Use o briefing do jogo.');assert.equal(parsed.agents[0].summary,undefined);assert.equal(parsed.runtimeCatalog,null);
});

test('records direct slash skills only when they match known skill definitions',()=>{const text=line({type:'user',message:{content:'<command-name>/start</command-name>'}})+line({type:'user',message:{content:'<command-name>/status</command-name>'}});const parsed=parseTranscript(text,{knownSkills:new Set(['start'])});assert.deepEqual(parsed.skillUses.map(s=>s.name),['start']);assert.equal(parsed.skillUses[0].source,'slash-command');});
