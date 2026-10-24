import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS} from '../src/game/data/characters';
import {CHARACTER_FULL_ART} from '../src/game/rendering/character-fullart-data';
import {FULL_ART_RIGS,bindVertex,deformVertex,resolveRigPose,solveJoint,type Point} from '../src/game/rendering/fullart-rig';
import {fullArtFrameKey,FULL_ART_FRAME_LIMIT} from '../src/game/rendering/fullart-mesh';

describe('painted character articulation',()=>{
  it('keeps the entire redesigned roster and includes the recovered Ranger',()=>{
    assert.deepEqual(Object.keys(FULL_ART_RIGS).sort(),CHARACTERS.map(c=>c.id).sort());
    assert.deepEqual(Object.keys(CHARACTER_FULL_ART).sort(),CHARACTERS.map(c=>c.id).sort());
    assert.ok(CHARACTER_FULL_ART.ranger.startsWith('data:image/webp;base64,'));
  });
  for(const {id} of CHARACTERS)it(id+': limbs animate independently, with connected joints and rigid held props',()=>{
    const rig=FULL_ART_RIGS[id],aspect=.72;
    const a=resolveRigPose(rig,aspect,{phase:.25,stride:2.4,moving:true,time:.2});
    const b=resolveRigPose(rig,aspect,{phase:.75,stride:-2.4,moving:true,time:.4});
    assert.notDeepEqual(a.bones[3].to,b.bones[3].to);
    assert.notDeepEqual(a.bones[5].to,b.bones[5].to);
    if(!rig.floating)assert.notDeepEqual(a.bones[7].to,b.bones[7].to);
    for(const pose of [a,b,resolveRigPose(rig,aspect,{airborne:true,verticalVelocity:-300}),resolveRigPose(rig,aspect,{melee:.5}),resolveRigPose(rig,aspect,{ranged:.5})]){
      for(const [upper,lower] of [[2,3],[4,5],[6,7],[8,9]])assert.deepEqual(pose.bones[upper].to,pose.bones[lower].from);
      for(const bone of pose.bones){
        const restLength=Math.hypot(bone.restTo[0]-bone.restFrom[0],bone.restTo[1]-bone.restFrom[1]);
        const posedLength=Math.hypot(bone.to[0]-bone.from[0],bone.to[1]-bone.from[1]);
        if(pose.bones.indexOf(bone)<6)assert.ok(Math.abs(restLength-posedLength)<1e-10);
      }
      for(let y=0;y<=1;y+=.1)for(let x=0;x<=1;x+=.1){
        const v=bindVertex(rig,aspect,[x,y]),p=deformVertex(v,pose);
        assert.ok(p.every(Number.isFinite));
        assert.ok(Math.abs(v.weights.reduce((n,w)=>n+w.weight,0)-1)<1e-10);
      }
    }
    // A held prop's endpoints are transformed by one forearm bone: rigid
    // rotation preserves its length, unlike skinning a staff through a robe.
    for(const prop of rig.props??[]){
      const bone=a.bones[prop.arm===0?3:5];
      const transform=(p:Point)=>deformVertex({source:[p[0]*aspect,p[1]],weights:[{bone:prop.arm===0?3:5,weight:1}],cloth:0},a);
      const p=prop.polygon[0],q=prop.polygon[1],u=transform(p),v=transform(q);
      assert.ok(Math.abs(Math.hypot(u[0]-v[0],u[1]-v[1])-Math.hypot((p[0]-q[0])*aspect,p[1]-q[1]))<1e-10);
      assert.ok(bone);
    }
    const paused={phase:.4,stride:1,moving:true,time:3,ranged:.3};
    assert.deepEqual(resolveRigPose(rig,aspect,paused),resolveRigPose(rig,aspect,paused));
    if(!rig.floating)assert.notDeepEqual(resolveRigPose(rig,aspect,{airborne:true,verticalVelocity:-300}),resolveRigPose(rig,aspect,{airborne:true,verticalVelocity:300}));
  });
  it('two-bone IK preserves bone lengths for a reachable planted foot',()=>{
    const a:Point=[0,0],b:Point=[.1,.2],c:Point=[0,.4],target:Point=[.1,.37];
    const j=solveJoint(a,b,c,target);
    assert.ok(Math.abs(Math.hypot(j[0],j[1])-Math.hypot(.1,.2))<1e-8);
    assert.ok(Math.abs(Math.hypot(j[0]-target[0],j[1]-target[1])-Math.hypot(.1,.2))<1e-8);
  });
  it('does not share frames across characters, flight direction, actions or gait halves',()=>{
    const poses=[{}, {moving:true,phase:.25}, {moving:true,phase:.75},{airborne:true,verticalVelocity:-1},{airborne:true,verticalVelocity:1},{dashing:true},{melee:.5},{ranged:.5}];
    assert.equal(new Set(poses.map(p=>fullArtFrameKey('knight',p))).size,poses.length);
    assert.notEqual(fullArtFrameKey('knight',{}),fullArtFrameKey('ranger',{}));
    assert.ok(FULL_ART_FRAME_LIMIT<=96);
  });
});
