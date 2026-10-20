import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS } from '@/game/data/characters';
import { drawCharacterArt, drawOriginalCharacterArt, type CharacterArtPose } from '@/game/rendering/character-art';
import { REDESIGNED_CHARACTER_IDS } from '@/game/rendering/ink-redesign';
import { advanceCharacterMotion, createCharacterMotion, type CharacterMotionInput } from '@/game/rendering/character-motion';
import { Player } from '@/game/entities/player';
import type { InputManager } from '@/game/input/input';

function paint(id: string, pose: CharacterArtPose, old = false) {
  const char = CHARACTERS.find(c=>c.id===id)!;
  const polygons: {color:string;points:number[][]}[]=[];
  const strokes: {color:string;points:number[][]}[]=[];
  let points:number[][]=[], depth=0;
  const ctx={fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,
    save(){depth++;},restore(){depth--;},translate(){},rotate(){},fillRect(){},strokeRect(){},
    beginPath(){points=[];},closePath(){},moveTo(x:number,y:number){points.push([x,y]);},lineTo(x:number,y:number){points.push([x,y]);},
    arc(x:number,y:number){points.push([x,y]);},
    fill(){polygons.push({color:this.fillStyle,points:[...points]});},stroke(){strokes.push({color:this.strokeStyle,points:[...points]});},
  };
  (old?drawOriginalCharacterArt:drawCharacterArt)(ctx as unknown as CanvasRenderingContext2D,char,char.width,char.height,pose);
  return {polygons,strokes,depth,alpha:ctx.globalAlpha};
}
const poses:CharacterArtPose[]=[{},...Array.from({length:8},(_,i)=>({phase:i/8,stride:Math.sin(i/8*Math.PI*2)*2.4,moving:true})),
  {airborne:true,verticalVelocity:-300},{airborne:true,verticalVelocity:450},{dashing:true},
  ...[.15,.4,.65,.9].flatMap(melee=>[{melee},{melee,airborne:true},{melee,dashing:true},{melee,airborne:true,dashing:true}]),
  {airborne:true,tumble:.5},{airborne:true,tumble:1},{ranged:.5},{ranged:.5,airborne:true},{ranged:.5,dashing:true}];

