import {useEffect,useState} from 'react';
import type {State} from './types';
export type SlashCommand={name:string;description:string;origin:string};
export function useSlashCommands(state:State,open=false){
 const [local,setLocal]=useState<SlashCommand[]>([]);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;setLocal([]);const load=async()=>{if(!state.project)return;try{const index=await window.studio?.inventory();if(active&&index){setLocal(index.resources.filter(r=>r.kind==='skill'&&!r.shadowed).map(r=>({name:'/'+r.name.replace(/^\//,''),description:r.description,origin:r.origin?.type==='template'?`Template · ${r.origin.templateName}`:r.scope})));setError(index.warnings.join(' '));}}catch(e){if(active)setError('Não foi possível listar as skills: '+(e as Error).message);}};void load();const timer=open?setInterval(load,4000):undefined;return()=>{active=false;clearInterval(timer);};},[state.project?.path,state.project?.template?.version,state.activeAccountId,state.provider,state.runtimeCatalog?.updatedAt,open]);
 const commands=new Map<string,SlashCommand>();
 for(const name of [...(state.project?.template?.suggestedCommands||[]),...(state.runtimeCatalog?.commands||[]),...(state.runtimeCatalog?.skills||[])]){if(typeof name!=='string')continue;const normalized='/'+name.replace(/^\//,'');commands.set(normalized,{name:normalized,description:'Comando disponível na sessão',origin:'Claude Code'});}
 for(const item of local)commands.set(item.name,item);
 if(!commands.has('/clear'))commands.set('/clear',{name:'/clear',description:'Iniciar uma nova conversa neste projeto',origin:'Studio'});
 return {commands:[...commands.values()].sort((a,b)=>a.name.localeCompare(b.name)),error};
}
export function SlashCommands({items,index,onSelect}:{items:SlashCommand[];index:number;onSelect:(command:SlashCommand)=>void}){useEffect(()=>{document.querySelector('.slash-menu [aria-selected="true"]')?.scrollIntoView({block:'nearest'});},[index]);return <div className="slash-menu" role="listbox" aria-label="Comandos disponíveis"><div className="slash-menu-heading">COMANDOS <small>↑ ↓ navegar · Tab completar · Enter enviar</small></div>{items.length?items.map((command,i)=><button type="button" role="option" aria-selected={index===i} className={index===i?'selected':''} key={command.name} onMouseDown={e=>e.preventDefault()} onClick={()=>onSelect(command)}><span><strong>{command.name}</strong><small>{command.description||'Skill do projeto'}</small></span><em>{command.origin}</em></button>):<p>Nenhum comando encontrado. Você ainda pode escrever o comando completo.</p>}</div>;}
