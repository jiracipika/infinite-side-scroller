import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const out=process.env.ART_SCREENSHOTS||'/tmp/dashverse-art';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:3010');
 await page.getByRole('button',{name:/Play Endless/}).waitFor();
 await page.waitForTimeout(700); // Allow the existing comic-cover entrance to finish.
 await page.screenshot({path:`${out}/menu.png`});
 await page.getByRole('button',{name:/Play Endless/}).click();
 await page.evaluate(()=>{const c=document.querySelector('canvas');let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){for(let h=f.memoizedState;h;h=h.next){const e=h.memoizedState?.current;if(e?.player&&e?.getLocalPlayerSnapshot){window.__engine=e;break;}}if(window.__engine)break;f=f.return;}});
 await page.waitForFunction(()=>window.__engine?.player.onGround);
 const before=await page.evaluate(()=>window.__engine.getLocalPlayerSnapshot());
 await page.screenshot({path:`${out}/gameplay.png`});
 // Trusted keyboard events exercise the real live engine, no synthetic snapshots.
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.down('Space');
 await page.waitForFunction(()=>window.__engine.player.vy<0);
 const jump=await page.evaluate(()=>window.__engine.getLocalPlayerSnapshot());
 assert.ok(jump.x>before.x,'live player moves right');assert.ok(jump.y<before.y,'live player jumps');
 await page.screenshot({path:`${out}/traversal.png`});await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');
 await page.keyboard.down('KeyC');
 await page.waitForFunction(()=>window.__engine.player.meleeActive);
 const attack=await page.evaluate(()=>({active:window.__engine.player.meleeActive,progress:window.__engine.player.meleeProgress}));
 await page.screenshot({path:`${out}/combat.png`});await page.keyboard.up('KeyC');
 await page.keyboard.down('ShiftLeft');
 await page.waitForFunction(()=>window.__engine.player.dashing);
 await page.screenshot({path:`${out}/dash.png`});await page.keyboard.up('ShiftLeft');
 // Runtime stress sample: hold still; report measured rAF, not a device FPS claim.
 const frames=await page.evaluate(()=>new Promise(resolve=>{const times=[];let last=performance.now();const tick=t=>{times.push(t-last);last=t;if(times.length===120)resolve(times);else requestAnimationFrame(tick);};requestAnimationFrame(tick);}));
 assert.deepEqual(errors,[]);
 const sorted=frames.slice(5).sort((a,b)=>a-b);
 const report={before,jump,attack,errors,headlessFrameMs:{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]},screenshots:out};
 writeFileSync(`${out}/evidence.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
