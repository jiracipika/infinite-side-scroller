import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = process.env.EVIDENCE_DIR || '/tmp/dashverse-ink-evidence';
mkdirSync(out, {recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.getByRole('button',{name:'Ninja',exact:true}).click();
  await page.getByRole('button',{name:/Play Endless/}).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await page.evaluate(()=>{
    const canvas=document.querySelector('canvas');
    let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
    while(f){
      for(let h=f.memoizedState;h;h=h.next){const e=h.memoizedState?.current;if(e?.player&&e?.getLocalPlayerSnapshot){window.__engine=e;break;}}
      if(window.__engine)break;f=f.return;
    }
  });
  await page.waitForFunction(()=>window.__engine?.player.onGround);
  const initial=await page.evaluate(()=>({x:window.__engine.player.x,y:window.__engine.player.y}));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  const moved=await page.evaluate(()=>({x:window.__engine.player.x,y:window.__engine.player.y}));
  assert.ok(moved.x>initial.x+5,'Trusted keyboard input moves real player');
  assert.ok(moved.y<initial.y-5,'Trusted jump lifts real player');
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  await page.screenshot({path:`${out}/gameplay-dawn.png`});
  // QA-only sky clock control: same live run, force night to inspect the moon.
  await page.evaluate(()=>{window.__engine.skyClockOffset=-window.__engine.gameTime;});
  await page.waitForTimeout(120);
  await page.screenshot({path:`${out}/gameplay-night.png`});
  await page.waitForTimeout(2500);
  const metrics=await page.evaluate(()=>window.__engine.profiler.getMetrics());
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Resume/i}).waitFor();
  assert.deepEqual(errors,[]);
  const evidence={url:page.url(),viewport:{width:1280,height:720,dpr:2},initial,moved,metrics,errors,skyClock:'night screenshot uses QA-only skyClockOffset; physics/input unchanged'};
  writeFileSync(`${out}/runtime.json`,JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
  console.log('PASS: live Ninja movement, jump, dawn/night render and pause');
} finally {await browser.close();}
