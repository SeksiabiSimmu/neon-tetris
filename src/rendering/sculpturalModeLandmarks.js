import * as THREE from 'three';
import { addMesh as mesh, arcProfile, artMaterials, chamferedBox as box, instances, profile, strut, applyArtQuality, mapSurface } from './environmentArt.js';
import { createWorldLights } from './worldLighting.js';
import { planetarySurfaces, gardenSandTexture } from './heroSurfaces.js';

function anchor(parent, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function radial(count, radius, z = 0) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    return { position:[Math.sin(angle)*radius,Math.cos(angle)*radius,z], rotation:[0,0,-angle] };
  });
}

function transit(group, m, animated) {
  const rib = profile([[0,-330],[64,-330],[64,125],[18,252],[-46,308],[-74,280],[-27,219],[0,105]], 56, 4);
  const ribs = [];
  for (let i=0;i<5;i++) for (const side of [-1,1]) {
    ribs.push({ position:[side*(500+i*14),0,100-i*210], rotation:[0,side<0?Math.PI:0,0] });
  }
  instances(group, rib, m.metal, ribs);
  mesh(group,box(1750,24,1650),m.dark,0,-342,-420).name='transit-platform';
  instances(group,box(13,14,1650,2),m.trim,[-1,1].flatMap(s=>[410,448].map(x=>({position:[s*x,-321,-420]}))));
  instances(group,box(4,4,1480,1),m.light,[-1,1].map(s=>({position:[s*428,-316,-470]})),{cast:false});
  for(const side of [-1,1]) {
    const service=anchor(group,side*520,-95,-140);
    mesh(service,box(100,250,50),m.dark);
    mesh(service,box(86,122,9),m.metal,0,23,32);
    instances(service,box(62,3,10,1),m.trim,Array.from({length:9},(_,i)=>({position:[0,-60-i*7,31]})),{secondary:true});
    mesh(service,box(45,6,7,1),m.light,0,109,31,false);
    strut(group,[side*553,-298,-300],[side*645,210,-390],18,m.dark);
  }
  const gate=anchor(group,0,25,-1050);
  mesh(gate,arcProfile(235,270,40,0,Math.PI),m.metal);
  mesh(gate,arcProfile(241,245,43,0,Math.PI),m.light,0,0,0,false);
  const trackLights=instances(group,box(5,5,44,1),m.light,Array.from({length:16},(_,i)=>({position:[(i%2?1:-1)*428,-310,150-Math.floor(i/2)*160]})),{cast:false});
  animated.push(time=>{ trackLights.position.z=(time*28)%160; });
}

