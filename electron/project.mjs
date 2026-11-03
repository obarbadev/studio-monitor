import {readFile,readdir,stat,lstat,realpath,open} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';
import {projectActivity,documentationIndex} from './project-activity.mjs';
export function normalizeStoryStatus(value){
 const status=String(value||'').trim().toLowerCase().replace(/[ _-]+/g,' ');
 if(/^(done|complete|completed)\b/i.test(status))return 'done';
 return ({done:'done',complete:'done',completed:'done',concluido:'done','concluído':'done',backlog:'backlog',ready:'ready',pronto:'ready','in progress':'in_progress',implementing:'in_progress','em andamento':'in_progress',blocked:'blocked',bloqueado:'blocked',review:'review','in review':'review',pending:'backlog',todo:'backlog'})[status]||'unknown';
}
export function parseStory(text,file){
 let metadata={};const front=text.match(/^---\r?\n([\s\S]*?)\r?\n---/);if(front){try{metadata=parse(front[1])||{};}catch{}}
 const header=text.split('\n').map(line=>line.replace(/^\s*>\s*/,'').replace(/\*\*/g,'').replace(/^\s*-\s*/,''));
 const status=metadata.status||header.find(line=>/^Status\s*:/i.test(line))?.replace(/^Status\s*:\s*/i,'');
 const field=name=>header.find(line=>new RegExp(`^(?:${name})\\s*:`,'i').test(line))?.replace(/^[^:]+:\s*/,'').trim();
 const checks=[...text.matchAll(/^\s*[-*]\s+\[([ xX])\]/gm)];
 return {priority:metadata.priority||field('Priority|Prioridade')||null,owner:metadata.owner||metadata.assignee||field('Owner|Assignee|Responsável')||null,dependencies:Array.isArray(metadata.dependencies)?metadata.dependencies.join(', '):typeof metadata.dependencies==='string'?metadata.dependencies:null,checks:{total:checks.length,done:checks.filter(m=>m[1].toLowerCase()==='x').length},name:typeof metadata.title==='string'?metadata.title:text.match(/^#\s+(.+)$/m)?.[1]||path.basename(file,'.md'),storyId:metadata.id?String(metadata.id):path.basename(file,'.md'),status:normalizeStoryStatus(status),rawStatus:status?String(status):null};
}
async function readOptional(file){try{return await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function projectMetadata(root){
 let config={},template=null;
 try{config=parse(await readFile(path.join(root,'project.yaml'),'utf8'))||{};}catch{}
 try{const saved=JSON.parse(await readFile(path.join(root,'.studio/template.json'),'utf8'));template={id:saved.id,name:saved.name,version:saved.version,suggestedCommands:saved.suggestedCommands||[],execution:saved.execution||null};}catch{}
 const engine=typeof config.engine==='string'?config.engine:config.engine?.name;
 const stack=typeof config.stack==='string'?config.stack:config.stack?.framework||config.stack?.language;
 return {engine:stack||engine||'Projeto local',template};
}
export class ProjectInspector{
 constructor(){this.items=new Map();}
 async snapshot(root,sessionId,{provider='claude'}={}){
   root=await realpath(root);
   const warnings=[],items=new Map();let config={},template=null,state={};
   const yaml=await readOptional(path.join(root,'project.yaml'));if(yaml){try{config=parse(yaml)||{};}catch{warnings.push('project.yaml contém erros de leitura.');}}
   const metadata=await projectMetadata(root);template=metadata.template;
   const active=await readOptional(path.join(root,'production/state.yaml'));if(active){try{state=parse(active)||{};}catch{warnings.push('O estado de produção não pôde ser lido.');}}
   let stage=config.project?.stage||null,stageSource=stage?'project.yaml':null;
   if(!stage){const legacy=await readOptional(path.join(root,'production/stage.txt'));if(legacy){stage=legacy.split('\n')[0].trim();stageSource='production/stage.txt';}}
   let profile={};try{profile=JSON.parse(await readFile(path.join(root,'.studio/template.json'),'utf8')).monitor||{};}catch{}
   const valueAt=key=>String(key||'').split('.').reduce((value,key)=>value&&Object.hasOwn(value,key)?value[key]:undefined,config);
   if(!stage&&profile.defaultStage){
     stage=profile.defaultStage;stageSource='Inferido pelas regras do template';
     for(const rule of profile.stageRules||[]){
       let matched=false;
       if(rule.configKey)matched=!!valueAt(rule.configKey);
       if(rule.exists){const candidate=path.resolve(root,rule.exists);if(candidate.startsWith(root+path.sep)){try{matched=(await stat(candidate)).isFile();}catch{}}}
       if(rule.directory||rule.sourceDirectories){
         let relative=rule.directory;
         if(rule.sourceDirectories){const setting=rule.sourceDirectories;const configured=String(valueAt(setting.configKey)||'').toLowerCase();relative=Object.entries(setting.choices||{}).find(([key])=>configured.includes(key.toLowerCase()))?.[1]||setting.default;}
         const directory=path.resolve(root,String(relative||''));let count=0;const limit=rule.minimum||1;
         const scan=async(dir,depth=0)=>{if(depth>6||count>=limit)return;let entries=[];try{entries=await readdir(dir,{withFileTypes:true});}catch{}for(const e of entries){if(count>=limit)break;if(e.isDirectory())await scan(path.join(dir,e.name),depth+1);else if(e.isFile()&&(!rule.namePrefix||e.name.startsWith(rule.namePrefix))&&(!rule.extensions?.length||rule.extensions.includes(e.name.split('.').pop()?.toLowerCase())))count++;}};
         if(directory.startsWith(root+path.sep))await scan(directory);matched=count>=limit;
       }
       if(matched&&typeof rule.stage==='string')stage=rule.stage;
     }
   }
   const posture=config.modes||{};const custom=posture.review_mode||posture.workflow||posture.story_granularity||config.docs?.density||config.qa?.level||config.team?.size;
   const rigor=posture.rigor||(custom?'custom':profile.defaultRigor||null);
   let breadcrumb={epic:state.activeEpic||null,story:state.activeStory||null,task:state.task||null,blocker:state.blocker||null};
   const legacyActive=await readOptional(path.join(root,'production/session-state/active.md'));
   if(legacyActive){const block=legacyActive.match(/<!-- STATUS -->([\s\S]*?)<!-- \/STATUS -->/)?.[1];if(block){const value=key=>block.match(new RegExp(`^${key}:[ \\t]*(.+)$`,'m'))?.[1]?.trim()||null;breadcrumb={epic:breadcrumb.epic||value('Epic'),story:breadcrumb.story||value('Feature'),task:breadcrumb.task||value('Task'),blocker:breadcrumb.blocker};}}
   const activity=projectActivity({config,state,activeText:legacyActive||''});if(!breadcrumb.task&&activity.task)breadcrumb.task=activity.task;
   const stories=[],artifacts=[];
   const add=async(file,kind)=>{
     if(items.size>=350)return;
     const canonical=await realpath(file);if(!canonical.startsWith(root+path.sep)){warnings.push('Um arquivo fora do projeto foi ignorado.');return;}
     const info=await stat(file);if(info.size>512*1024)return;
     const id=createHash('sha256').update(file).digest('hex').slice(0,24);const h=await open(file,'r');let text;try{const buffer=Buffer.alloc(Math.min(12000,info.size));const r=await h.read(buffer,0,buffer.length,0);text=buffer.subarray(0,r.bytesRead).toString();}finally{await h.close();}
     const item={id,path:path.relative(root,file),modifiedAt:info.mtimeMs,...(kind==='story'?{...parseStory(text,file),epic:path.relative(path.join(root,'production/epics'),path.dirname(file))||'Sem épico'}:{name:path.basename(file),kind})};items.set(id,{file,root});if(kind==='story')stories.push(item);else artifacts.push(item);
   };
   const walk=async(dir,kind,depth=0)=>{if(depth>4||items.size>=350)return;let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')warnings.push(`Não foi possível ler ${path.relative(root,dir)}.`);return;}
     for(const e of entries){if(items.size>=350)break;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file,kind,depth+1);else if(e.isFile()&&e.name.endsWith('.md')&&(kind!=='story'||/^story[-_]/i.test(e.name)))await add(file,kind);}
   };
   await walk(path.join(root,'production/epics'),'story');
   for(const dir of ['docs/product','docs/architecture','docs/operations','design/gdd','production/evidence','production/qa/evidence'])await walk(path.join(root,dir),'document');
   for(const file of ['CLAUDE.md','project.yaml','production/state.yaml','production/session-state/active.md']){if(await readOptional(path.join(root,file))!==null)await add(path.join(root,file),'configuration');}
   const documentation=[];
   for(const sourcePath of [...new Set([...(profile.documentationIndexes||[]),'design/gdd/systems-index.md','docs/documentation-index.md'])]){
     const candidate=path.resolve(root,sourcePath);if(!candidate.startsWith(root+path.sep))continue;
     const indexResource=artifacts.find(a=>a.path===sourcePath);if(!indexResource)continue;
     let content;try{if((await stat(candidate)).size>512*1024)continue;content=await readOptional(candidate);}catch{continue;}
     for(const item of documentationIndex(content||'',sourcePath)){if(documentation.some(d=>d.path===item.path))continue;const resource=artifacts.find(a=>a.path===item.path);documentation.push({...item,id:resource?.id||indexResource.id,kind:'documentation',epic:'Documentação',modifiedAt:resource?.modifiedAt||indexResource.modifiedAt,owner:null,checks:{done:0,total:0},available:!!resource});}
   }
   const counts={backlog:0,ready:0,in_progress:0,blocked:0,review:0,done:0,unknown:0};for(const s of stories)counts[s.status]++;
   let workflowPosition=null;const workflow=profile.workflowProgress;const workflowValue=workflow?(valueAt(workflow.configKey)||(workflow.fallbackToRigor?rigor:null)):null;if(workflow&&workflowValue===workflow.value)workflowPosition=stories.length?`${workflow.label} · ${counts.done}/${stories.length} stories`:`${workflow.label} · ${workflow.emptyLabel}`;
   let telemetry=null;
   if(provider==='claude'&&typeof sessionId==='string'&&/^[\w-]{1,128}$/.test(sessionId)){
     try{const file=path.join(root,'.studio/runtime/statusline',sessionId+'.json');const canonical=await realpath(file);if(!canonical.startsWith(root+path.sep))throw new Error('Telemetria fora do projeto.');const record=JSON.parse(await readFile(canonical,'utf8'));if(record.sessionId===sessionId&&record.projectPath===root&&record.schemaVersion===1)telemetry=record;}catch{}
   }
   if(typeof sessionId==='string'&&/^[\w-]{1,128}$/.test(sessionId)){
     try{const file=await realpath(path.join(root,'.studio/runtime/statusline-sdk',...(provider==='claude'?[]:[provider]),sessionId+'.json'));if(file.startsWith(root+path.sep)){const record=JSON.parse(await readFile(file,'utf8'));if(record.sessionId===sessionId&&record.projectPath===root&&record.schemaVersion===1&&record.source==='studio-sdk'&&(record.provider||'claude')===provider&&(!telemetry||Date.parse(record.writtenAt)>Date.parse(telemetry.writtenAt)))telemetry=record;}}catch{}
   }
   let bridgeEnabled=false;
   try{const settings=JSON.parse(await readFile(path.join(root,'.claude/settings.json'),'utf8'));bridgeEnabled=/\.studio\/(?:statusline-bridge|studio-statusline)\.py/.test(settings.statusLine?.command||'');}catch{}
   let statuslineDiagnostic={code:telemetry?'current-session':bridgeEnabled?'awaiting-session':'not-connected',message:telemetry?'Statusline recebida para a sessão atual.':bridgeEnabled?'Nenhuma medição da statusline para a sessão atual.':'A ponte da statusline ainda não está conectada neste projeto.'};
   if(!telemetry&&bridgeEnabled){try{const files=await readdir(path.join(root,'.studio/runtime/statusline'));if(files.some(name=>/^[\w-]+\.json$/.test(name)&&name!==sessionId+'.json'))statuslineDiagnostic={code:'other-session',message:'Existem medições de outra sessão. Elas não são usadas como contexto da sessão atual.'};}catch{}}
   this.items=items;
   return {root,template,stage,stageSource,workflowPosition,rigor,stack:metadata.engine,breadcrumb,activity,documentation,stories,counts,total:stories.length,completion:stories.length?Math.round(counts.done/stories.length*100):null,artifacts,telemetry,bridgeEnabled,statuslineDiagnostic,warnings,updatedAt:Date.now()};
 }
 async read(id,currentRoot){if(typeof currentRoot!=='string')throw new Error('Conecte um projeto antes de abrir documentos.');try{currentRoot=await realpath(currentRoot);}catch{throw new Error('Atualize a visão do projeto e escolha um arquivo listado.');}const item=this.items.get(id);if(!item||item.root!==currentRoot)throw new Error('Atualize a visão do projeto e escolha um arquivo listado.');const canonical=await realpath(item.file);if(!canonical.startsWith(currentRoot+path.sep)||(await stat(canonical)).size>512*1024)throw new Error('Arquivo indisponível para leitura.');return {path:item.file,body:await readFile(item.file,'utf8')};}
}
