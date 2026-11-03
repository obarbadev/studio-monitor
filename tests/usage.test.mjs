import test from 'node:test';import assert from 'node:assert/strict';
import {readAccountUsage,normalizeUsage,UsageMonitor} from '../electron/usage.mjs';
const data={rate_limits_available:true,rate_limits:{five_hour:{utilization:52,resets_at:'2026-11-03T02:00:00Z'},seven_day:{utilization:81,resets_at:null},extra_usage:{private:'do not expose'}}};
test('queries native usage through a control-only session without a user prompt',async()=>{
 let options,closed=false,inputs=[];
 const result=await readAccountUsage({cliPath:'/cli',configDir:'/profile',cwd:'/tmp',query:input=>{options=input.options;void(async()=>{for await(const m of input.prompt)inputs.push(m);})();return {initializationResult:async()=>({}),usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET:async()=>data,close:()=>closed=true};}});
 assert.equal(closed,true);assert.deepEqual(inputs,[]);assert.equal(options.persistSession,false);assert.deepEqual(options.tools,[]);assert.deepEqual(options.settingSources,[]);assert.equal(options.env.CLAUDE_CONFIG_DIR,'/profile');
 assert.equal(result.windows.five_hour.utilization,52);assert.equal(result.windows.seven_day.utilization,81);assert.equal(result.windows.extra_usage,undefined);
});
test('reports absent usage instead of silently hiding a failure',()=>{assert.throws(()=>normalizeUsage({rate_limits_available:false}),/não forneceu/);assert.throws(()=>normalizeUsage({rate_limits_available:true,rate_limits:{}}),/percentuais/);});
test('times out and closes a stalled usage process',async()=>{let closed=false;await assert.rejects(()=>readAccountUsage({cliPath:'/cli',configDir:'/profile',cwd:'/tmp',timeoutMs:10,query:()=>({initializationResult:()=>new Promise(()=>{}),close:()=>closed=true})}),/demorou demais/);assert.equal(closed,true);});
test('coalesces duplicate refreshes and preserves last successful reading on failure',async()=>{
 let calls=0;const account={id:'a',configDir:'/profile',loggedIn:true};const engine={state:{accounts:[account]},publish(){},async save(){}};
 const monitor=new UsageMonitor(engine,{cliPath:'/cli',cwd:'/tmp',query:()=>{calls++;return {initializationResult:async()=>({}),usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET:async()=>data,close(){}};}});
 await Promise.all([monitor.refresh('a'),monitor.refresh('a')]);assert.equal(calls,1);assert.equal(account.usage.windows.five_hour.utilization,52);assert.equal(account.usageLoading,false);
 monitor.query=()=>({initializationResult:async()=>{throw new Error('Login expirado');},close(){}});await assert.rejects(()=>monitor.refresh('a'),/Login expirado/);assert.equal(account.usageError,'Login expirado');assert.equal(account.usage.windows.five_hour.utilization,52);
});

test('automatic refreshes reuse a recent reading while manual refreshes can request a new one',async()=>{
 let calls=0;const account={id:'a',configDir:'/profile',loggedIn:true,usage:{windows:{},updatedAt:Date.now()}};
 const engine={state:{accounts:[account]},publish(){},async save(){}};
 const monitor=new UsageMonitor(engine,{cliPath:'/cli',cwd:'/tmp',query:()=>{calls++;return {initializationResult:async()=>({}),usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET:async()=>data,close(){}};}});
 await monitor.refresh('a',{force:false});assert.equal(calls,0);await monitor.refresh('a');assert.equal(calls,1);await monitor.refreshAll();assert.equal(calls,1);
});
