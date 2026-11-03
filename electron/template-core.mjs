import {parse} from 'yaml';
import {modelPolicy,modelInstructions} from './template-models.mjs';
const capabilities={Read:'files.read',Glob:'files.find',Grep:'files.search',Write:'files.write',Edit:'files.edit',Bash:'commands.run',Agent:'agents.delegate',Task:'agents.delegate',Skill:'workflows.invoke',WebSearch:'web.search',WebFetch:'web.fetch',AskUserQuestion:'user.ask',TodoWrite:'tasks.track',TaskCreate:'tasks.track',TaskUpdate:'tasks.track',TaskList:'tasks.read',TaskGet:'tasks.read'};
const list=value=>Array.isArray(value)?value.map(String):typeof value==='string'?value.split(',').map(x=>x.trim()).filter(Boolean):[];
export function compileTemplateCore(entries,template){
 const roles=[],workflows=[],resources=[];
 for(const {relative,after} of entries){
  const role=/^\.claude\/agents\/[^/]+\.md$/.test(relative),workflow=/^\.claude\/skills\/.+\/SKILL\.md$/.test(relative)||/^\.claude\/commands\/.+\.md$/.test(relative);
  if(!role&&!workflow){resources.push(relative);continue;}
  const text=after.toString(),match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);let meta={},metadataIssue=null;if(match){try{meta=parse(match[1]);if(!meta||typeof meta!=='object'||Array.isArray(meta)){meta={};metadataIssue='invalid-source-metadata';}}catch{metadataIssue='invalid-source-metadata';}}else metadataIssue='missing-source-metadata';
  const tools=list(meta.tools||meta['allowed-tools']);
  const definition={id:meta.name||(role?relative.split('/').at(-1).replace(/\.md$/,''):relative.split('/').at(-2)),description:meta.description||'',instructions:match?text.slice(match[0].length):text,...(metadataIssue?{compatibility:{issues:[metadataIssue]}}:{}),modelPolicy:meta.model&&meta.model!=='inherit'?{mode:'explicit',model:meta.model}:{mode:'inherit-session'},capabilityPolicy:tools.length?'declared':'inherit-session',capabilities:[...new Set(tools.map(t=>capabilities[t.split(/[ (]/)[0]]||'adapter.extension'))],workflows:list(meta.skills),constraints:{...(Number.isFinite(meta.maxTurns)?{maxTurns:meta.maxTurns}:{})},source:{format:'claude-code',path:relative,toolConstraints:tools}};
  (role?roles:workflows).push(definition);
 }
 return {schemaVersion:1,id:template.id,name:template.name,version:template.version,modelPolicy,execution:template.execution||null,instructions:modelInstructions,roles,workflows,resources,adapters:{'claude-code':{status:'available',definitionDirectory:'.claude'},openai:{status:'available',runtime:'codex-cli',authentication:'official-login'},gemini:{status:'available',runtime:'gemini-cli',authentication:'official-login'}},portability:{instructions:'Templates contain project file references and shell procedures. Each adapter must map capabilities, prompts, permissions, effort, and lifecycle events to its runtime. Unknown tools require an explicit adapter extension; never assume they were executed.'}};
}
