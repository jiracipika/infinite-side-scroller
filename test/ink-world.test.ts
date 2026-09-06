import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawBackgroundSky, drawBackgroundParallax, type BackgroundRenderOpts } from '@/game/rendering/background';
const opts: BackgroundRenderOpts = { width:1280,height:720,cameraX:0,cameraY:0,gameTime:0,colors:{sky:'#211135',skyGradient:'#713a9b',ground:'#412859',groundDark:'#24132f',platform:'#9570ff'},detail:'high',reducedMotion:false };
function record(painter: typeof drawBackgroundSky, overrides: Partial<BackgroundRenderOpts> = {}) {
  const fills: Array<{color: unknown; points: number[][]}> = [];
  let points: number[][] = [];
  let depth = 0;
  const c = { fillStyle: '', save(){depth++;},restore(){depth--;},beginPath(){points=[];},closePath(){},moveTo(x:number,y:number){points.push([x,y]);},lineTo(x:number,y:number){points.push([x,y]);},fill(){fills.push({color:this.fillStyle,points:[...points]});},createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};} };
  const ctx = new Proxy(c, {get(target,key){return key in target ? target[key as keyof typeof c] : () => {};}});
  painter(ctx as unknown as CanvasRenderingContext2D,{...opts,...overrides});
  return {polygons:fills.filter(p=>p.points.length>=4),depth};
}
describe('ink world art',()=>{
  it('night sky has a large fractured polygon moon rather than a small circular light',()=>{
    const {polygons}=record(drawBackgroundSky);
    assert.ok(polygons.some(p=>p.points.length>=10 && Math.max(...p.points.map(v=>v[0]))-Math.min(...p.points.map(v=>v[0]))>=100));
  });
  it('buildings stay world anchored instead of drifting with the clouds',()=>{
    const a=record(drawBackgroundParallax,{gameTime:1});
    const b=record(drawBackgroundParallax,{gameTime:2});
    assert.deepEqual(a.polygons.map(p=>p.points), b.polygons.map(p=>p.points));
  });
  it('land and tower polygons use opaque colors',()=>{
    const {polygons}=record(drawBackgroundParallax);
    assert.ok(polygons.length>3);
    assert.ok(polygons.every(p=>typeof p.color==='string' && /^#[0-9a-f]{6}$/i.test(p.color)));
  });
  it('both fidelity tiers balance canvas state with bounded deterministic geometry',()=>{
    for (const detail of ['low','high'] as const) {
      const a=record(drawBackgroundParallax,{detail,reducedMotion:true});
      assert.equal(a.depth,0);
      assert.deepEqual(a,record(drawBackgroundParallax,{detail,reducedMotion:true}));
      assert.ok(a.polygons.length<70);
    }
  });
});
