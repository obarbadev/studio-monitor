import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioEngine, cleanEnvironment } from './engine.mjs';
import {SessionBrowser} from './sessions.mjs';
import {UsageMonitor} from './usage.mjs';
import {TemplateManager} from './templates.mjs';
import {ProjectInspector} from './project.mjs';
import {inspectProvider,loginCommand,findProviderCli} from './providers/catalog.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const execute=promisify(execFile);
let window, engine, sessions, usageMonitor, usageTimer, templates, inspector, cliPath, quitting=false;
const logins=new Map();
async function findCli(){return findProviderCli('claude');}

function assertSender(event){if(event.sender!==window?.webContents || event.senderFrame!==window.webContents.mainFrame)throw new Error('Origem não autorizada.');}
function register(name,fn){ipcMain.handle(name,async(event,...args)=>{assertSender(event);try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.message};}});}
async function refreshAccount(account){
  if(!cliPath)throw new Error('Instale o Claude Code para conectar suas assinaturas.');
  try{
    const {stdout}=await execute(cliPath,['auth','status','--json'],{env:cleanEnvironment(process.env,account.configDir),timeout:15000,maxBuffer:1024*1024});
    const status=JSON.parse(stdout);account.loggedIn=status.loggedIn===true && ['claude.ai','oauth_token'].includes(status.authMethod);
    account.email=status.email||null;account.subscription=status.subscriptionType||null;
    if(status.authMethod && !['none','claude.ai','oauth_token'].includes(status.authMethod))account.authError='Este perfil usa API. Entre com uma assinatura Pro/Max.';
    else delete account.authError;
  }catch(e){account.loggedIn=false;account.authError=e.killed?'Verificação de login expirou.':null;}
  engine.publish();await engine.save();return account;
}
async function refreshProviders(){const results=await Promise.allSettled(['codex','gemini'].map(p=>inspectProvider(p)));for(let i=0;i<results.length;i++){const provider=['codex','gemini'][i],result=results[i];engine.state.providers[provider]=result.status==='fulfilled'?result.value:{id:provider,name:provider,available:false,loggedIn:false,authState:'missing',error:result.reason.message};}engine.state.providers.claude={id:'claude',name:'Claude Code',available:!!cliPath,loggedIn:engine.state.accounts.some(a=>a.loggedIn)};engine.publish();return engine.state.providers;}
function getAccount(id){const a=engine.state.accounts.find(a=>a.id===id);if(!a)throw new Error('Conta não encontrada.');return a;}
app.setName('Studio Monitor');
app.whenReady().then(async()=>{
  cliPath=await findCli();
  engine=new StudioEngine({directory:app.getPath('userData'),query,cliPath,enableTeamBridge:true});await engine.load();sessions=new SessionBrowser(engine,path.join(os.homedir(),'.claude'),{envConfig:process.env.CLAUDE_CONFIG_DIR});
  await refreshProviders();
  templates=new TemplateManager(path.join(here,'../templates'));inspector=new ProjectInspector();
  usageMonitor=new UsageMonitor(engine,{query,cliPath,cwd:app.getPath('temp'),env:process.env});
  window=new BrowserWindow({width:1500,height:970,minWidth:1100,minHeight:740,title:'Studio Monitor',backgroundColor:'#101213',titleBarStyle:'hiddenInset',webPreferences:{preload:path.join(here,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(e)=>e.preventDefault());
  engine.on('state',state=>{if(window&&!window.isDestroyed())window.webContents.send('studio:state',state);});
  register('studio:templates',()=>templates.list());
  register('studio:preview-template',async id=>{
    if(engine.state.busy)throw new Error('Aguarde ou interrompa a execução antes de instalar templates.');
    const choice=await dialog.showOpenDialog(window,{title:'Escolha o projeto para instalar o template',defaultPath:engine.state.project?.path,properties:['openDirectory','createDirectory']});
    return choice.canceled?null:templates.preview(id,choice.filePaths[0]);
  });
  register('studio:install-template',async token=>{
    if(engine.state.busy)throw new Error('Aguarde ou interrompa a execução antes de alterar o projeto.');
    const result=await templates.install(token);if(engine.state.project?.path!==result.target)sessions.stop();await engine.connect(result.target);
    engine.event(result.template.id==='statusline-telemetry'?'Telemetria conectada. As métricas aparecerão quando o Claude Code executar a statusline.':`Template ${result.template.name} instalado. Execute ${result.template.entrypoint||'/start'} para configurá-lo.`);
    return result;
  });
  register('studio:project-snapshot',async()=>engine.state.project?{...await inspector.snapshot(engine.state.project.path,engine.state.sessionId,{provider:engine.state.activeProvider||engine.state.provider}),sessionMetrics:engine.state.sessionMetrics||null}:null);
  register('studio:project-file',id=>inspector.read(id,engine.state.project?.path));
  register('studio:preview-statusline',()=>{if(!engine.state.project)throw new Error('Conecte um projeto.');return templates.previewStatusline(engine.state.project.path);});
  register('studio:get',()=>({...engine.state,cliAvailable:!!cliPath}));
  register('studio:inventory',()=>engine.getInventory());
  register('studio:resource',id=>engine.inventory.read(id));
  register('studio:sessions',()=>sessions.list());
  register('studio:watch-session',async key=>{
    await engine.configure({provider:'claude'});
    const entry=sessions.catalog.get(key);let account=entry&&engine.state.accounts.find(a=>a.configDir===entry.configDir);
    if(entry&&!account&&cliPath){try{const {stdout}=await execute(cliPath,['auth','status','--json'],{env:cleanEnvironment(process.env,entry.configDir),timeout:10000});const profile=JSON.parse(stdout);if(profile.email)account=engine.state.accounts.find(a=>a.email?.toLowerCase()===profile.email.toLowerCase());}catch{}}
    await sessions.watch(key,{accountId:account?.id});
  });
  register('studio:take-over',async()=>{
    if(!engine.state.externalSession)throw new Error('Nenhuma sessão externa selecionada.');
    const answer=await dialog.showMessageBox(window,{type:'question',message:'A sessão já foi encerrada no terminal?',detail:'Encerre a execução no outro terminal antes de continuar. O app retomará a mesma conversa; manter duas execuções pode causar alterações simultâneas.',buttons:['Continuar acompanhando','Já encerrei, retomar aqui'],defaultId:0,cancelId:0});
    if(answer.response===1)await sessions.takeOver();
  });
  register('studio:project',async()=>{const choice=await dialog.showOpenDialog(window,{title:'Conectar projeto',properties:['openDirectory']});if(!choice.canceled){sessions.stop();await engine.connect(choice.filePaths[0]);}return engine.state;});
  register('studio:send',text=>{if(engine.state.busy)throw new Error('Aguarde a execução atual.');void engine.send(text).catch(e=>engine.event(e.message,'error'));});
  register('studio:stop',()=>engine.stop());
  register('studio:spawn-agent',input=>engine.team.spawn(input));
  register('studio:stop-agent',id=>engine.team.stop(id));
  register('studio:new',()=>{sessions.stop();return engine.newSession();});
  register('studio:configure',settings=>engine.configure(settings));
  register('studio:permission',answer=>engine.resolvePermission(answer));
  register('studio:add-account',name=>engine.addAccount(name));
  register('studio:edit-account',input=>engine.editAccount(input));
  register('studio:remove-account',id=>engine.removeAccount(id));
  register('studio:refresh-usage',id=>usageMonitor.refresh(id));
  register('studio:open-link',url=>{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Link não permitido.');return shell.openExternal(parsed.href);});
  register('studio:import-account',async()=>{
    if(engine.state.accounts.some(a=>a.configDir===path.join(os.homedir(),'.claude')))throw new Error('A conta atual já está adicionada.');
    const a=await engine.addAccount('Claude Code local');a.configDir=path.join(os.homedir(),'.claude');await refreshAccount(a);if(a.loggedIn)void usageMonitor.refresh(a.id).catch(()=>{});return a;
  });
  register('studio:check-account',async id=>{const account=await refreshAccount(getAccount(id));if(account.loggedIn)await usageMonitor.refresh(id).catch(()=>{});return account;});
  register('studio:login',async id=>{
    const a=getAccount(id);if(!cliPath)throw new Error('Claude Code não encontrado.');
    if(engine.state.busy||engine.team.running)throw new Error('Aguarde ou interrompa a equipe antes de entrar em uma conta.');
    if(logins.size)throw new Error('Já há um login aberto. Finalize-o ou cancele antes de continuar.');
    const child=spawn(cliPath,['auth','login','--claudeai'],{env:cleanEnvironment(process.env,a.configDir),stdio:['ignore','pipe','pipe']});
    logins.set(id,child);a.loggingIn=true;engine.publish();
    const finish=async(error)=>{clearTimeout(timer);logins.delete(id);a.loggingIn=false;if(error)engine.event(error,'error');await refreshAccount(a);if(a.loggedIn)void usageMonitor.refresh(a.id).catch(()=>{});};
    const timer=setTimeout(()=>{child.kill();},5*60*1000);
    child.once('error',e=>{void finish(e.message);});
    child.once('close',code=>{if(logins.has(id))void finish(code===0?null:'Login cancelado ou não concluído. Tente novamente.');});
    // Claude Code opens the official browser flow itself. Never persist OAuth output.
    child.stdout.on('data',()=>{});child.stderr.on('data',()=>{});
  });
  register('studio:cancel-login',id=>{logins.get(id)?.kill();});
  register('studio:providers',()=>refreshProviders());
  register('studio:provider-login',async provider=>{
    if(engine.state.busy||engine.team.running)throw new Error('Aguarde ou interrompa a equipe antes de mudar o login.');
    if(!['codex','gemini'].includes(provider))throw new Error('Executor inválido.');
    const status=await inspectProvider(provider);if(!status.available)throw new Error(status.error);
    const command=loginCommand(provider,status.binary);
    if(process.platform!=='darwin')throw new Error(`Abra seu terminal e execute: ${command}. Depois clique em verificar conexão.`);
    await execute('/usr/bin/osascript',['-e',`tell application "Terminal"\nactivate\ndo script ${JSON.stringify(command)}\nend tell`],{timeout:15000,maxBuffer:65536});
    return {command};
  });
  register('studio:docs',()=>shell.openExternal('https://github.com/Donchitos/Claude-Code-Game-Studios'));
  register('studio:usage-page',()=>shell.openExternal('https://claude.ai/settings/usage'));
  if(process.argv.includes('--dev'))await window.loadURL('http://127.0.0.1:5173');else await window.loadFile(path.join(here,'../dist/index.html'));
  engine.on('usage-refresh',id=>{void usageMonitor.refresh(id,{force:false}).catch(()=>{});});
  void usageMonitor.refreshAll();usageTimer=setInterval(()=>{void usageMonitor.refreshAll();},30000);usageTimer.unref?.();
  window.on('focus',()=>{void refreshProviders().catch(()=>{});});
  window.on('close',event=>{
    if((engine.state.busy||engine.team.running)&&!quitting){event.preventDefault();const choice=dialog.showMessageBoxSync(window,{type:'question',message:'Interromper os agentes e fechar?',buttons:['Continuar trabalhando','Interromper e fechar'],defaultId:0,cancelId:0});if(choice===1){quitting=true;engine.stop();setTimeout(()=>window.close(),500);}}
  });
}).catch(error=>{dialog.showErrorBox('Não foi possível abrir o Studio Monitor',error.message);app.quit();});
app.on('window-all-closed',()=>{clearInterval(usageTimer);sessions?.stop();for(const child of logins.values())child.kill();engine?.stop();app.quit();});
