import {parseDocument,isMap} from 'yaml';
export const modelPolicy={mode:'inherit-session',version:1};
export const modelInstructions=`## Política de modelos do Studio

Papéis, skills e workflows definem responsabilidades, não marcas ou versões de modelos.
Os agentes herdam o modelo escolhido para a sessão. Skills não trocam esse modelo.
Ao delegar, omita a escolha de modelo e deixe o executor herdar a sessão; só use outro
modelo quando o usuário pedir explicitamente. Recomendações de Opus, Sonnet ou Haiku
nos documentos históricos do template não substituem esta política.
O esforço de raciocínio é uma configuração separada, sujeita ao suporte do executor.
O Studio adapta estas definições para Claude Code, Codex e Gemini CLI. Cada executor mantém suas próprias ferramentas e políticas.
`;
export function adaptTemplateModels(relative,buffer){
 const agent=/^\.claude\/agents\/[^/]+\.md$/.test(relative);
 const skill=/^\.claude\/skills\/.+\/SKILL\.md$/.test(relative)||/^\.claude\/commands\/.+\.md$/.test(relative);
 if(!agent&&!skill)return buffer;
 const text=buffer.toString(),match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
 if(!match)throw new Error(`A definição ${relative} não tem metadados válidos.`);
 const doc=parseDocument(match[1]);if(doc.errors.length||!isMap(doc.contents))throw new Error(`Metadados inválidos em ${relative}.`);
 if(agent){if(doc.get('model')==='inherit')return buffer;doc.set('model','inherit');}
 else{if(!doc.has('model'))return buffer;doc.delete('model');}
 return Buffer.from(`---\n${doc.toString()}---${text.slice(match[0].length)}`);
}
export function appendModelPolicy(buffer){
 const start='<!-- studio-model-policy -->',end='<!-- /studio-model-policy -->';
 const block=`${start}\n${modelInstructions}${end}`;
 const text=buffer.toString();const from=text.indexOf(start),to=text.indexOf(end,from);
 if(from!==-1&&to!==-1)return Buffer.from(text.slice(0,from)+block+text.slice(to+end.length));
 return Buffer.from(text+`${text.endsWith('\n')?'':'\n'}\n${block}\n`);
}
