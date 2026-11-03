import {access,stat,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
const execute=promisify(execFile);
export const PROVIDERS={claude:{id:'claude',name:'Claude Code',command:'claude'},codex:{id:'codex',name:'OpenAI · Codex',command:'codex'},gemini:{id:'gemini',name:'Google · Antigravity (AGY)',command:'agy'}};
export function providerEnvironment(provider,base=process.env){
 const env={...base};for(const key of Object.keys(env))if(/^(ANTHROPIC_|OPENAI_API_KEY$|CODEX_API_KEY$|OPENAI_BASE_URL$|GEMINI_API_KEY$|GOOGLE_API_KEY$|GOOGLE_GENAI_USE_|GOOGLE_APPLICATION_CREDENTIALS$|CLAUDE_CODE_OAUTH_TOKEN|CLAUDECODE$|CLAUDE_CODE_SESSION_ACCESS_TOKEN)/.test(key))delete env[key];
 env.PATH=[base.PATH,path.join(base.HOME||os.homedir(),'.local/bin'),'/opt/homebrew/bin','/usr/local/bin'].filter(Boolean).join(path.delimiter);
 // Each official CLI reads its own local login; credentials never enter the renderer.
 if(provider!=='claude'){delete env.CLAUDE_CONFIG_DIR;delete env.CLAUDE_CODE_EFFORT_LEVEL;}
 return env;
}
export async function findProviderCli(provider,{env=process.env,home=os.homedir(),platform=process.platform}={}){
 const command=PROVIDERS[provider]?.command;if(!command)throw new Error('Executor inválido.');
 const names=platform==='win32'?[command+'.exe',command+'.com']:[command];
 const directories=[path.join(home,'.local/bin'),'/opt/homebrew/bin','/usr/local/bin',...(env.PATH||'').split(platform==='win32'?';':path.delimiter).filter(Boolean)];
 for(const candidate of [env[`STUDIO_${command.toUpperCase()}_PATH`],...directories.flatMap(dir=>names.map(name=>path.join(dir,name)))].filter(Boolean)){if(platform==='win32'&&/\.(?:cmd|bat)$/i.test(candidate))continue;try{await access(candidate,constants.X_OK);return candidate;}catch{}}
 return null;
}
export async function inspectProvider(provider,{env=process.env,home=os.homedir(),executeCommand=execute}={}){
 const binary=await findProviderCli(provider,{env,home}),result={...PROVIDERS[provider],available:!!binary,loggedIn:false,authState:'missing',binary};if(!binary)return {...result,error:`${PROVIDERS[provider].command} não encontrado. Instale o programa oficial e atualize a conexão.`};
 if(provider==='codex'){
  try{const auth=await executeCommand(binary,['login','status'],{env:providerEnvironment(provider,env),timeout:10000,maxBuffer:65536});if(/api[ -]?key/i.test((auth.stdout||'')+(auth.stderr||'')))return {...result,error:'Este login do Codex usa uma chave de API. Entre com ChatGPT para usar a conexão por login.'};return {...result,loggedIn:true,authState:'verified'};}catch{return {...result,error:'Entre no Codex com sua conta ChatGPT e clique em verificar.'};}
 }
 if(provider==='gemini'){
  // Only inspect cache metadata; AGY owns credentials and validates them at execution.
  try{const credentials=await stat(path.join(home,'.gemini/antigravity-cli/antigravity-oauth-token'));if(credentials.isFile()&&credentials.size>0)return {...result,loggedIn:true,authState:'cached'};}catch{}
  return {...result,error:'Abra o AGY, entre com Google e clique em verificar. O login será validado pelo programa ao executar.'};
 }
 return result;
}
export function loginCommand(provider,binary){if(!['codex','gemini'].includes(provider)||!binary)throw new Error('Executor indisponível.');const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";return quote(binary)+(provider==='codex'?' login':'');}