function orbitalStation(group,m,animated) {
  const station=anchor(group,515,140,-430);
  station.rotation.set(0.18,-0.48,-0.24);
  const wheel=new THREE.Group(); station.add(wheel);
  mesh(wheel,arcProfile(159,196,38),m.metal);
  mesh(wheel,arcProfile(165,173,42),m.dark);
  mesh(wheel,arcProfile(181,184,41),m.light,0,0,0,false);
  instances(wheel,arcProfile(160,200,46,0.025,Math.PI/6-0.05),m.stone,
    Array.from({length:12},(_,i)=>({rotation:[0,0,i*Math.PI/6]})));
  instances(wheel,box(14,128,22,3),m.metal,radial(6,92));
  instances(wheel,box(6,9,3,1),m.light,radial(60,190,26),{cast:false,secondary:true});
  mesh(station,mapSurface(new THREE.CylinderGeometry(39,48,100,24)),m.metal).rotation.x=Math.PI/2;
  mesh(station,arcProfile(22,39,10),m.trim,0,0,56);
  mesh(station,box(26,10,5,2),m.light,0,0,64,false);
  for(const side of [-1,1]) {
    strut(station,[side*40,0,-50],[side*284,0,-50],10,m.trim);
    const panels=instances(station,box(76,54,5,2),m.glass,
      Array.from({length:6},(_,i)=>({position:[side*(220+(i%2)*84),Math.floor(i/2)*62-62,-50]})));
    panels.rotation.x=0.15;
    instances(station,box(70,1.5,1,.2),m.trim,
      Array.from({length:36},(_,i)=>({position:[side*(220+(i%2)*84),Math.floor(i/12)*62-84+Math.floor((i%12)/2)*9,-45]})),{cast:false,secondary:true});
  }
  const planet=anchor(group,-570,-125,-1100);
  const surfaces=planetarySurfaces();
  const globe=mesh(planet,new THREE.SphereGeometry(255,72,48),
    new THREE.MeshStandardMaterial({map:surfaces.land,roughness:.86,metalness:0}),0,0,0,false);
  globe.rotation.y=-.5;
  const cloudLayer=mesh(planet,new THREE.SphereGeometry(258,72,48),
    new THREE.MeshBasicMaterial({map:surfaces.clouds,transparent:true,depthWrite:false,opacity:.8}),0,0,0,false);
  cloudLayer.rotation.y=-.62;
  const atmosphere=mesh(planet,new THREE.SphereGeometry(263,48,32),new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color('#79b9ce')}},transparent:true,depthWrite:false,
    vertexShader:'varying vec3 vNormal; varying vec3 vView; void main(){vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uColor; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.0); gl_FragColor=vec4(uColor,rim*0.48);}',
  }),0,0,0,false);
  atmosphere.renderOrder=4;
  animated.push(time=>{wheel.rotation.z=time*.014;globe.rotation.y=-.5+time*.006;cloudLayer.rotation.y=-.62+time*.008;});
}

function clockwork(group,m,animated) {
  const mechanism=anchor(group,-500,70,-405);
  mechanism.rotation.set(.07,.25,-.12);
  mesh(mechanism,arcProfile(206,224,42,Math.PI*.12,Math.PI*1.72),m.dark);
  mesh(mechanism,arcProfile(202,208,49,Math.PI*.12,Math.PI*1.72),m.trim);
  const rotor=new THREE.Group(); mechanism.add(rotor);
  mesh(rotor,arcProfile(136,171,33),m.metal);
  mesh(rotor,arcProfile(130,139,39),m.trim);
  instances(rotor,box(10,21,35,2),m.metal,radial(48,177));
  instances(rotor,box(17,97,18,3),m.metal,radial(8,85));
  mesh(rotor,arcProfile(18,48,56),m.dark);
  mesh(rotor,arcProfile(28,41,60),m.trim);
  const spindle=mesh(mechanism,mapSurface(new THREE.LatheGeometry([
    new THREE.Vector2(0,-61),new THREE.Vector2(22,-61),new THREE.Vector2(22,-42),new THREE.Vector2(33,-38),
    new THREE.Vector2(33,38),new THREE.Vector2(22,42),new THREE.Vector2(22,61),new THREE.Vector2(0,61)],32)),m.metal);
  spindle.rotation.x=Math.PI/2;
  instances(mechanism,box(25,40,64),m.dark,radial(4,214));
  instances(mechanism,box(12,6,7,1),m.light,radial(24,217,36),{cast:false,secondary:true});
  const gimbal=mesh(mechanism,arcProfile(95,102,11),m.trim,0,0,63);
  gimbal.rotation.x=.6;
  for(const s of [-1,1]) strut(group,[-500+s*125,-135,-450],[-500+s*175,-328,-310],24,m.dark);
  mesh(group,box(460,44,240),m.stone,-500,-345,-390);
  const pendulum=anchor(group,550,30,-600);
  mesh(pendulum,box(30,465,30),m.dark);
  mesh(pendulum,box(7,420,8,1),m.trim,0,0,21);
  mesh(pendulum,arcProfile(35,80,38),m.metal,0,-176,15);
  mesh(pendulum,box(23,5,5,1),m.light,0,213,22,false);
  animated.push(time=>{rotor.rotation.z=time*.038;gimbal.rotation.y=Math.sin(time*.19)*.35;pendulum.rotation.z=Math.sin(time*.45)*.025;});
}

