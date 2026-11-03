import {useEffect,useState} from 'react';
import {Activity,Command} from 'lucide-react';
import type {State} from './types';
export function ExecutionActivity({state}:{state:State}){
 const [started]=useState(Date.now());const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const agents=state.agents.filter(a=>a.status==='running');
 const title=state.stopping?'Interrompendo a execução…':state.permission?(state.permission.tool==='AskUserQuestion'?'Aguardando sua resposta':'Aguardando sua aprovação'):state.mainTool?`Executando ${state.mainTool}`:agents.length?`Coordenando ${agents.length} ${agents.length===1?'agente':'agentes'}`:'Preparando a próxima resposta';
 const elapsed=Math.max(0,Math.floor((now-started)/1000));
 return <div className="execution-activity" role="status" aria-live="polite"><div className="execution-heading"><Activity size={15}/><strong>{title}</strong><time aria-hidden="true">{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,'0')}</time></div><div className={`execution-progress ${state.permission?'paused':''}`}><i/></div>{agents.slice(-3).map(a=><div className="execution-agent" key={a.id}><Command size={11}/><span>{a.name}</span><small>{state.permission?.agentId===a.id?'Aguardando você':a.activity==='tool-error'?`Falha em ${a.tool}`:a.activity==='tool'?`Executando ${a.tool}`:'Processando a tarefa'}</small></div>)}<small className="execution-note">{state.stopping?'Aguardando o encerramento dos processos. O histórico será preservado.':state.permission?'Responda abaixo para continuar.':'A atividade será atualizada enquanto o agente trabalha.'}</small></div>;
}
