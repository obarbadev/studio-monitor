import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {StudioInventory,parseDefinition} from '../electron/inventory.mjs';
test('parses agent instructions and structured skill/tool declarations',()=>{const parsed=parseDefinition('---\nname: designer\ndescription: |\n  Planeja o jogo.\nmodel: opus\ntools: Read, Edit\nskills:\n  - art-bible\n  - brainstorm\n---\n# Instruções\nRespeite o briefing.','fallback');assert.equal(parsed.name,'designer');assert.equal(parsed.model,'opus');assert.deepEqual(parsed.skills,['art-bible','brainstorm']);assert.deepEqual(parsed.tools,['Read','Edit']);assert.match(parsed.body,/Respeite/);});
test('indexes project, account and plugin definitions without exposing arbitrary paths',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'studio-inventory-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=path.join(root,'game'),account=path.join(root,'profile'),plugin=path.join(root,'plugin');
 async function file(name,content){await mkdir(path.dirname(name),{recursive:true});await writeFile(name,content);}
 await file(path.join(account,'agents/designer.md'),'---\nname: designer\nmodel: sonnet\n---\nConta');
 await file(path.join(project,'.claude/agents/designer.md'),'---\nname: designer\nmodel: opus\nskills: [brainstorm]\n---\nProjeto');
 await file(path.join(project,'.claude/skills/brainstorm/SKILL.md'),'---\nname: brainstorm\ndescription: Criar ideias\n---\nFaça perguntas primeiro.');
 await file(path.join(project,'.claude/rules/code.md'),'---\npaths: ["src/**"]\n---\nNão use valores mágicos.');
 await file(path.join(project,'CLAUDE.md'),'# Studio\nInstruções gerais.');
 await file(path.join(plugin,'skills/review/SKILL.md'),'---\nname: review\n---\nRevise o projeto.');
 const index=new StudioInventory();const result=await index.scan({projectPath:project,configDir:account,plugins:[{name:'studio-tools',path:plugin}]});
 assert.equal(result.resources.length,6);assert.equal(result.resources.filter(r=>r.kind==='instruction').length,2);
 const designers=result.resources.filter(r=>r.kind==='agent');assert.equal(designers.find(r=>r.scope==='Conta').shadowed,true);assert.equal(designers.find(r=>r.scope==='Projeto').shadowed,false);
 assert.ok(result.resources.some(r=>r.name==='studio-tools:review'));
 const skill=result.resources.find(r=>r.name==='brainstorm');assert.match((await index.read(skill.id)).body,/perguntas/);
 await assert.rejects(()=>index.read('../../credentials'),/Atualize a biblioteca/);
});
test('reports oversized definition files instead of loading them',async t=>{const root=await mkdtemp(path.join(os.tmpdir(),'studio-inventory-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'agents'));await writeFile(path.join(root,'agents/huge.md'),'x'.repeat(512*1024+1));const result=await new StudioInventory().scan({configDir:root});assert.equal(result.resources.length,0);assert.equal(result.warnings.length,1);});

test('separates template skills from project skills using installation ownership, including custom overrides',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'studio-origins-'));t.after(()=>rm(root,{recursive:true,force:true}));const {createHash}=await import('node:crypto');
 const names=['template-skill','project-skill','customized-template','preserved-project'];const content=name=>`---\nname: ${name}\n---\nOriginal instructions`;
 for(const name of names){const dir=path.join(root,'.claude/skills',name);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'SKILL.md'),content(name));}
 await mkdir(path.join(root,'.studio'));await writeFile(path.join(root,'.studio/template.json'),JSON.stringify({id:'factory',name:'Fábrica',files:names.filter(n=>n!=='project-skill').map(name=>({path:`.claude/skills/${name}/SKILL.md`,sourceHash:createHash('sha256').update(content(name)).digest('hex'),preserved:name==='preserved-project'}))}));
 await writeFile(path.join(root,'.claude/skills/customized-template/SKILL.md'),content('customized-template')+'\nUser changes');
 const result=await new StudioInventory().scan({projectPath:root});const find=name=>result.resources.find(r=>r.name===name);
 assert.equal(find('template-skill').origin.type,'template');assert.equal(find('template-skill').origin.modified,false);assert.equal(find('customized-template').origin.type,'template');assert.equal(find('customized-template').origin.modified,true);assert.equal(find('project-skill').origin.type,'project');assert.equal(find('preserved-project').origin.type,'project');assert.equal(result.template.id,'factory');
});