function garden(group,m,animated) {
  const gate=anchor(group,600,35,-470);
  gate.scale.setScalar(.86);
  gate.rotation.y=-.24;
  mesh(gate,arcProfile(130,192,85),m.stone);
  mesh(gate,arcProfile(130,138,91),m.dark);
  mesh(gate,box(430,34,235),m.stone,0,-214,0);
  instances(gate,box(73,24,98,5),m.stone,Array.from({length:5},(_,i)=>({position:[-157+i*78,-184,-5]})));
  const stones=[
    {outline:[[-103,-55],[70,-62],[112,-21],[68,71],[-38,100],[-103,29]],at:[-500,-216,-292],turn:-.16},
    {outline:[[-74,-48],[84,-52],[91,11],[27,126],[-51,104],[-95,18]],at:[-565,-151,-445],turn:.11},
    {outline:[[-113,-40],[61,-53],[104,-8],[41,71],[-66,91],[-119,33]],at:[-592,-86,-570],turn:-.09},
  ];
  for(const stone of stones) {
    const body=mesh(group,profile(stone.outline,76,6),m.stone,...stone.at);
    body.rotation.set(0,.27,stone.turn);
    mesh(body,box(112,5,5,1),m.trim,-5,6,43,false).rotation.z=stone.turn;
  }
  const basin=anchor(group,0,-352,-235);
  mesh(basin,box(1500,28,850),m.dark);
  for(const s of [-1,1]) mesh(basin,box(63,46,880),m.stone,s*710,17,0);
  mesh(basin,box(1460,46,65),m.stone,0,17,420);
  const sandMat=new THREE.MeshStandardMaterial({map:gardenSandTexture(),roughness:1,metalness:0});
  mesh(basin,new THREE.PlaneGeometry(1360,800),sandMat,0,28,-10,false).rotation.x=-Math.PI/2;
  const waterMat=new THREE.MeshPhysicalMaterial({color:'#4f8280',roughness:.24,metalness:.12,clearcoat:1,envMapIntensity:.55});
  mesh(basin,new THREE.PlaneGeometry(330,480),waterMat,455,29,-65,false).rotation.x=-Math.PI/2;
  for(const side of [-1,1]) mesh(basin,box(16,17,510,2),m.stone,455+side*174,38,-65);
  for(const side of [-1,1]) mesh(basin,box(360,17,16,2),m.stone,455,38,-65+side*250);
  const rippleMat=new THREE.MeshBasicMaterial({color:'#6a9994',transparent:true,opacity:.12,depthWrite:false});
  const ripples=mesh(basin,new THREE.RingGeometry(40,41,72),rippleMat,455,31,80,false);
  ripples.rotation.x=-Math.PI/2;
  const green=new THREE.MeshStandardMaterial({color:'#3b6251',roughness:.9});
  const reeds=Array.from({length:17},(_,i)=>({position:[-470+(i%5)*17,-207+Math.sin(i)*13,-170-Math.floor(i/5)*32],rotation:[0,0,Math.sin(i*2)*.12],scale:[1,.8+(i%3)*.12,1]}));
  instances(group,new THREE.CylinderGeometry(2.7,4,155,6),green,reeds);
  instances(group,profile([[0,0],[7,23],[4,69],[-3,40]],1,0),green,
    reeds.map((t,i)=>({position:[t.position[0],t.position[1]+35,t.position[2]],rotation:[0,i,(-1)**i*.75]})),{cast:false});
  const stoneIslet=profile([[-72,-29],[46,-37],[84,-4],[42,52],[-24,65],[-83,13]],40,5);
  mesh(basin,stoneIslet,m.stone,-270,53,95).rotation.x=-.08;
  mesh(basin,stoneIslet,m.stone,-352,46,-104).scale.set(.55,.64,.7);
  const gardenFill=new THREE.PointLight('#ddd5b6',1.2,750,2);
  gardenFill.position.set(-530,180,100);group.add(gardenFill);
  animated.push(time=>{const t=(time*.08)%1;ripples.scale.setScalar(.6+t*1.7);rippleMat.opacity=.12*Math.sin(t*Math.PI);});
}

