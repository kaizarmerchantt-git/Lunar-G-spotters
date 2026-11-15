'use strict';
const http=require('node:http'),{spawn}=require('node:child_process');
const address='http://127.0.0.1:4173/';
function probe(){
 return new Promise((resolve,reject)=>{
  const request=http.get(address,{agent:false},response=>{
   let body='',bytes=0;
   response.on('data',chunk=>{bytes+=chunk.length;if(bytes<=32768)body+=chunk.toString('utf8');});
   response.on('end',()=>resolve(response.statusCode===200&&/<title>SELENE\s*[·—-]/i.test(body)));
   response.on('error',reject);
  });
  request.setTimeout(2000,()=>request.destroy(Error('The local server did not respond.')));
  request.on('error',reject);
 });
}
function openBrowser(){
 const cmd=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
 const browser=spawn(cmd,[address],{windowsHide:true,stdio:'ignore'});
 browser.on('error',()=>console.log('Open this address in your browser: '+address));
 browser.unref();
}
(async()=>{
 try{
  if(!await probe())throw Error('Port 4173 is occupied by another application. Close that application or ask for help changing SELENE\'s port.');
  console.log('SELENE is already running. Opening '+address);openBrowser();
 }catch(error){
  if(error.code!=='ECONNREFUSED')throw error;
  console.log('Starting SELENE. Keep this window open while using the application.');
  console.log('Close this window or press Ctrl+C to stop the server.');
  require('./server.cjs');
  for(let attempt=0;attempt<30;attempt++){
   try{if(await probe()){openBrowser();return;}}catch(e){if(e.code!=='ECONNREFUSED')throw e;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('SELENE did not become ready. Check the server messages above.');
 }
})().catch(error=>{console.error(error.message);process.exit(1);});
