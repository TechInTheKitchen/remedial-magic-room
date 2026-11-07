import * as THREE from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import * as CANNON from './vendor/cannon-es/cannon-es.js';
const colors={Red:'#aa3340',Blue:'#2868b2',Green:'#35764a',Brown:'#865536',White:'#eee9db',Purple:'#7544a0',Black:'#25232b'};
const values=[1,6,2,5,3,4];
const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const positions={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
function random(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}
export function trayLayout(aspect){
 if(aspect<.85)return {name:'portrait',halfWidth:3.25,halfDepth:6.5,columns:3};
 if(aspect<1.3)return {name:'square',halfWidth:4.8,halfDepth:5.1,columns:4};
 return {name:'wide',halfWidth:6.3,halfDepth:3.7,columns:4};
}
export function upwardFace(quaternion){let best=-Infinity,face=0;for(let i=0;i<axes.length;i++){const v=quaternion.vmult(new CANNON.Vec3(...axes[i]));if(v.y>best){best=v.y;face=values[i];}}return {face,alignment:best};}
let deskImagePromise;
function loadDeskImage(){
 if(!deskImagePromise)deskImagePromise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Desk background unavailable'));image.src=new URL('./images/wizard-desk-natural.webp',import.meta.url).href;});
 return deskImagePromise;
}
export function isSlowFlatDie(body){
 return body.position.y>=.35&&body.position.y<.65&&Math.abs(body.velocity.y)<.12&&body.velocity.length()<.5&&body.angularVelocity.length()<.5&&upwardFace(body.quaternion).alignment>=.97;
}
export async function roll3D(container,dice){
 const deskImage=await loadDeskImage().catch(()=>null);
 return new Promise((resolve,reject)=>{
  let renderer,raf,timer,cameraForCapture,resizeObserver,done=false;const scene=new THREE.Scene(),resources=[];
  function cleanup(){resizeObserver?.disconnect();cancelAnimationFrame(raf);clearTimeout(timer);for(const resource of resources)resource.dispose();renderer?.dispose();renderer?.forceContextLoss();}
  function finish(error,result){
   if(done)return;done=true;
   if(!error&&renderer){
    // Capture the final frame before releasing WebGL resources.
    const still=document.createElement('canvas');still.width=renderer.domElement.width;still.height=renderer.domElement.height;still.className='physics-canvas';still.setAttribute('role','img');still.setAttribute('aria-label','Settled 3D dice: '+result.map(d=>d.color+' '+d.face).join(', '));
    try{const context=still.getContext('2d');if(context){renderer.render(scene,cameraForCapture);context.drawImage(renderer.domElement,0,0);container.replaceChildren(still);}}catch{}
   }
   cleanup();if(error)reject(error);else resolve(result);
  }
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
   const width=Math.max(1,container.clientWidth||420),height=Math.max(1,container.clientHeight||Math.round(width*.72));renderer.setSize(width,height,false);const layout=trayLayout(width/height),hx=layout.halfWidth,hz=layout.halfDepth;renderer.setClearColor('#201923');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.domElement.className='physics-canvas';renderer.domElement.setAttribute('aria-label','3D dice tumbling in a tray');container.replaceChildren(renderer.domElement);
   const camera=new THREE.PerspectiveCamera(42,width/height,.1,80);cameraForCapture=camera;camera.position.set(0,17,12);camera.lookAt(0,0,0);
   let deskBackground;
   if(deskImage){deskBackground=new THREE.Texture(deskImage);deskBackground.colorSpace=THREE.SRGBColorSpace;deskBackground.needsUpdate=true;scene.background=deskBackground;resources.push(deskBackground);}
   function resize(){const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    // Fit the complete selected tray, with a small desk margin on every side.
    let low=4,high=70;
    function fits(distance){camera.position.set(0,distance*.95,distance*.32);camera.lookAt(0,0,0);camera.updateMatrixWorld();for(const x of [-hx-.3,hx+.3])for(const z of [-hz-.3,hz+.3])for(const y of [0,1]){const point=new THREE.Vector3(x,y,z).project(camera);if(Math.abs(point.x)>.9||Math.abs(point.y)>.9)return false;}return true;}
    for(let i=0;i<22;i++){const mid=(low+high)/2;if(fits(mid))high=mid;else low=mid;}fits(high);

    if(deskBackground){const imageAspect=deskImage.width/deskImage.height,viewAspect=w/h,overscan=1.12;const rx=Math.min(1,viewAspect/imageAspect)/overscan,ry=Math.min(1,imageAspect/viewAspect)/overscan;deskBackground.repeat.set(rx,ry);deskBackground.offset.set((1-rx)/2,(1-ry)/2);}
   }
   resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
   scene.add(new THREE.HemisphereLight(0xffebcd,0x392a45,2));const light=new THREE.DirectionalLight(0xffdeb0,3);light.position.set(-3,10,5);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-10,right:10,top:10,bottom:-10});light.shadow.bias=-.002;scene.add(light);
   const world=new CANNON.World({gravity:new CANNON.Vec3(0,-24,0),allowSleep:true});world.solver.iterations=20;
   world.defaultContactMaterial.friction=.4;world.defaultContactMaterial.restitution=.28;
   function texture(draw){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;draw(canvas.getContext('2d'));const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());resources.push(map);return map;}
   const wood=texture(ctx=>{
    ctx.fillStyle='#63412d';ctx.fillRect(0,0,1024,768);
    for(let y=0;y<768;y+=3){ctx.strokeStyle=`rgba(${y%9===0?'231,177,112':'36,18,12'},${.05+(y%13)/100})`;ctx.lineWidth=1+(y%3);ctx.beginPath();for(let x=0;x<=1024;x+=12){const py=y+Math.sin(x/100+y)*3+Math.sin(x/37+y/5);x?ctx.lineTo(x,py):ctx.moveTo(x,py);}ctx.stroke();}
    for(const y of [190,385,575]){ctx.fillStyle='rgba(22,10,8,.35)';ctx.fillRect(0,y,1024,2);}
    
   });
   const felt=texture(ctx=>{
    ctx.fillStyle='#313e3b';ctx.fillRect(0,0,1024,768);
    for(let y=0;y<768;y+=4){ctx.fillStyle=y%8?'rgba(0,0,0,.05)':'rgba(226,212,174,.035)';ctx.fillRect(0,y,1024,1);}
    ctx.strokeStyle='rgba(214,180,111,.55)';ctx.lineWidth=2;ctx.strokeRect(22,22,980,724);ctx.strokeRect(30,30,964,708);
    for(const [x,y]of [[60,60],[964,60],[60,708],[964,708]]){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#ab915e';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(12,0);ctx.moveTo(0,-12);ctx.lineTo(0,12);ctx.stroke();ctx.restore();}
   });
   function block(x,y,z,sx,sy,sz,material){const geometry=new THREE.BoxGeometry(sx*2,sy*2,sz*2);resources.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;}
   const woodMat=new THREE.MeshStandardMaterial({map:wood,roughness:.8}),feltMat=new THREE.MeshStandardMaterial({map:felt,roughness:1}),brass=new THREE.MeshStandardMaterial({color:'#bda16a',metalness:.65,roughness:.4});resources.push(woodMat,feltMat,brass);
   if(!deskImage)block(0,-.65,0,hx+2,.35,hz+2,woodMat);
   function wall(x,y,z,sx,sy,sz){
    // Preserve the tray footprint; tall invisible walls contain stronger tosses above the decorative rim.
    world.addBody(new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(sx,y<0?sy:8,sz)),position:new CANNON.Vec3(x,y<0?y:8,z)}));
    if(y<0){block(x,y,z,sx,sy,sz,feltMat);return;}
    block(x,.16,z,sx,.16,sz,woodMat);block(x,.325,z,sx,.015,sz,brass);
   }
   wall(0,-.3,0,hx,.3,hz);wall(-hx,1,0,.18,1.3,hz);wall(hx,1,0,.18,1.3,hz);wall(0,1,-hz,hx,1.3,.18);wall(0,1,hz,hx,1.3,.18);
   // Independent square decal: the board may stretch, the emblem never does.
   const emblemCanvas=document.createElement('canvas');emblemCanvas.width=1024;emblemCanvas.height=1024;
   const ink=emblemCanvas.getContext('2d');ink.translate(512,445);ink.strokeStyle='rgba(214,180,111,.2)';ink.lineWidth=2;
   for(const radius of [260,282,320]){ink.beginPath();ink.arc(0,0,radius,0,Math.PI*2);ink.stroke();}
   ink.beginPath();for(let i=0;i<=3;i++){const angle=-Math.PI/2+i*Math.PI*2/3;const x=Math.cos(angle)*260,y=Math.sin(angle)*260;i?ink.lineTo(x,y):ink.moveTo(x,y);}ink.stroke();
   ink.fillStyle='rgba(214,180,111,.48)';ink.textAlign='center';ink.font='26px Georgia';ink.fillText('P R I S M S',0,380);ink.font='16px Georgia';ink.fillText('PRACTICAL MAGIC · RETURN ALL COMPONENTS',0,418);
   const emblemMap=new THREE.CanvasTexture(emblemCanvas);emblemMap.colorSpace=THREE.SRGBColorSpace;
   const emblemSize=Math.min(hx,hz)*1.65;
   const emblemGeometry=new THREE.PlaneGeometry(emblemSize,emblemSize);
   const emblemMaterial=new THREE.MeshBasicMaterial({map:emblemMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
   resources.push(emblemMap,emblemGeometry,emblemMaterial);
   const emblem=new THREE.Mesh(emblemGeometry,emblemMaterial);emblem.rotation.x=-Math.PI/2;emblem.position.y=.006;scene.add(emblem);
   const geo=new RoundedBoxGeometry(.85,.85,.85,4,.095);
   // Shallow edge bites: wear without obscuring the pip faces.
   const points=geo.attributes.position,normals=geo.attributes.normal;
   const cuts=[[.355,.355,.12,.035],[-.355,.08,.355,.028],[.15,-.355,-.355,.032],[-.355,-.355,-.1,.025],[.355,-.1,-.355,.03]];
   for(let i=0;i<points.count;i++){
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i);let depth=0;
    for(const [cx,cy,cz,strength]of cuts){const d=((x-cx)**2+(y-cy)**2+(z-cz)**2);depth+=strength*Math.exp(-d/.0025);}
    points.setXYZ(i,x-normals.getX(i)*depth,y-normals.getY(i)*depth,z-normals.getZ(i)*depth);
   }
   points.needsUpdate=true;geo.computeVertexNormals();resources.push(geo);const materials=new Map();
   function faceMaterials(color){if(materials.has(color))return materials.get(color);const result=values.map(face=>{const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=colors[color];ctx.fillRect(0,0,128,128);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=5;ctx.strokeRect(2,2,124,124);ctx.fillStyle=color==='White'?'#302438':'#ffffff';for(const [x,y]of positions[face]){ctx.beginPath();ctx.arc(64+x*32,64+y*32,10,0,Math.PI*2);ctx.fill();}// A few shallow blade marks and worn edges, generated locally.
    let seed=face*7919+color.charCodeAt(0)*101;function grain(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const bumpCanvas=document.createElement('canvas');bumpCanvas.width=128;bumpCanvas.height=128;const bump=bumpCanvas.getContext('2d');bump.fillStyle='#b9b9b9';bump.fillRect(0,0,128,128);
    for(let i=0;i<7;i++){
     const edge=i%4,start=8+grain()*106,length=5+grain()*15;
     const x=edge===0?3:edge===1?125:start,y=edge===2?3:edge===3?125:start;
     const ex=x+(edge===0?length:edge===1?-length:grain()*12-6),ey=y+(edge===2?length:edge===3?-length:grain()*12-6);
     ctx.strokeStyle=color==='White'?'rgba(71,48,30,.35)':'rgba(246,227,185,.4)';ctx.lineWidth=.7+grain();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
     bump.strokeStyle='#303030';bump.lineWidth=1.5;bump.beginPath();bump.moveTo(x,y);bump.lineTo(ex,ey);bump.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const bumpMap=new THREE.CanvasTexture(bumpCanvas);
    const mat=new THREE.MeshStandardMaterial({map:texture,bumpMap,bumpScale:.018,roughness:.62});resources.push(texture,bumpMap,mat);return mat;});materials.set(color,result);return result;}
   const items=dice.map((die,i)=>{const body=new CANNON.Body({mass:1,shape:new CANNON.Box(new CANNON.Vec3(.425,.425,.425)),linearDamping:.16,angularDamping:.18,sleepSpeedLimit:.12,sleepTimeLimit:.6});const columns=layout.columns,rows=Math.ceil(dice.length/columns);body.position.set((i%columns-(columns-1)/2)*1.35,3+Math.floor(i/columns)*1.3,(Math.floor(i/columns)-(rows-1)/2)*1.35);body.quaternion.setFromEuler(random()*Math.PI*2,random()*Math.PI*2,random()*Math.PI*2);body.velocity.set((random()-.5)*14,3+random()*4,(random()-.5)*12);body.angularVelocity.set((random()-.5)*48,(random()-.5)*48,(random()-.5)*48);world.addBody(body);const mesh=new THREE.Mesh(geo,faceMaterials(die.color));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return {body,mesh,color:die.color,retries:0};});
   let previous=performance.now(),elapsed=0,quiet=0,slowFlatTime=0;
   timer=setTimeout(()=>finish(Error('3D roll timed out; using the simple roller.')),20000);
   function frame(now){if(done)return;if(!container.isConnected){finish(Error('Dice tray closed.'));return;}const delta=Math.min((now-previous)/1000,.05);previous=now;elapsed+=delta;world.step(1/60,delta,4);
    for(const item of items){item.mesh.position.copy(item.body.position);item.mesh.quaternion.copy(item.body.quaternion);}
    renderer.render(scene,camera);
    const settled=items.every(({body})=>body.velocity.length()<.12&&body.angularVelocity.length()<.12);
    quiet=settled?quiet+delta:0;
    slowFlatTime=items.every(({body})=>isSlowFlatDie(body))?slowFlatTime+delta:0;
    const driftTimeout=elapsed>=6&&slowFlatTime>=1;
    if((quiet>.65&&elapsed>1)||driftTimeout){const cocked=items.filter(item=>upwardFace(item.body.quaternion).alignment<.97);
     if(cocked.length){for(const item of cocked){if(++item.retries>3){finish(Error('Cocked dice could not settle; using the simple roller.'));return;}item.body.wakeUp();item.body.position.y+=2;item.body.angularVelocity.set(random()*12,random()*12,random()*12);}quiet=0;slowFlatTime=0;}
     else{for(const {body}of items)body.sleep();const result=items.map(item=>({color:item.color,face:upwardFace(item.body.quaternion).face}));cancelAnimationFrame(raf);clearTimeout(timer);timer=setTimeout(()=>finish(null,result),550);return;}
    }
    raf=requestAnimationFrame(frame);
   }
   raf=requestAnimationFrame(frame);
  }catch(error){finish(error);}
 });
}
