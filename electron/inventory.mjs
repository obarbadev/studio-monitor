import {readdir,readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'yaml';
const LIMIT=512*1024;
export function parseDefinition(text,fallbackName){
 let meta={},body=text;
 const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(match){meta=parse(match[1])||{};if(typeof meta!=='object'||Array.isArray(meta))meta={};body=text.slice(match[0].length);}
 const list=value=>Array.isArray(value)?value.map(String):typeof value==='string'?value.split(',').map(v=>v.trim()).filter(Boolean):[];
 return {name:typeof meta.name==='string'?meta.name:fallbackName,description:typeof meta.description==='string'?meta.description:'',model:typeof meta.model==='string'?meta.model:'inherit',tools:list(meta.tools||meta['allowed-tools']),skills:list(meta.skills),paths:list(meta.paths),body};
}
export class StudioInventory {
 constructor(){this.files=new Map();}
 async scan({projectPath,configDir,plugins=[]}){
   const resources=[],warnings=[],files=new Map();let applied=null;const ownership=new Map();
   if(projectPath){try{const manifestPath=path.join(projectPath,'.studio/template.json');if((await stat(manifestPath)).size>LIMIT)throw new Error('too large');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));if(typeof manifest.id!=='string'||typeof manifest.name!=='string'||!Array.isArray(manifest.files))throw new Error('invalid manifest');applied={id:manifest.id,name:manifest.name};for(const file of manifest.files)if(typeof file.path==='string'&&(file.origin==='template'||(!file.origin&&!file.preserved))&&/^[a-f0-9]{64}$/.test(file.sourceHash))ownership.set(file.path,file.sourceHash);}catch(e){if(e.code!=='ENOENT')warnings.push('Não foi possível identificar a origem das definições pelo registro do template.');}}

   const add=async(file,kind,scope,fallback)=>{
     try{
       const info=await stat(file);if(!info.isFile())return;
       if(info.size>LIMIT){warnings.push(`${path.basename(file)} excede 512 KB e não foi indexado.`);return;}
       const content=await readFile(file);const parsed=parseDefinition(content.toString(),fallback||path.basename(file,'.md'));
       let origin={type:scope.startsWith('Plugin · ')?'plugin':scope==='Conta'?'account':'project'};
       if(projectPath&&scope==='Projeto'){const relative=path.relative(projectPath,file).split(path.sep).join('/');const baseline=ownership.get(relative);if(baseline)origin={type:'template',templateId:applied.id,templateName:applied.name,modified:createHash('sha256').update(content).digest('hex')!==baseline};}

       const id=createHash('sha256').update(file).digest('hex').slice(0,24);
       const {body,...metadata}=parsed;
       const name=scope.startsWith('Plugin · ')&&kind!=='instruction'&&!metadata.name.includes(':')?`${scope.slice(9)}:${metadata.name}`:metadata.name;
       resources.push({id,kind,scope,origin,path:file,realPath:await realpath(file),...metadata,name});files.set(id,{file,kind,scope});
     }catch(e){if(e.code!=='ENOENT')warnings.push(`${path.basename(file)}: ${e.code||'metadados inválidos'}`);}
   };
   const walk=async(dir,visit,depth=0)=>{
     if(depth>4)return;
     let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))warnings.push(`Não foi possível ler ${dir}.`);return;}
     for(const entry of entries){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file,visit,depth+1);else if(entry.isFile()&&entry.name.endsWith('.md'))await visit(file);}
   };
   const scope=async(root,label,{plugin=false}={})=>{
     await walk(path.join(root,'agents'),file=>add(file,'agent',label));
     let skills=[];try{skills=await readdir(path.join(root,'skills'),{withFileTypes:true});}catch{}
     for(const skill of skills){if(skill.isDirectory()||skill.isSymbolicLink())await add(path.join(root,'skills',skill.name,'SKILL.md'),'skill',label,skill.name);}
     // Older Claude Code command definitions remain visible as configured skills.
     await walk(path.join(root,'commands'),file=>add(file,'skill',label,path.relative(path.join(root,'commands'),file).replace(/\.md$/,'').split(path.sep).join(':')));
     if(!plugin){await add(path.join(root,'CLAUDE.md'),'instruction',label,'CLAUDE.md');await walk(path.join(root,'rules'),file=>add(file,'instruction',label));}
   };
   if(configDir)await scope(configDir,'Conta');
   for(const plugin of plugins.filter(p=>typeof p.path==='string'&&path.isAbsolute(p.path)))await scope(plugin.path,`Plugin · ${plugin.name||path.basename(plugin.path)}`,{plugin:true});
   if(projectPath){await scope(path.join(projectPath,'.claude'),'Projeto');await add(path.join(projectPath,'CLAUDE.md'),'instruction','Projeto','CLAUDE.md');await add(path.join(projectPath,'CLAUDE.local.md'),'instruction','Projeto local','CLAUDE.local.md');}
   const effective=new Map();for(const r of resources)if(r.kind!=='instruction')effective.set(`${r.kind}:${r.name}`,r.id);
   for(const r of resources)r.shadowed=r.kind!=='instruction'&&effective.get(`${r.kind}:${r.name}`)!==r.id;
   this.files=files;
   return {resources,warnings,template:applied,scannedAt:Date.now()};
 }
 async read(id){
   const item=this.files.get(id);if(!item)throw new Error('Atualize a biblioteca e selecione um arquivo listado.');
   const info=await stat(item.file);if(!info.isFile()||info.size>LIMIT)throw new Error('Arquivo indisponível ou acima de 512 KB.');
   return {...parseDefinition(await readFile(item.file,'utf8'),path.basename(item.file,'.md')),path:item.file};
 }
}
