#!/usr/bin/env node
// Exercise the exact checked-in offline WebView HTML, not the web app bundle.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const out=path.resolve(process.env.ART_SCREENSHOTS||path.join(root,'artifacts/mobile-character-redesign'));mkdirSync(out,{recursive:true});
const ids=['knight','ninja','tank','mage','ranger','cyborg','spirit','healer','cherry','velvet','ember','rosalia','marionette','dorian','onyx','mortimer','grimshaw'];
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(readFileSync(path.join(root,'apps/mobile/assets/game.html'),'utf8'));
  await page.waitForFunction(()=>window.__gameControls&&window.__gameEngine);
  const results=[];
  for(const id of ids){
    await page.evaluate(id=>{window.__gameControls.setCharacter(id);window.__gameControls.resume();},id);
    await page.waitForFunction(()=>window.__gameEngine.player.onGround);
    const before=await page.evaluate(()=>window.__gameEngine.player.x);
    // Native shell messages enter through this exact postMessage bridge.
    await page.evaluate(()=>window.postMessage(JSON.stringify({type:'move-right',value:true}),'*'));
    await page.waitForTimeout(140);
    const move=await page.evaluate(()=>({x:window.__gameEngine.player.x,id:window.__gameEngine.player.characterId}));
    assert.equal(move.id,id);assert.ok(move.x>before,`${id}: native move bridge`);
    await page.evaluate(()=>{window.postMessage(JSON.stringify({type:'move-right',value:false}),'*');window.postMessage(JSON.stringify({type:'jump-press',value:true}),'*')});
    await page.waitForFunction(()=>window.__gameEngine.player.vy<0);
    const jump=await page.evaluate(()=>window.__gameEngine.player.vy);assert.ok(jump<0);
    await page.evaluate(()=>window.postMessage(JSON.stringify({type:'jump-press',value:false}),'*'));
    await page.screenshot({path:path.join(out,`${id}.png`)});
    results.push({id,moved:true,jumped:true});
  }
  assert.deepEqual(errors,[]);assert.equal(results.length,ids.length);
  writeFileSync(path.join(out,'evidence.json'),JSON.stringify({verifiedCharacters:results.length,offlineHtml:true,errors,results},null,2));
  console.log(JSON.stringify({verifiedCharacters:results.length,offlineHtml:true,nativeBridge:'move + jump',errors,output:out},null,2));
}finally{await browser.close()}
