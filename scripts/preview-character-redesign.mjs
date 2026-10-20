#!/usr/bin/env node
// Reproducible old / redesigned roster board + inspectable animation player.
// PLAYWRIGHT_PACKAGE may point at an existing npm-cache package.json.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.env.ART_SCREENSHOTS||path.join(root,'design/roster-redesign'));
mkdirSync(out,{recursive:true});
const {outputFiles}=await build({stdin:{contents:`
import {CHARACTERS} from './src/game/data/characters';
import {drawCharacterArt,drawOriginalCharacterArt} from './src/game/rendering/character-art';
window.art={CHARACTERS,drawCharacterArt,drawOriginalCharacterArt};`,resolveDir:root},bundle:true,format:'iife',write:false});
const bundle=outputFiles[0].text;
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>DashVerse — ink cast, second edition</title>
<style>body{margin:24px;background:#10101c;color:#f4f2ed;font:15px system-ui}button,select{font:inherit;padding:10px;background:#30263c;color:#f4f2ed;border:1px solid #8e799e;margin:4px}canvas{display:block;max-width:100%;height:auto}p{color:#bba6c9}button[aria-pressed=true]{background:#754294}</style>
<h1>The old soul. A new cast.</h1><p>Historical pre-sheet ink design at left. New ink design and poses to the right. Same real gameplay dimensions, enlarged 3× for inspection.</p>
<label>Preview <select id="character"></select></label><label>Action <select id="action"><option>run</option><option>idle</option><option>air</option><option>dash</option><option>melee</option><option>ranged</option><option>air + melee</option><option>tumble</option></select></label><button id="play" aria-pressed="true">Pause motion</button><canvas id="live" width="860" height="250"></canvas><canvas id="sheet"></canvas>
<script>${bundle}</script><script>
const {CHARACTERS,drawCharacterArt,drawOriginalCharacterArt}=window.art;
const poses=[['OLD INK',{},true],['NEW INK',{}],['RUN / REACH',{phase:.25,stride:2.4,moving:true}],['RUN / PASS',{phase:.5,stride:0,moving:true}],['JUMP',{airborne:true,verticalVelocity:-300}],['DASH',{dashing:true}],['ATTACK',{melee:.55}],['AIR + ATTACK',{airborne:true,melee:.55}],['TUMBLE',{airborne:true,tumble:.5}]];
const canvas=document.querySelector('#sheet'),ctx=canvas.getContext('2d');
canvas.width=1530;canvas.height=60+CHARACTERS.length*152;
ctx.fillStyle='#10101c';ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.fillStyle='#c7ff4d';ctx.font='bold 13px system-ui';
poses.forEach((p,i)=>ctx.fillText(p[0],115+i*157,28));
CHARACTERS.forEach((char,row)=>{const y=44+row*152;ctx.fillStyle='#f4f2ed';ctx.font='bold 13px system-ui';ctx.fillText(char.name,12,y+68);
poses.forEach(([label,pose,old],col)=>{const x=105+col*157;ctx.fillStyle=old?'#211b2b':'#191927';ctx.fillRect(x,y,151,146);ctx.save();ctx.translate(x+60,y+16);ctx.scale(3,3);ctx.translate(-char.width/2,0);(old?drawOriginalCharacterArt:drawCharacterArt)(ctx,char,char.width,char.height,pose);ctx.restore();});});
window.sheetReady=true;
const select=document.querySelector('#character');CHARACTERS.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.append(o)});
let playing=true,elapsed=0,last=performance.now();document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Pause motion':'Play motion';document.querySelector('#play').setAttribute('aria-pressed',playing)};
const reduce=matchMedia('(prefers-reduced-motion: reduce)');if(reduce.matches)document.querySelector('#play').click();
const live=document.querySelector('#live'),l=live.getContext('2d');
function tick(now){if(playing)elapsed+=Math.min(.05,(now-last)/1000);last=now;const c=CHARACTERS.find(c=>c.id===select.value);const a=document.querySelector('#action').value;const p={time:elapsed,phase:(elapsed*3)%1,stride:a==='run'?Math.sin(elapsed*Math.PI*6)*2.4:0,moving:a==='run',airborne:a.includes('air')||a==='tumble',dashing:a==='dash',melee:a.includes('melee')?(elapsed*1.6)%1:0,ranged:a==='ranged'?(elapsed*1.6)%1:0,tumble:a==='tumble'?(elapsed*.8)%1:0,verticalVelocity:Math.sin(elapsed*3)*400};l.fillStyle='#10101c';l.fillRect(0,0,860,250);for(const [i,draw] of [drawOriginalCharacterArt,drawCharacterArt].entries()){l.fillStyle='#bba6c9';l.font='13px system-ui';l.fillText(i?'REDESIGNED / LIVE MOTION':'ORIGINAL / REFERENCE',i*400+40,22);l.save();l.translate(200+i*400,45);l.scale(5,5);l.translate(-c.width/2,0);draw(l,c,c.width,c.height,p);l.restore()}requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`;
writeFileSync(path.join(out,'index.html'),html);
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(html);await page.waitForFunction(()=>window.sheetReady);const data=await page.locator('#sheet').evaluate(c=>c.toDataURL().split(',')[1]);writeFileSync(path.join(out,'old-vs-new.png'),Buffer.from(data,'base64'));for(const id of ['knight','ninja','cherry','velvet','grimshaw']){await page.selectOption('#character',id);await page.waitForTimeout(120);await page.locator('#live').screenshot({path:path.join(out,`${id}-motion.png`)});}if(errors.length)throw new Error(errors.join('\n'));console.log(JSON.stringify({characters:await page.evaluate(()=>window.art.CHARACTERS.map(c=>c.id)),poses:9,errors,output:out},null,2));}finally{await browser.close()}
