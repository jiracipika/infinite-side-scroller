#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.env.ART_SCREENSHOTS||path.join(root,'artifacts/character-redesign'));
const url=process.env.GAME_URL||'http://127.0.0.1:3010';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const ids=['knight','ninja','tank','mage','ranger','cyborg','spirit','healer','cherry','velvet','ember','rosalia','marionette','dorian','onyx','mortimer','grimshaw'];
const melee=new Set(['knight','ninja','tank','cyborg','cherry','velvet','ember','rosalia','marionette','dorian','onyx','mortimer','grimshaw']);
const reports=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__sheetDraws=0;
    const original=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
      if(image instanceof HTMLImageElement&&image.src.startsWith('data:image/png'))window.__sheetDraws++;
      return original.call(this,image,...args);
    };
  });
  await page.goto(url);
  await page.getByRole('button',{name:/Play Endless/}).waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByRole('button',{name:/Play Endless/}).evaluate(e=>{
    while(e){if(Number(getComputedStyle(e).opacity)<.99)return false;e=e.parentElement;}return true;
  }),true,'reduced-motion hydration must not hide the Play CTA');
  assert.equal(await page.evaluate(()=>window.__sheetDraws),0,'Ink default must stay procedural after sheets load');
  const hero=page.locator('.dash-character-stage-v3 canvas');
  const ink=await hero.evaluate(c=>c.toDataURL());
  await page.getByRole('button',{name:'Pixel',exact:true}).click();
  await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>window.__sheetDraws)>0,'Pixel toggle really draws sheets');
  const pixel=await hero.evaluate(c=>c.toDataURL());assert.notEqual(ink,pixel);
  await page.getByRole('button',{name:'Ink',exact:true}).click();
  assert.equal(await hero.evaluate(c=>c.toDataURL()),ink,'Ink switch repaints the menu immediately');
  for(const [width,height] of [[1280,630],[390,844]]){
    await page.setViewportSize({width,height});await page.screenshot({path:path.join(out,`menu-${width}.png`),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal menu overflow');
    await hero.scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,`roster-${width}.png`)});
    const box=await hero.boundingBox();assert.ok(box && box.x>=0 && box.x+box.width<=width,'hero fully inside viewport');
  }
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:/Play Endless/}).click();
  await page.evaluate(()=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){for(let h=f.memoizedState;h;h=h.next){const e=h.memoizedState?.current;if(e?.player&&e?.getLocalPlayerSnapshot){window.__engine=e;break}}if(window.__engine)break;f=f.return}});
  await page.addScriptTag({content:readFileSync(path.join(root,'scripts/lib/capture-rendered-frame.mjs'),'utf8').replace(/^export /gm,'')});
  const arm=action=>page.evaluate(action=>{window.__capturePromise=captureRenderedFrame({action,timeoutMs:6000});},action);
  const finish=async(id,action)=>{
    const result=await page.evaluate(()=>window.__capturePromise);
    assert.ok(result.canvas&&result.renderSequence>0);
    writeFileSync(path.join(out,`${id}-${action}.png`),Buffer.from(result.canvas.split(',')[1],'base64'));
    const {canvas,...evidence}=result;return evidence;
  };
  for(const id of ids){
    await page.evaluate(id=>{const e=window.__engine;e.setSeed(42,id);e.resume();},id);
    await page.waitForFunction(()=>window.__engine.player.onGround);
    await arm('idle');const idle=await finish(id,'idle');
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);
    await arm('run');const run=await finish(id,'run');await page.keyboard.up('ArrowRight');
    assert.ok(run.snapshot.x>idle.snapshot.x,`${id}: real traversal`);
    await page.waitForTimeout(160);
    await arm('jump');await page.keyboard.down('Space');const jump=await finish(id,'jump');await page.keyboard.up('Space');
    assert.ok(jump.vy<0);
    const action=melee.has(id)?'air-combat':'ranged',key=melee.has(id)?'KeyC':'KeyZ';
    await page.waitForFunction(()=>window.__engine.player.onGround);
    await arm(action);await page.keyboard.down('Space');await page.keyboard.down(key);
    const attack=await finish(id,action);await page.keyboard.up(key);await page.keyboard.up('Space');
    await arm('dash');await page.keyboard.down('ShiftLeft');const dash=await finish(id,'dash');await page.keyboard.up('ShiftLeft');
    assert.ok(dash.dashing);
    reports.push({id,idle,run,jump,attack,dash});
  }
  const timings=await page.evaluate(()=>{
    const e=window.__engine;e.pause();
    const samples=[];for(let i=0;i<120;i++){const t=performance.now();e.render();samples.push(performance.now()-t);}
    const sorted=samples.slice(10).sort((a,b)=>a-b);return {renderMedianMs:sorted[Math.floor(sorted.length*.5)],renderP95Ms:sorted[Math.floor(sorted.length*.95)]};
  });
  assert.deepEqual(errors,[]);
  assert.equal(reports.length,ids.length);assert.deepEqual(reports.map(r=>r.id).sort(),ids.slice().sort());
  writeFileSync(path.join(out,'evidence.json'),JSON.stringify({url,ids,verifiedCharacters:reports.length,errors,timings,reports},null,2));
  console.log(JSON.stringify({verifiedCharacters:reports.length,renderBoundFrames:reports.length*5,errors,timings,output:out},null,2));
}finally{await browser.close()}
