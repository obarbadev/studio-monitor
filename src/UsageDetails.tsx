import {useEffect,useState} from 'react';
import {Clock3,RefreshCw} from 'lucide-react';
import type {Account} from './types';
export function useClock(){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);return now;}
export function remainingTime(reset:string|null|undefined,now:number){
 if(!reset||!Number.isFinite(Date.parse(reset)))return null;
 const seconds=Math.max(0,Math.ceil((Date.parse(reset)-now)/1000));
 if(!seconds)return 'Aguardando renovação';
 const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
 return `${days?`${days}d `:''}${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}
export function UsageDetails({account,compact=false}:{account?:Account;compact?:boolean}){
 const now=useClock();const usage=account?.usage;
 const age=usage?Math.max(0,Math.floor((now-usage.updatedAt)/1000)):null;
 return <div className={`usage-details ${compact?'compact':''}`}>{[['five_hour','Janela de 5 horas'],['seven_day','Janela semanal']].map(([key,label])=>{
   const window=usage?.windows[key];const used=window?.utilization;const valid=typeof used==='number';const available=valid?Math.max(0,100-used):null;const countdown=remainingTime(window?.resets_at,now);
   return <div className="usage-window" key={key}><div className="usage-window-title"><strong>{label}</strong><span>{valid?`${Math.round(used)}% usado`:'Sem leitura'}</span></div><div className="usage-remaining"><b>{available===null?'—':`${Math.round(available)}%`}</b><span>disponível</span></div><div className="usage-window-bar"><i style={{width:`${available||0}%`}}/></div><div className="reset-countdown"><Clock3 size={11}/><span>{countdown?countdown==='Aguardando renovação'?countdown:`Renova em ${countdown}`:'Horário de renovação indisponível'}</span></div>{window?.resets_at&&<time className="reset-date" dateTime={window.resets_at}>{new Date(window.resets_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · horário local</time>}</div>;
 })}<div className="usage-freshness"><RefreshCw size={10} className={account?.usageLoading?'spinning-icon':''}/>{account?.usageLoading?'Atualizando uso…':age===null?'Aguardando consulta':`Leitura há ${age<60?`${age}s`:`${Math.floor(age/60)}min`}`}<span>· consulta a cada 30s</span></div></div>;
}
