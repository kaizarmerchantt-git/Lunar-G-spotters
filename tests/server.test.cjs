const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');

// Capture the real request handler without opening the application's fixed port.
const root=path.resolve(__dirname,'..'),serverDir=path.join(root,'server');
let handler;
vm.runInNewContext(fs.readFileSync(path.join(serverDir,'server.cjs'),'utf8'),{
  require(name){return name==='node:http'?{createServer(fn){handler=fn;return {listen(){}};}}:require(name.startsWith('./')?path.join(serverDir,name):name);},
  __dirname:serverDir,URL,console
});

test('invalid request targets fail only their request; static routes remain usable', {timeout:10000}, async () => {
  for(const target of ['//%','//[','/\\%','http://[','http://example.com/','*']){
    const response={writeHead(status){this.status=status;},end(body){this.body=body;}};
    assert.doesNotThrow(()=>handler({url:target},response),target);
    assert.equal(response.status,400,target);
  }

  const server=http.createServer(handler);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const request=target=>new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port:server.address().port,path:target,agent:false},res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.on('error',reject);req.setTimeout(2000,()=>req.destroy(new Error('Request timed out')));
  });
  try {
    for(const target of ['//%','//[','/\\%'])assert.equal((await request(target)).status,400,target);
    for(const [target,file,type] of [
      ['/','index.html','text/html'],['/index.html?mode=preview','index.html','text/html'],
      ['/style.css','style.css','text/css'],['/workspace.css','workspace.css','text/css'],
      ['/model.js','model.js','text/javascript'],['/app.js','app.js','text/javascript'],
      ['/globe.js','globe.js','text/javascript'],['/data/horizons.json','data/horizons.json','application/json'],
      ['/mission-ui.js','mission-ui.js','text/javascript'],['/system-renderer.js','system-renderer.js','text/javascript'],
      ['/mission-experience.css','mission-experience.css','text/css'],
      ['/explorer.css','explorer.css','text/css'],['/lunar-explorer.js','lunar-explorer.js','text/javascript'],
      ['/notebook-data.js','notebook-data.js','text/javascript'],['/notebook-ui.js','notebook-ui.js','text/javascript'],['/notebook.css','notebook.css','text/css'],
      ['/resource-model.js','resource-model.js','text/javascript'],['/observation-transfer.js','observation-transfer.js','text/javascript'],
      ['/terrain-model.js','terrain-model.js','text/javascript'],['/terrain-ui.js','terrain-ui.js','text/javascript'],['/terrain.css','terrain.css','text/css'],['/data/terrain-horizons.json','data/terrain-horizons.json','application/json'],
      ['/study-model.js','study-model.js','text/javascript'],['/study-ui.js','study-ui.js','text/javascript'],['/study.css','study.css','text/css'],['/observer-ui.js','observer-ui.js','text/javascript'],
      ['/explorer-math.js','explorer-math.js','text/javascript'],['/explorer-layout.js','explorer-layout.js','text/javascript'],
      ['/vendor/three/build/three.module.js','vendor/three/build/three.module.js','text/javascript'],
      ['/vendor/three/build/three.core.js','vendor/three/build/three.core.js','text/javascript'],
      ['/vendor/three/examples/jsm/controls/OrbitControls.js','vendor/three/examples/jsm/controls/OrbitControls.js','text/javascript'],
      ['/assets/earth-blue-marble.jpg','assets/earth-blue-marble.jpg','image/jpeg'],['/assets/earth-blue-marble-map.png','assets/earth-blue-marble-map.png','image/png'],
      ['/assets/lroc_color_2k.jpg','assets/lroc_color_2k.jpg','image/jpeg'],
      ['/mission-atlas.js','mission-atlas.js','text/javascript'],['/atlas-model.js','atlas-model.js','text/javascript'],['/mission-atlas.css','mission-atlas.css','text/css'],['/data/clps-missions.json','data/clps-missions.json','application/json'],['/assets/lola-display-bump.jpg','assets/lola-display-bump.jpg','image/jpeg']
    ]){
      const response=await request(target);
      assert.equal(response.status,200,target);
      assert.equal(response.headers['content-type'],type,target);
      assert.equal(response.headers['x-content-type-options'],'nosniff',target);
      const disk=file.includes('/')?file:file==='index.html'?'src/index.html':file.endsWith('.css')?'styles/'+file:'src/'+file;
      assert.deepEqual(response.body,fs.readFileSync(path.join(root,disk)),target);
    }
    for(const target of ['/missing','/../server.cjs','/%2e%2e/server.cjs','/%5c%5c%25'])assert.equal((await request(target)).status,404,target);
    assert.equal((await request('/')).status,200,'server remains usable after rejected requests');
    assert.equal((await request('/api/observer')).status,405);
    assert.equal((await request('/api/source/not-a-hash')).status,404);
    const postObserver=(headers,body)=>new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/api/observer',method:'POST',headers,agent:false},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(body);});
    assert.equal(await postObserver({'Content-Type':'application/json',Origin:'https://untrusted.invalid'},'{}'),403,'cross-origin queries must not reach NASA');
    const localOrigin=`http://127.0.0.1:${server.address().port}`;
    assert.equal(await postObserver({'Content-Type':'text/plain',Origin:localOrigin},'{}'),415,'non-JSON Content-Type rejected');
    assert.equal(await postObserver({'Content-Type':'application/json; charset=utf-8',Origin:localOrigin},'{bad'),400,'same-host local port and charset parameter accepted');
    assert.equal(await postObserver({'Content-Type':'application/json',Origin:localOrigin},'x'.repeat(1100)),413,'oversized observer payload returns 413');
  } finally {
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
