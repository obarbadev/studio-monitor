import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
if(process.platform!=='darwin')throw new Error('A geração do ICNS usa sips e iconutil do macOS. Os ícones prontos estão versionados.');
const root=path.resolve('build-resources'),temporary=await mkdtemp(path.join(os.tmpdir(),'studio-icons-'));
const set=path.join(temporary,'Studio.iconset');
const {mkdir}=await import('node:fs/promises');await mkdir(set);
try{
 for(const size of [16,32,128,256,512])for(const scale of [1,2])execFileSync('sips',['-z',String(size*scale),String(size*scale),path.join(root,'icon.png'),'--out',path.join(set,`icon_${size}x${size}${scale===2?'@2x':''}.png`)],{stdio:'ignore'});
 execFileSync('iconutil',['-c','icns',set,'-o',path.join(root,'icon.icns')]);
 const images=[];for(const size of [16,32,48,64,128,256]){const file=path.join(temporary,`win-${size}.png`);execFileSync('sips',['-z',String(size),String(size),path.join(root,'icon.png'),'--out',file],{stdio:'ignore'});images.push({size,buffer:await readFile(file)});}
 const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
 images.forEach(({size,buffer},i)=>{const entry=6+i*16;header[entry]=header[entry+1]=size===256?0:size;header.writeUInt16LE(1,entry+4);header.writeUInt16LE(32,entry+6);header.writeUInt32LE(buffer.length,entry+8);header.writeUInt32LE(offset,entry+12);offset+=buffer.length;});
 await writeFile(path.join(root,'icon.ico'),Buffer.concat([header,...images.map(i=>i.buffer)]));
 console.log('Ícones ICNS e ICO gerados a partir de build-resources/icon.png.');
}finally{await rm(temporary,{recursive:true,force:true});}