function crystalVault(group,m,animated) {
  const vault=anchor(group,520,50,-420);vault.rotation.y=-.26;
  mesh(vault,profile([[-214,-265],[-214,130],[-118,240],[130,240],[223,100],[223,-265],
    [172,-265],[172,80],[102,182],[-89,182],[-163,106],[-163,-265]],54,5),m.metal);
  mesh(vault,box(490,40,180),m.dark,0,-255,0);
  mesh(vault,box(200,32,140),m.stone,0,-216,30);
  mesh(vault,arcProfile(57,91,12),m.trim,0,-185,45).rotation.x=-Math.PI/2;
  const mineral=anchor(vault,0,-22,35);
  const crystalMaterial=new THREE.MeshPhysicalMaterial({color:'#8b83a3',roughness:.26,metalness:.38,clearcoat:.7,envMapIntensity:.85});
  const crystal=profile([[-49,-115],[39,-94],[61,61],[13,158],[-37,112]],62,0);
  mesh(mineral,crystal,crystalMaterial).rotation.set(.12,-.32,-.13);
  for(const side of [-1,1]) {
    const shard=mesh(mineral,crystal,m.glass,side*65,-30,-5);
    shard.scale.set(.44,.6,.55);shard.rotation.z=-side*.5;
    strut(vault,[side*165,-157,65],[side*88,-116,57],13,m.trim);
    mesh(vault,box(10,235,9,2),m.light,side*186,-55,32,false);
  }
  instances(vault,box(22,5,6,1),m.dark,Array.from({length:18},(_,i)=>({position:[-70+(i%6)*28,-222,92-Math.floor(i/6)*14]})),{cast:false,secondary:true});
  const echo=anchor(group,-560,-100,-620);
  for(let i=0;i<3;i++) {
    mesh(echo,box(210-i*20,28,140),m.stone,0,-186+i*107,-i*75);
    const shard=mesh(echo,crystal,m.metal,0,-127+i*107,-i*75);
    shard.scale.setScalar(.35+i*.07);shard.rotation.z=i*.22-.15;
  }
  animated.push(time=>{mineral.rotation.y=Math.sin(time*.12)*.1;});
}

/** The silhouettes are authored for the gameplay camera, not an asset viewer. */
export function createSculpturalModeLandmark(mode) {
  const group=new THREE.Group();group.name=`${mode}-sculpture`;
  const lights=createWorldLights(mode);group.add(lights.group);
  const palette=artMaterials({metal:mode==='timeAttack'?'#99856b':mode==='marathon'?'#909aa6':'#7b8a8c',
    stone:mode==='zen'?'#89948a':'#646e75',accent:lights.art.rim});
  const m=palette.materials, animated=[];
  ({sprint:transit,marathon:orbitalStation,timeAttack:clockwork,zen:garden,challenge:crystalVault}[mode]||crystalVault)(group,m,animated);
  return {
    group,
    update({time=0,pulse=0,reducedMotion=false,glowIntensity=1}={}) {
      for(const animate of animated) animate(reducedMotion?0:time);
      m.light.emissiveIntensity=(.7+Math.min(.25,pulse*.14))*glowIntensity;
      lights.rim.intensity=.68+(reducedMotion?0:Math.min(.2,pulse*.12)*glowIntensity);
    },
    setQuality(preset) { applyArtQuality(group,preset); },
    setFiltering(anisotropy) { palette.textures.forEach(t=>{t.anisotropy=anisotropy;t.needsUpdate=true;}); },
  };
}
