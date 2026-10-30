#!/usr/bin/env node
// Self-contained art review: the exact shared gameplay painter, no mock sprites.
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'design/articulation');
mkdirSync(out,{recursive:true});
const {outputFiles}=await build({stdin:{contents:`
import {CHARACTERS} from './src/game/data/characters';
import {CHARACTER_FULL_ART} from './src/game/rendering/character-fullart-data';
import {drawCharacterArt} from './src/game/rendering/character-art';
import {ensureCharacterFullArtLoading} from './src/game/rendering/character-fullart';
import {FULL_ART_RIGS,resolveRigPose} from './src/game/rendering/fullart-rig';
import {characterPreviewBounds,fitCharacterPreview} from './src/game/rendering/character-framing';
window.art={CHARACTERS,CHARACTER_FULL_ART,drawCharacterArt,ensureCharacterFullArtLoading,FULL_ART_RIGS,resolveRigPose,characterPreviewBounds,fitCharacterPreview};
`,resolveDir:root},bundle:true,format:'iife',write:false});
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DashVerse — character animation studio</title>
<style>*{box-sizing:border-box}body{margin:0;background:#191725;color:#f4ebff;font:15px 'Trebuchet MS',sans-serif}main{max-width:1200px;margin:auto;padding:24px}h1{margin:0;color:#c7ff4d}p{color:#c5b4d8;line-height:1.5}button,select{font:inherit;background:#30253f;color:#f4ebff;border:1px solid #9570ff88;border-radius:5px;padding:10px;margin:4px}canvas{display:block;width:100%;height:auto;border:1px solid #9570ff55;border-radius:8px;background:#211c2f}label{display:inline-block}#status{color:#c7ff4d}#gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:8px;margin:14px 0}#gallery figure{margin:0;padding:8px;border:1px solid #9570ff44;border-radius:7px}#gallery figcaption{text-align:center;margin:6px}#gallery canvas{border:0}a{color:#c7ff4d}</style>
<main><p>DASHVERSE / PAINTED CAST</p><h1>Every hero. A little more alive.</h1><p>Original redesigned artwork, fitted to articulated arms, elbows, legs, knees and hand-held props. Select a hero and inspect the run, jump, dash and attack poses.</p>
<label>Hero <select id="hero"></select></label><label>Action <select id="action"><option>run</option><option>idle</option><option>jump</option><option>fall</option><option>dash</option><option>melee</option><option>cast</option></select></label><button id="pause">Pause</button><button id="bones">Show joints</button><p id="status">Loading painted figures…</p><canvas id="live" width="1100" height="380"></canvas><div id="gallery"></div><canvas id="sheet" width="1200" height="4420"></canvas></main>
<script>${outputFiles[0].text}</script>
<script>
const {CHARACTERS,CHARACTER_FULL_ART,drawCharacterArt,ensureCharacterFullArtLoading,FULL_ART_RIGS,resolveRigPose,characterPreviewBounds,fitCharacterPreview}=window.art;
const hero=document.querySelector('#hero'),action=document.querySelector('#action'),live=document.querySelector('#live'),ctx=live.getContext('2d');
const originals={},errors=[];window.addEventListener('error',e=>{errors.push(e.message);document.querySelector('#status').textContent='ERROR: '+e.message;});
CHARACTERS.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;hero.append(o);const img=new Image();img.src=CHARACTER_FULL_ART[c.id];originals[c.id]=img;});
ensureCharacterFullArtLoading();
let playing=!matchMedia('(prefers-reduced-motion:reduce)').matches,joints=false,t=0,last=0;
document.querySelector('#pause').onclick=()=>{playing=!playing;document.querySelector('#pause').textContent=playing?'Pause':'Play';};
document.querySelector('#bones').onclick=()=>{joints=!joints;document.querySelector('#bones').textContent=joints?'Hide joints':'Show joints';};
function pose(a,t){return {time:t,phase:(t*2.4)%1,stride:a==='run'?Math.sin(t*2.4*Math.PI*2)*2.4:0,moving:a==='run',airborne:a==='jump'||a==='fall',verticalVelocity:a==='jump'?-300:300,dashing:a==='dash',melee:a==='melee'?(t*1.6)%1:0,ranged:a==='cast'?(t*1.6)%1:0};}
function original(l,c,x,y,h){const img=originals[c.id];if(img.complete)l.drawImage(img,x-h*img.width/img.height/2,y-h,h*img.width/img.height,h);}
function paint(l,c,p,x,y,h){const action=p.melee||p.ranged?'attack':p.moving?'run':p.airborne?'jump':'idle',size=h*1.3,b=characterPreviewBounds(c,action,true),f=fitCharacterPreview(b,size);const frame={x:x-size/2+f.x,y:y-size+f.y,scale:f.scale};l.save();l.translate(frame.x,frame.y);l.scale(frame.scale,frame.scale);drawCharacterArt(l,c,c.width,c.height,p);l.restore();return frame;}
function frame(now){if(playing&&last)t+=Math.min(.05,(now-last)/1000);last=now;const c=CHARACTERS.find(c=>c.id===hero.value),p=pose(action.value,t);ctx.clearRect(0,0,live.width,live.height);ctx.fillStyle='#bda9ce';ctx.font='14px Trebuchet MS';ctx.fillText('SOURCE FIGURE',95,30);ctx.fillText('ARTICULATED / '+action.value.toUpperCase(),580,30);ctx.strokeStyle='#9570ff55';ctx.beginPath();ctx.moveTo(30,344);ctx.lineTo(1070,344);ctx.stroke();original(ctx,c,255,340,270);const heroFrame=paint(ctx,c,p,760,340,208);
if(joints){const aspect=originals[c.id].width/originals[c.id].height,r=resolveRigPose(FULL_ART_RIGS[c.id],aspect,p);ctx.strokeStyle='#c7ff4d';ctx.fillStyle='#c7ff4d';ctx.lineWidth=2;const h=c.height*heroFrame.scale*1.3,left=heroFrame.x+c.width/2*heroFrame.scale-aspect*h/2,top=heroFrame.y+c.height*heroFrame.scale-h;for(const b of r.bones){const x=left+b.from[0]*h,y=top+b.from[1]*h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(left+b.to[0]*h,top+b.to[1]*h);ctx.stroke();ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}}
requestAnimationFrame(frame);}requestAnimationFrame(frame);
function sheet(){const s=document.querySelector('#sheet'),l=s.getContext('2d');l.clearRect(0,0,s.width,s.height);const poses=[['ORIGINAL',null],['RUN / REACH',{moving:true,phase:.25,stride:2.4}],['RUN / PASS',{moving:true,phase:.75,stride:-2.4}],['JUMP',{airborne:true,verticalVelocity:-300}],['STRIKE',{melee:.5}],['CAST',{ranged:.5}]];CHARACTERS.forEach((c,row)=>{const y=row*260;l.fillStyle='#c7ff4d';l.font='15px Trebuchet MS';l.fillText(c.name,12,y+20);poses.forEach(([name,p],col)=>{const x=col*200+100;l.fillStyle='#bda9ce';l.font='11px Trebuchet MS';l.fillText(name,x-60,y+42);if(p)paint(l,c,p,x,y+250,145);else original(l,c,x,y+250,188);});});
const gallery=document.querySelector('#gallery');gallery.innerHTML='';CHARACTERS.forEach(c=>{const f=document.createElement('figure'),cv=document.createElement('canvas');cv.width=170;cv.height=200;paint(cv.getContext('2d'),c,{time:.6},85,185,120);const label=document.createElement('figcaption');label.textContent=c.name;f.append(cv,label);gallery.append(f);});document.querySelector('#status').textContent=CHARACTERS.length+' redesigned heroes · '+(CHARACTERS.length*6)+' pose checks · '+errors.length+' errors';}
// Coalesce the 17 image-load events. Painting 102 poses on every event thrashed
// the bounded runtime frame cache and stalled this review page during startup.
let sheetScheduled=false;
function scheduleSheet(){if(sheetScheduled)return;sheetScheduled=true;setTimeout(sheet,100);}
window.addEventListener('dashverse-art-change',()=>{if(Object.values(originals).every(i=>i.complete))scheduleSheet();});
Promise.all(Object.values(originals).map(i=>i.decode())).then(scheduleSheet);
</script></html>`;
writeFileSync(path.join(out,'index.html'),html);
console.log(out);
