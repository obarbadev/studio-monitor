const {contextBridge,ipcRenderer}=require('electron');
const invoke=async(name,...args)=>{const r=await ipcRenderer.invoke(name,...args);if(!r.ok)throw new Error(r.error);return r.value;};
contextBridge.exposeInMainWorld('studio',{
 spawnAgent:input=>invoke('studio:spawn-agent',input),stopAgent:id=>invoke('studio:stop-agent',id),
 providers:()=>invoke('studio:providers'),providerLogin:provider=>invoke('studio:provider-login',provider),
 templates:()=>invoke('studio:templates'),previewTemplate:id=>invoke('studio:preview-template',id),installTemplate:token=>invoke('studio:install-template',token),projectSnapshot:()=>invoke('studio:project-snapshot'),projectFile:id=>invoke('studio:project-file',id),previewStatusline:()=>invoke('studio:preview-statusline'),
 inventory:()=>invoke('studio:inventory'),resource:id=>invoke('studio:resource',id),
 sessions:()=>invoke('studio:sessions'),watchSession:key=>invoke('studio:watch-session',key),takeOver:()=>invoke('studio:take-over'),
 editAccount:input=>invoke('studio:edit-account',input),removeAccount:id=>invoke('studio:remove-account',id),refreshUsage:id=>invoke('studio:refresh-usage',id),openLink:url=>invoke('studio:open-link',url),
 get:()=>invoke('studio:get'),connect:()=>invoke('studio:project'),send:text=>invoke('studio:send',text),stop:()=>invoke('studio:stop'),newSession:()=>invoke('studio:new'),
 configure:settings=>invoke('studio:configure',settings),permission:answer=>invoke('studio:permission',answer),addAccount:name=>invoke('studio:add-account',name),
 importAccount:()=>invoke('studio:import-account'),checkAccount:id=>invoke('studio:check-account',id),login:id=>invoke('studio:login',id),cancelLogin:id=>invoke('studio:cancel-login',id),docs:()=>invoke('studio:docs'),usagePage:()=>invoke('studio:usage-page'),
 onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('studio:state',listener);return()=>ipcRenderer.removeListener('studio:state',listener);}
});
