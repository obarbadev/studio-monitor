export function projectActivity({config={},state={},activeText=''}){
 const explicit=state.currentPhase||state.workStage||config.project?.currentPhase||config.project?.workStage;
 const section=activeText.match(/^##\s+(?:Current task|Tarefa atual|Trabalho atual)\s*\r?\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im)?.[1]||'';
 const first=section.match(/^[-*]\s+([\s\S]*?)(?=^[-*]\s|$(?![\s\S]))/m)?.[1]?.trim()||'';
 const task=state.task||(first.match(/^\*\*(.+?)\*\*/)?.[1]||first.split('\n')[0]||null);
 const next=state.nextTask||first.match(/\*\*(?:Next|Próxim[oa])\*\*:\s*(.+)/i)?.[1]||null;
 let phase=typeof explicit==='string'?explicit:null;
 if(!phase&&/(?:\/design-review|\/design-system\s+retrofit|(?:adequa[çc][aã]o|adapta[çc][aã]o|retrofit).{0,100}(?:doc|gdd|sdd|template)|(?:doc|gdd|sdd).{0,100}(?:retrofit|adequa|adapta))/i.test(first))phase='Adequação e revisão da documentação';
 return {phase,task:task?String(task).slice(0,1200):null,next:next?String(next).slice(0,1600):null,source:explicit?(state.currentPhase||state.workStage?'production/state.yaml':'project.yaml'):phase?'Inferido de production/session-state/active.md':task?'production/session-state/active.md':null};
}
export function documentationIndex(text,sourcePath){
 const lines=text.split(/\r?\n/);const result=[];let columns=null;
 const clean=value=>value.replace(/[*`]/g,'').trim();
 for(const line of lines){if(!line.trim().startsWith('|')){columns=null;continue;}const cells=line.trim().replace(/^\||\|$/g,'').split('|').map(clean);
  if(cells.every(c=>/^[-: ]+$/.test(c)))continue;
  if(cells.some(c=>/^(status|estado)$/i.test(c))&&cells.some(c=>/^(design doc|document|documento|arquivo)$/i.test(c))){columns=cells;continue;}
  if(!columns)continue;const get=pattern=>cells[columns.findIndex(c=>pattern.test(c))]||'';
  const rawPath=get(/^(design doc|document|documento|arquivo)$/i);const link=rawPath.match(/\[[^\]]*\]\(([^)]+)\)/)?.[1]||rawPath;
  const rawStatus=get(/^(status|estado)$/i),name=get(/^(system name|system|name|nome|título|title)$/i)||rawPath;
  if(!name||!rawStatus||link.startsWith('/')||link.split(/[\\/]/).includes('..'))continue;
  const documentPath=link.endsWith('.md')?link:`${sourcePath}#${encodeURIComponent(name)}`;
  const key=rawStatus.toLowerCase().replace(/[ _-]+/g,' ');
  const status=({'not started':'backlog',planned:'backlog',backlog:'backlog',draft:'in_progress','in design':'in_progress',designed:'ready','in review':'review','needs revision':'in_progress',approved:'done',done:'done',complete:'done',blocked:'blocked'})[key]||'unknown';
  result.push({name,path:documentPath,status,rawStatus,priority:get(/^(priority|prioridade)$/i)||null,dependencies:get(/^(depends on|dependências|dependencies)$/i)||null,sourcePath});
 }
 return result;
}
