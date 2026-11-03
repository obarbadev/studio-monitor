import {readdir,readFile,writeFile,stat,lstat,mkdir,realpath,open,unlink,rename,chmod} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {compileTemplateCore} from './template-core.mjs';
import {adaptTemplateModels,appendModelPolicy,modelPolicy,modelInstructions} from './template-models.mjs';
const shellQuote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
const hash=data=>createHash('sha256').update(data).digest('hex');
const equal=(a,b)=>a!==null&&a.equals(b);
async function existing(file){try{return await readFile(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function safeDestination(root,relative){
 if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p==='..'||p==='.git')||relative.includes('\0'))throw new Error('Caminho inválido no template.');
 const destination=path.resolve(root,relative);if(!destination.startsWith(root+path.sep))throw new Error('Arquivo fora do projeto.');
 let current=root;for(const component of path.relative(root,destination).split(path.sep)){current=path.join(current,component);try{if((await lstat(current)).isSymbolicLink())throw new Error(`O destino ${relative} é um link simbólico. Selecione uma pasta sem links conflitantes.`);}catch(e){if(e.code==='ENOENT')break;throw e;}}
 return destination;
}
export function mergeTemplateSettings(current,incoming,{hooksAllowed=true,statusAllowed=true}={}){
 const result=structuredClone(current);const unique=(a,b)=>[...new Map([...a,...b].map(v=>[JSON.stringify(v),v])).values()];
 for(const [key,value] of Object.entries(incoming)){
   if(key==='hooks'){if(!hooksAllowed)continue;result.hooks??={};for(const [event,entries] of Object.entries(value))result.hooks[event]=unique(result.hooks[event]||[],entries);}
   else if(key==='permissions'){
     if(!result.permissions){result.permissions=structuredClone(value);continue;}
     for(const list of ['deny','ask'])if(Array.isArray(value[list]))result.permissions[list]=unique(result.permissions[list]||[],value[list]);
     // Existing allow/defaultMode choices are owned by the project.
   } else if(key==='statusLine'){if(statusAllowed&&result.statusLine===undefined)result.statusLine=value;}
   else if(result[key]===undefined)result[key]=value;
 }
 return result;
}
export class TemplateManager{
 constructor(directory){this.directory=directory;this.plans=new Map();}
 async list(){
   const result=[];for(const entry of await readdir(this.directory,{withFileTypes:true})){if(!entry.isDirectory()||entry.name==='shared')continue;const manifest=JSON.parse(await readFile(path.join(this.directory,entry.name,'template.json'),'utf8'));if(manifest.id!==entry.name)throw new Error('Identificador inválido no catálogo de templates.');let agents=0,skills=0;try{agents=(await readdir(path.join(this.directory,entry.name,'files/.claude/agents'))).filter(f=>f.endsWith('.md')).length;}catch{}try{skills=(await readdir(path.join(this.directory,entry.name,'files/.claude/skills'))).length;}catch{}result.push({...manifest,agents,skills});}return result;
 }
 async preview(id,target){
   const catalog=await this.list(),template=catalog.find(t=>t.id===id);if(!template)throw new Error('Template não encontrado.');
   const root=await realpath(target);if(!(await stat(root)).isDirectory())throw new Error('Selecione uma pasta de projeto.');
   const oldManifest=await existing(await safeDestination(root,'.studio/template.json'));
   if(oldManifest){const installed=JSON.parse(oldManifest);if(installed.id!==id)throw new Error(`Este projeto já usa o template ${installed.name||installed.id}. Use outra pasta para instalar um template diferente.`);}
   const source=path.join(this.directory,id,'files');const entries=[];
   const walk=async(dir,prefix='')=>{for(const e of await readdir(dir,{withFileTypes:true})){const relative=path.posix.join(prefix,e.name);if(e.isSymbolicLink())throw new Error('O pacote do template contém um link não suportado.');if(e.isDirectory())await walk(path.join(dir,e.name),relative);else if(e.isFile())entries.push({relative,after:await readFile(path.join(dir,e.name)),mode:e.name.endsWith('.sh')?0o755:0o644});}};
   await walk(source);
   for(const entry of entries)entry.after=adaptTemplateModels(entry.relative,entry.after);
   const tiers=entries.find(e=>e.relative==='.claude/docs/model-tiers.md');if(tiers)tiers.after=Buffer.from(modelInstructions);

   const bridge=await readFile(path.join(this.directory,'shared/statusline-bridge.py'));
   entries.push({relative:'.studio/statusline-bridge.py',after:bridge,mode:0o644});
   const licence=await readFile(path.join(source,'LICENSE'));entries.push({relative:`.studio/licenses/${id}.txt`,after:licence,mode:0o644});
   const changes=[];const warnings=['Agentes e skills usam o modelo da sessão. Referências históricas a famílias de modelos não alteram essa escolha.'];
   const managed=oldManifest?JSON.parse(oldManifest).files||[]:[];

   for(const entry of entries){const destination=await safeDestination(root,entry.relative);const before=await existing(destination);let action=before===null?'create':equal(before,entry.after)?'identical':'preserve';const previous=managed.find(f=>f.path===entry.relative);if(action==='preserve'&&previous&&!previous.preserved&&hash(before)===previous.sourceHash&&(/^\.claude\/(agents|skills|commands)\//.test(entry.relative)||['.claude/docs/model-tiers.md','.studio/template-core.json'].includes(entry.relative)))action='merge';changes.push({...entry,destination,before,action});}
   const hookConflict=changes.some(c=>c.action==='preserve'&&c.relative.startsWith('.claude/hooks/'));
   const statusConflict=changes.some(c=>c.action==='preserve'&&['.claude/statusline.sh','.studio/statusline-bridge.py'].includes(c.relative));
   if(hookConflict)warnings.push('Há scripts de hooks próprios. Os novos hooks não serão ativados; os existentes serão preservados.');
   if(statusConflict)warnings.push('Há uma statusline própria ou ponte conflitante. A configuração atual será preservada.');
   const settings=changes.find(c=>c.relative==='.claude/settings.json');
   if(settings){
     const incoming=JSON.parse(settings.after);const originalStatus=incoming.statusLine;
     if(originalStatus&&!statusConflict)incoming.statusLine={...originalStatus,refreshInterval:5,command:`python3 "$CLAUDE_PROJECT_DIR/.studio/statusline-bridge.py" -- ${shellQuote(originalStatus.command)}`};
     if(settings.before){try{const current=JSON.parse(settings.before);const merged=mergeTemplateSettings(current,incoming,{hooksAllowed:!hookConflict,statusAllowed:!statusConflict});settings.after=Buffer.from(JSON.stringify(merged,null,2)+'\n');settings.action=equal(settings.before,settings.after)?'identical':'merge';if(current.statusLine)warnings.push('A statusline já configurada foi preservada. Você pode conectá-la à telemetria na visão do projeto.');}catch{settings.action='preserve';warnings.push('As configurações existentes não são JSON simples. Elas serão preservadas; revise manualmente os hooks e a statusline do template.');}}
     else{if(hookConflict)delete incoming.hooks;if(statusConflict)delete incoming.statusLine;settings.after=Buffer.from(JSON.stringify(incoming,null,2)+'\n');}
   }
   const instructions=changes.find(c=>c.relative==='CLAUDE.md');
   if(instructions?.action==='preserve'){
     const marker=`<!-- studio-template:${id} -->`;
     if(instructions.before.toString().includes(marker)){instructions.after=instructions.before;instructions.action='identical';}
     else{instructions.after=Buffer.from(instructions.before.toString()+`\n\n${marker}\n`+instructions.after.toString()+`\n<!-- /studio-template:${id} -->\n`);instructions.action='merge';}
   }
   if(instructions){instructions.after=appendModelPolicy(instructions.after);instructions.action=instructions.before===null?'create':equal(instructions.before,instructions.after)?'identical':'merge';}
   const pinned=changes.filter(c=>c.action==='preserve'&&/^\.claude\/(agents|skills|commands)\//.test(c.relative));
   if(pinned.length)warnings.push(`${pinned.length} definições personalizadas foram preservadas e podem manter escolhas próprias de modelo.`);
   const ignore=changes.find(c=>c.relative==='.gitignore');const ignoreBase=ignore?.before||ignore?.after||Buffer.from('');
   const ignoreLines=['.studio/runtime/','.studio/install.lock'];let ignoreText=ignoreBase.toString();for(const line of ignoreLines)if(!ignoreText.split(/\r?\n/).includes(line))ignoreText+=`${ignoreText.endsWith('\n')?'':'\n'}${line}\n`;
   if(ignore){ignore.after=Buffer.from(ignoreText);ignore.action=ignore.before===null?'create':equal(ignore.before,ignore.after)?'identical':'merge';}
   else changes.push({relative:'.gitignore',destination:await safeDestination(root,'.gitignore'),before:await existing(path.join(root,'.gitignore')),after:Buffer.from(ignoreText),action:ignoreBase.length?'merge':'create',mode:0o644});
   const corePath=await safeDestination(root,'.studio/template-core.json'),coreBefore=await existing(corePath);
   const coreAfter=Buffer.from(JSON.stringify(compileTemplateCore(changes.filter(c=>!c.relative.startsWith('.studio/')).map(c=>({relative:c.relative,after:c.action==='preserve'?c.before:c.after})),template),null,2)+'\n');
   const previousCore=managed.find(f=>f.path==='.studio/template-core.json');
   const coreAction=coreBefore===null?'create':equal(coreBefore,coreAfter)?'identical':previousCore&&!previousCore.preserved&&hash(coreBefore)===previousCore.sourceHash?'merge':'preserve';
   changes.push({relative:'.studio/template-core.json',destination:corePath,before:coreBefore,after:coreAfter,action:coreAction,mode:0o644});
   if(coreAction==='preserve')warnings.push('A definição neutra da equipe foi personalizada e será preservada. Revise sua compatibilidade com os arquivos do projeto.');
   const installed=oldManifest?JSON.parse(oldManifest):null;
   const manifest={schemaVersion:1,id,name:template.name,version:template.version,modelPolicy,execution:template.execution||null,source:template.source||null,monitor:template.monitor||null,suggestedCommands:template.suggestedCommands||[],installedAt:installed?.installedAt||new Date().toISOString(),files:changes.map(c=>{const previous=managed.find(f=>f.path===c.relative);const origin=previous?.origin||(previous&&!previous.preserved?'template':c.action==='preserve'?'project':'template');return {path:c.relative,sourceHash:c.action==='preserve'&&origin==='template'&&previous?previous.sourceHash:hash(c.after),preserved:c.action==='preserve',origin};})};
   changes.push({relative:'.studio/template.json',destination:path.join(root,'.studio/template.json'),before:oldManifest,after:Buffer.from(JSON.stringify(manifest,null,2)+'\n'),action:oldManifest?'merge':'create',mode:0o644});
   const preserved=changes.filter(c=>c.action==='preserve');if(preserved.length)warnings.push(`${preserved.length} arquivos diferentes serão preservados. A instalação pode exigir ajustes nesses arquivos.`);
   const token=randomUUID();this.plans.set(token,{root,template,changes,warnings,createdAt:Date.now()});
   return {token,target:root,template,files:changes.map(({relative,action})=>({path:relative,action})),warnings};
 }
 async previewStatusline(target,{studio=false}={}){
   const bridgeName=studio?'studio-statusline.py':'statusline-bridge.py';
   const root=await realpath(target),changes=[];
   const settingsPath=await safeDestination(root,'.claude/settings.json');const before=await existing(settingsPath);
   let settings;try{settings=before?JSON.parse(before):{};}catch{throw new Error('As configurações atuais não são JSON simples. Conecte a statusline manualmente conforme a documentação.');}
   if(settings.statusLine?.type&&settings.statusLine.type!=='command')throw new Error('O tipo de statusline existente não pode ser conectado automaticamente.');
   const original=settings.statusLine?.command||'';
   const bridgePath=await safeDestination(root,'.studio/'+bridgeName);const bridgeBefore=await existing(bridgePath);const bridge=await readFile(path.join(this.directory,'shared/'+bridgeName));
   if(bridgeBefore&&!equal(bridgeBefore,bridge))throw new Error('A ponte local foi personalizada. Revise esse arquivo antes de ativar outra versão.');
   if(!original.includes('.studio/'+bridgeName))settings.statusLine={...settings.statusLine,type:'command',refreshInterval:settings.statusLine?.refreshInterval||5,command:`python3 "$CLAUDE_PROJECT_DIR/.studio/${bridgeName}"${original?' -- '+shellQuote(original):''}`};
   const settingsAfter=Buffer.from(JSON.stringify(settings,null,2)+'\n');
   changes.push({relative:'.claude/settings.json',destination:settingsPath,before,after:settingsAfter,action:before===null?'create':equal(before,settingsAfter)?'identical':'merge',mode:0o644});
   changes.push({relative:'.studio/'+bridgeName,destination:bridgePath,before:bridgeBefore,after:bridge,action:bridgeBefore?'identical':'create',mode:0o644});
   const ignorePath=await safeDestination(root,'.gitignore'),ignoreBefore=await existing(ignorePath);let text=ignoreBefore?.toString()||'';
   for(const line of ['.studio/runtime/','.studio/install.lock'])if(!text.split(/\r?\n/).includes(line))text+=`${text.endsWith('\n')?'':'\n'}${line}\n`;
   const after=Buffer.from(text);changes.push({relative:'.gitignore',destination:ignorePath,before:ignoreBefore,after,action:ignoreBefore===null?'create':equal(ignoreBefore,after)?'identical':'merge',mode:0o644});
   const token=randomUUID(),template={id:studio?'studio-statusline':'statusline-telemetry',name:studio?'Studio Statusline':'Telemetria da statusline',version:'1'};
   const warnings=[...(studio?['A statusline do Studio será exibida antes da saída existente.']:[]),'A saída original do terminal será mantida. Apenas métricas públicas serão gravadas em .studio/runtime, sem prompts ou credenciais.'];
   this.plans.set(token,{root,template,changes,warnings,createdAt:Date.now()});
   return {token,target:root,template,files:changes.map(c=>({path:c.relative,action:c.action})),warnings,originalStatusline:original};
 }
 async install(token){
   const plan=this.plans.get(token);if(!plan||Date.now()-plan.createdAt>30*60*1000)throw new Error('A prévia expirou. Revise a instalação novamente.');
   const {root,changes}=plan;
   for(const c of changes){await safeDestination(root,c.relative);const current=await existing(c.destination);if(c.before===null?current!==null:!equal(current,c.before))throw new Error(`O arquivo ${c.relative} mudou desde a prévia. Revise novamente.`);}
   await mkdir(await safeDestination(root,'.studio'),{recursive:true});const lockPath=await safeDestination(root,'.studio/install.lock');
   let lock;try{lock=await open(lockPath,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new Error('Já existe uma instalação em andamento neste projeto.');throw e;}
   const written=[];
   try{
     for(const c of changes.filter(c=>['create','merge'].includes(c.action))){
       await safeDestination(root,c.relative);const current=await existing(c.destination);if(c.before===null?current!==null:!equal(current,c.before))throw new Error(`${c.relative} foi alterado durante a instalação.`);
       await mkdir(path.dirname(c.destination),{recursive:true});
       if(c.before===null)await writeFile(c.destination,c.after,{flag:'wx',mode:c.mode});
       else{const temp=c.destination+`.studio-${randomUUID()}.tmp`;try{await writeFile(temp,c.after,{flag:'wx',mode:(await stat(c.destination)).mode&0o777});await rename(temp,c.destination);}finally{await unlink(temp).catch(()=>{});}}
       written.push(c);
     }
     this.plans.delete(token);return {template:plan.template,target:root,created:written.filter(c=>c.action==='create').length,merged:written.filter(c=>c.action==='merge').length,preserved:changes.filter(c=>c.action==='preserve').length,warnings:plan.warnings};
   }catch(e){
     const unrestored=[];
     for(const c of written.reverse()){try{if(!equal(await existing(c.destination),c.after)){unrestored.push(c.relative);continue;}if(c.before===null)await unlink(c.destination);else await writeFile(c.destination,c.before);}catch{unrestored.push(c.relative);}}
     if(unrestored.length)throw new Error(`${e.message} Alguns arquivos foram alterados externamente e não foram revertidos: ${unrestored.join(', ')}.`);throw e;
   }finally{await lock.close();await unlink(lockPath).catch(()=>{});}
 }
}