describe('second-edition full ink cast',()=>{
  it('redesigns exactly the entire playable roster with no missing/extra IDs',()=>{
    assert.deepEqual([...REDESIGNED_CHARACTER_IDS].sort(),CHARACTERS.map(c=>c.id).sort());
  });
  for(const char of CHARACTERS){
    it(`${char.id}: is a real redraw, not a restore or recolor`,()=>{
      const old=paint(char.id,{},true), fresh=paint(char.id,{});
      assert.notDeepEqual(fresh.polygons.map(p=>p.points),old.polygons.map(p=>p.points));
      assert.ok(fresh.polygons.length >= (['spirit','grimshaw'].includes(char.id) ? 12 : 16));
    });
    it(`${char.id}: whole pose grid is deterministic, opaque, bounded and balanced`,()=>{
      for(const pose of poses){
        const frame=paint(char.id,pose);
        assert.deepEqual(frame,paint(char.id,pose),JSON.stringify(pose));
        assert.equal(frame.depth,0);assert.equal(frame.alpha,1);
        for(const path of [...frame.polygons,...frame.strokes]){
          assert.match(path.color,/^#[a-f0-9]{6}$/i);
          for(const [x,y] of path.points){
            assert.ok(Number.isFinite(x)&&Number.isFinite(y));
            assert.ok(x>=-char.width*1.5&&x<=char.width*1.9,`${char.id} x=${x} ${JSON.stringify(pose)}`);
            assert.ok(y>=-char.height*.4&&y<=char.height*1.15,`${char.id} y=${y} ${JSON.stringify(pose)}`);
          }
        }
      }
    });
    it(`${char.id}: both gait halves, jump/fall, and layered strikes remain distinct`,()=>{
      assert.notDeepEqual(paint(char.id,{stride:0,phase:0,moving:true}),paint(char.id,{stride:0,phase:.5,moving:true}));
      for(const base of [{},{airborne:true},{dashing:true},{airborne:true,dashing:true}]){
        assert.notDeepEqual(paint(char.id,base),paint(char.id,{...base,melee:.5}));
        assert.notDeepEqual(paint(char.id,base),paint(char.id,{...base,ranged:.5}));
      }
      if(!['spirit','grimshaw'].includes(char.id))assert.notDeepEqual(paint(char.id,{airborne:true,verticalVelocity:-300}),paint(char.id,{airborne:true,verticalVelocity:450}));
    });
  }
  it('supports breathing without moving planted feet or changing physics',()=>{
    const char=CHARACTERS[0];const a=paint(char.id,{time:0}), b=paint(char.id,{time:.6});
    assert.notDeepEqual(a.polygons,b.polygons);
    const boots=(frame:ReturnType<typeof paint>)=>frame.polygons.flatMap(p=>p.points.filter(([,y])=>y>=char.height-2));
    assert.deepEqual(boots(a),boots(b));
  });
});

const base:CharacterMotionInput={x:0,width:24,onGround:true,dashing:false,vy:0,melee:0,ranged:0,tumble:0};
describe('character locomotion timing',()=>{
  it('advances equally for left/right travel and does not depend on vx snapshots',()=>{
    const initial=createCharacterMotion(0,0);
    const a=advanceCharacterMotion(initial,{...base,x:4},1/60);
    const b=advanceCharacterMotion(initial,{...base,x:-4},1/60);
    assert.equal(a.state.phase,b.state.phase);assert.ok(a.state.phase>0);
  });
  it('does not run legs in place at a wall or when a render repeats a simulation tick',()=>{
    let state=createCharacterMotion(0,0);
    for(let i=1;i<=30;i++)state=advanceCharacterMotion(state,base,i/60).state;
    assert.equal(state.phase,0);assert.equal(state.stride,0);
    const same=advanceCharacterMotion(state,base,state.time);
    assert.equal(same.state.phase,state.phase);assert.equal(same.state.stride,state.stride);
  });
  it('has the same phase at 30, 60 and 120 simulation Hz for the same travel',()=>{
    const phases=[30,60,120].map(hz=>{let state=createCharacterMotion(0,0);for(let i=1;i<=hz;i++)state=advanceCharacterMotion(state,{...base,x:i*200/hz},i/hz).state;return state.phase;});
    assert.ok(Math.max(...phases)-Math.min(...phases)<1e-10);
  });
  it('freezes gait during flight/dash but keeps melee and ranged pose layers',()=>{
    for(const flags of [{onGround:false},{dashing:true}]){
      const result=advanceCharacterMotion(createCharacterMotion(0,0),{...base,...flags,x:10,melee:.5,ranged:.4},.02);
      assert.equal(result.state.phase,0);assert.equal(result.pose.melee,.5);assert.equal(result.pose.ranged,.4);
    }
  });
  it('settles the stride quickly on stop instead of freezing a split stance',()=>{
    let state=advanceCharacterMotion(createCharacterMotion(0,0),{...base,x:12},.05).state;
    for(let i=1;i<=20;i++)state=advanceCharacterMotion(state,{...base,x:12},.05+i/60).state;
    assert.equal(state.stride,0);assert.equal(state.moving,false);
  });
  it('resets on teleports and new run clocks, not a burst of running',()=>{
    const state=advanceCharacterMotion(createCharacterMotion(0,0),{...base,x:12},.05).state;
    for(const result of [advanceCharacterMotion(state,{...base,x:500},.1),advanceCharacterMotion(state,base,0)]){
      assert.equal(result.state.phase,0);assert.equal(result.state.stride,0);
    }
  });
  it('reduced motion removes idle/tumble flourish but preserves action feedback and planted feet',()=>{
    const result=advanceCharacterMotion(createCharacterMotion(0,0),{...base,x:4,tumble:.7,melee:.3},.02,true);
    assert.equal(result.pose.tumble,0);assert.equal(result.pose.time,0);assert.equal(result.pose.melee,.3);assert.equal(result.bob,0);
  });
  it('a real shot starts and recovers the ranged animation without changing shot cadence',()=>{
    const p=new Player();const shot={isDown:(k:string)=>k==='KeyZ',isPressed:()=>false} as unknown as InputManager;
    const quiet={isDown:()=>false,isPressed:()=>false} as unknown as InputManager;
    p.update(1/60,shot,1000);assert.equal(p.projectiles.length,1);
    p.update(1/60,quiet,1000);assert.ok(p.rangedProgress>0&&p.rangedProgress<1);
    for(let i=0;i<20;i++)p.update(1/60,quiet,1000);
    assert.equal(p.rangedProgress,0);assert.equal(p.projectiles.length,1);
  });
});
