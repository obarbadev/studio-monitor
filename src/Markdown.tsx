import {useState,memo,Children,isValidElement,type ReactNode} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Check,Copy,ExternalLink} from 'lucide-react';
function CodeBlock({children}:{children?:ReactNode}){
 const [copied,setCopied]=useState(false);const child=Children.toArray(children)[0];
 const props=isValidElement<{children?:ReactNode;className?:string}>(child)?child.props:null;
 const code=String(props?.children||'');const language=props?.className?.replace('language-','')||'código';
 return <div className="code-block"><div className="code-toolbar"><span>{language}</span><button onClick={async()=>{try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}}>{copied?<Check size={12}/>:<Copy size={12}/>} {copied?'Copiado':'Copiar'}</button></div><pre>{children}</pre></div>;
}
export const Markdown=memo(function Markdown({text}:{text:string}){return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{pre:CodeBlock,a:({href,children})=><a href={href} onClick={e=>{e.preventDefault();if(href&&/^https?:\/\//i.test(href))void window.studio?.openLink(href);}}>{children}<ExternalLink size={10}/></a>,img:({alt})=><span className="markdown-image">Imagem: {alt||'sem descrição'}</span>,table:({children})=><div className="markdown-table"><table>{children}</table></div>}}>{text}</ReactMarkdown></div>});
