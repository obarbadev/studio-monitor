import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,realpath,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {spawn} from 'node:child_process';
import {ensureStudioStatusline,StudioTelemetry} from '../electron/studio-telemetry.mjs';
import {ProjectInspector} from '../electron/project.mjs';
async function fixture(t){const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'studio-own-statusline-')));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
function run(command,root,payload){return new Promise((resolve,reject)=>{const child=spawn('bash',['-c',command],{cwd:root,env:{...process.env,CLAUDE_PROJECT_DIR:root}});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('close',code=>code?reject(new Error(err)):resolve(out));child.stdin.end(JSON.stringify(payload));});}
test('automatically installs Studio statusline idempotently and preserves the existing output and permissions',async t=>{
 const root=await fixture(t);await mkdir(path.join(root,'.claude'));await writeFile(path.join(root,'.claude/settings.json'),JSON.stringify({statusLine:{type:'command',command:'printf original-status'},permissions:{defaultMode:'plan',deny:['Read(secret)']}}));await ensureStudioStatusline(root);
 const settings=JSON.parse(await readFile(path.join(root,'.claude/settings.json'),'utf8'));assert.match(settings.statusLine.command,/studio-statusline.py/);assert.equal(settings.permissions.defaultMode,'plan');assert.deepEqual(settings.permissions.deny,['Read(secret)']);
 await mkdir(path.join(root,'production/session-state'),{recursive:true});await writeFile(path.join(root,'production/session-state/active.md'),'## Current task\n\n- **Health /design-review**: review documents\n');
 const out=await run(settings.statusLine.command,root,{session_id:'native-session',model:{display_name:'Test Model'},context_window:{used_percentage:42},prompt:'never record this'});assert.match(out,/Studio \| Test Model \| ctx: 42%/);assert.ok(out.endsWith('original-status'));assert.match(out,/Adequação e revisão da documentação/);assert.ok(!(await readFile(path.join(root,'.studio/runtime/statusline/native-session.json'),'utf8')).includes('never record this'));
 await ensureStudioStatusline(root);assert.equal(JSON.parse(await readFile(path.join(root,'.claude/settings.json'),'utf8')).statusLine.command,settings.statusLine.command);
});
test('SDK execution writes current-session metrics without running a terminal statusline or recording chat',async t=>{
 const root=await fixture(t);const writer=new StudioTelemetry();const state={project:{path:root},sessionId:'sdk-session',sessionMetrics:{model:'model-x',contextWindow:100000,lastInputTokens:50000,lastOutputTokens:1000,updatedAt:Date.now()},model:'x',accounts:[],agents:[],messages:[{text:'private prompt'}],busy:true};writer.update(state);await writer.flush();assert.equal(writer.error,null);
 const snapshot=await new ProjectInspector().snapshot(root,'sdk-session');assert.equal(snapshot.telemetry.source,'studio-sdk');assert.equal(snapshot.telemetry.context.usedPercentage,51);assert.equal(snapshot.telemetry.sessionId,'sdk-session');assert.ok(!(await readFile(path.join(root,'.studio/runtime/statusline-sdk/sdk-session.json'),'utf8')).includes('private prompt'));
 state.externalSession={key:'external'};state.sessionId='external-session';writer.update(state);await writer.flush();await assert.rejects(readFile(path.join(root,'.studio/runtime/statusline-sdk/external-session.json')),{code:'ENOENT'});
});
test('does not install or write telemetry through a linked Studio directory',async t=>{
 const root=await fixture(t),outside=await fixture(t);await symlink(outside,path.join(root,'.studio'));await assert.rejects(ensureStudioStatusline(root),/simbólico/);const writer=new StudioTelemetry();writer.update({project:{path:root},agents:[],model:'test'});await writer.flush();assert.match(writer.error,/link/);assert.deepEqual(await readdir(outside),[]);
});
