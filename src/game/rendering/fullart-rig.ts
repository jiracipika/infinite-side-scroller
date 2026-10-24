import type { CharacterArtPose } from './character-art';

/** Non-destructive skinning: landmarks refer to the original painted figure.
 * No replacement sprites, palette changes, or procedural stand-in limbs.
 * Coordinates are fractions of each source image, NOT collision dimensions. */
export type Point = readonly [number, number];
export interface Limb { root: Point; joint: Point; tip: Point }
export interface ArtRig {
  neck: Point; hip: Point;
  arms: readonly [Limb, Limb]; legs: readonly [Limb, Limb];
  headY: number; hemY: number; floating?: boolean;
  /** Staff/blade/bow ownership follows the actual hand, not a global wobble. */
  props?: readonly { polygon: readonly Point[]; arm: 0 | 1 }[];
}
const limb = (a: Point, b: Point, c: Point): Limb => ({ root: a, joint: b, tip: c });
const base: ArtRig = {
  neck: [.55,.43], hip: [.55,.72], headY: .42, hemY: .72,
  arms: [limb([.36,.48],[.28,.60],[.23,.69]),limb([.71,.49],[.78,.61],[.79,.70])],
  legs: [limb([.46,.73],[.40,.84],[.36,.97]),limb([.62,.73],[.66,.85],[.72,.97])],
};
/** Per-character fitting matters: hats, skirts, shields and raised hands do
 * not share a bounding-box skeleton. Keep these alongside the source art. */
export const FULL_ART_RIGS: Record<string, ArtRig> = {
  knight: {...base,neck:[.61,.45],hip:[.62,.73],headY:.44,
    arms:[limb([.44,.49],[.33,.60],[.28,.69]),limb([.82,.51],[.86,.62],[.86,.71])],
    legs:[limb([.51,.73],[.43,.85],[.39,.96]),limb([.72,.74],[.76,.85],[.79,.96])],
    props:[{arm:0,polygon:[[0,.96],[.02,.85],[.31,.67],[.43,.66],[.42,.75],[.12,.97]]}]},
  ninja: {...base,neck:[.61,.40],hip:[.58,.69],headY:.41,
    arms:[limb([.44,.47],[.32,.57],[.28,.66]),limb([.73,.47],[.78,.57],[.83,.65])],
    legs:[limb([.49,.70],[.42,.83],[.31,.96]),limb([.66,.70],[.72,.83],[.79,.96])],
    props:[{arm:0,polygon:[[0,.87],[.03,.81],[.31,.63],[.40,.65],[.23,.77]]}]},
  ranger: {...base,neck:[.54,.43],hip:[.55,.73],headY:.43,
    arms:[limb([.38,.49],[.32,.61],[.30,.69]),limb([.73,.53],[.79,.64],[.83,.73])],
    legs:[limb([.48,.75],[.42,.86],[.36,.97]),limb([.67,.75],[.68,.86],[.73,.97])],
    props:[{arm:1,polygon:[[.81,.45],[.99,.37],[1,.75],[.84,.86],[.79,.83],[.88,.67]]}]},
  tank: {...base,neck:[.59,.38],hip:[.57,.72],headY:.39,
    arms:[limb([.31,.43],[.25,.58],[.23,.68]),limb([.78,.44],[.83,.58],[.85,.68])],
    legs:[limb([.44,.74],[.37,.85],[.31,.97]),limb([.66,.74],[.68,.85],[.73,.97])],
    props:[{arm:1,polygon:[[.78,.32],[.99,.34],[1,.88],[.80,.88]]}]},
  cyborg: {...base,neck:[.55,.39],hip:[.55,.68],headY:.40,
    arms:[limb([.30,.43],[.23,.55],[.18,.66]),limb([.75,.44],[.82,.54],[.88,.65])],
    legs:[limb([.43,.70],[.38,.83],[.35,.97]),limb([.65,.70],[.65,.83],[.74,.97])],
    props:[{arm:0,polygon:[[.04,.48],[.20,.52],[.25,.67],[.02,.86],[.02,.68]]}]},
  mage: {...base,neck:[.55,.53],hip:[.56,.79],headY:.52,hemY:.67,
    arms:[limb([.44,.59],[.31,.64],[.28,.63]),limb([.75,.62],[.86,.67],[.88,.60])],
    legs:[limb([.45,.78],[.44,.88],[.43,.96]),limb([.65,.78],[.67,.88],[.70,.96])],
    props:[{arm:0,polygon:[[.15,.27],[.28,.32],[.29,.42],[.24,.46],[.45,.79],[.41,.80],[.18,.50],[.03,.46],[.01,.40],[.04,.33]]}]},
  healer: {...base,neck:[.58,.43],hip:[.57,.76],headY:.43,hemY:.65,
    arms:[limb([.39,.50],[.31,.60],[.29,.67]),limb([.74,.50],[.80,.62],[.86,.71])],
    legs:[limb([.49,.78],[.49,.87],[.48,.96]),limb([.65,.78],[.65,.87],[.67,.96])],
    props:[{arm:0,polygon:[[0,.02],[.30,.02],[.37,.13],[.34,.24],[.25,.32],[.16,.34],[.02,.25]]},{arm:0,polygon:[[.20,.27],[.28,.27],[.45,.98],[.37,.98]]}]},
  spirit: {...base,neck:[.55,.40],hip:[.54,.64],headY:.40,hemY:.53,floating:true,
    arms:[limb([.37,.45],[.26,.52],[.20,.59]),limb([.73,.45],[.81,.52],[.86,.60])]},
  grimshaw: {...base,neck:[.48,.42],hip:[.47,.68],headY:.42,hemY:.59,floating:true,
    arms:[limb([.31,.49],[.23,.56],[.15,.60]),limb([.64,.49],[.71,.58],[.74,.63])],
    props:[{arm:1,polygon:[[.67,0],[1,0],[1,.27],[.84,.32],[.76,.80],[.65,.82],[.76,.27],[.69,.22]]}]},
  cherry: {...base,neck:[.49,.41],hip:[.51,.63],headY:.41,hemY:.60,
    arms:[limb([.37,.44],[.28,.45],[.25,.50]),limb([.64,.45],[.69,.53],[.73,.59])],
    legs:[limb([.43,.66],[.34,.77],[.35,.87]),limb([.58,.67],[.60,.82],[.56,.97])]},
  velvet: {...base,neck:[.53,.33],hip:[.52,.61],headY:.33,hemY:.53,
    arms:[limb([.37,.38],[.30,.48],[.27,.52]),limb([.67,.39],[.73,.46],[.69,.52])]},
  ember: {...base,neck:[.57,.30],hip:[.56,.59],headY:.30,hemY:.60,
    arms:[limb([.39,.35],[.30,.40],[.23,.46]),limb([.70,.36],[.78,.43],[.82,.49])],
    legs:[limb([.51,.61],[.47,.76],[.41,.95]),limb([.64,.61],[.66,.77],[.69,.95])]},
  rosalia: {...base,neck:[.51,.30],hip:[.51,.57],headY:.30,hemY:.53,
    arms:[limb([.37,.35],[.30,.45],[.31,.51]),limb([.65,.35],[.72,.43],[.73,.48])]},
  marionette: {...base,neck:[.50,.37],hip:[.51,.62],headY:.36,hemY:.58,
    arms:[limb([.36,.41],[.28,.47],[.19,.54]),limb([.65,.42],[.76,.50],[.86,.54])],
    legs:[limb([.44,.65],[.43,.80],[.40,.96]),limb([.60,.65],[.64,.79],[.68,.95])]},
  dorian: {...base,neck:[.53,.39],hip:[.53,.65],headY:.38,hemY:.67,
    arms:[limb([.38,.44],[.27,.44],[.23,.49]),limb([.67,.46],[.75,.52],[.77,.58])],
    legs:[limb([.46,.68],[.47,.82],[.47,.96]),limb([.60,.68],[.65,.82],[.70,.96])],
    props:[{arm:0,polygon:[[0,.48],[.31,.42],[.36,.46],[.07,.61],[0,.61]]}]},
  onyx: {...base,neck:[.53,.34],hip:[.53,.67],headY:.35,
    arms:[limb([.37,.41],[.25,.41],[.23,.31]),limb([.72,.42],[.79,.56],[.84,.68])],
    legs:[limb([.43,.69],[.37,.83],[.29,.96]),limb([.66,.69],[.69,.83],[.77,.96])],
    props:[{arm:0,polygon:[[0,.27],[.92,0],[1,.08],[.97,.25],[.31,.37],[.05,.38]]}]},
  mortimer: {...base,neck:[.54,.35],hip:[.55,.66],headY:.35,hemY:.64,
    arms:[limb([.37,.40],[.29,.51],[.18,.49]),limb([.72,.41],[.77,.52],[.72,.59])],
    legs:[limb([.48,.69],[.48,.82],[.46,.96]),limb([.63,.69],[.64,.82],[.68,.96])],
    props:[{arm:0,polygon:[[0,.20],[.28,.20],[.31,.45],[.19,.53],[.04,.49]]}]},
};

export interface Bone { from: Point; to: Point; restFrom: Point; restTo: Point }
export interface RigPose { bones: Bone[]; cloth: number; bodyY: number }
const add = (p: Point, x: number, y: number): Point => [p[0]+x,p[1]+y];
const rotate = (p: Point, origin: Point, angle: number): Point => {
  const x=p[0]-origin[0],y=p[1]-origin[1],c=Math.cos(angle),s=Math.sin(angle);
  return [origin[0]+x*c-y*s,origin[1]+x*s+y*c];
};
const unit = (p: Point, aspect: number): Point => [p[0]*aspect,p[1]];
const clamp = (n: number, a: number, b: number) => Math.max(a,Math.min(b,n));

/** Two-bone inverse kinematics keeps the support foot planted. Knees bend
 * instead of stretching a whole lower-body card; swing feet clear the floor. */
export function solveJoint(a: Point, b: Point, c: Point, target: Point): Point {
  const upper=Math.hypot(b[0]-a[0],b[1]-a[1]),lower=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const dx=target[0]-a[0],dy=target[1]-a[1];
  const d=clamp(Math.hypot(dx,dy),Math.abs(upper-lower)+.0001,upper+lower-.0001);
  const along=(upper*upper-lower*lower+d*d)/(2*d);
  const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
  const direction=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>=0?-1:1;
  const length=Math.max(.0001,Math.hypot(dx,dy));
  return [a[0]+dx/length*along-dy/length*bend*direction,a[1]+dy/length*along+dx/length*bend*direction];
}

/** Bone order: torso, head, rear upper/forearm, front upper/forearm,
 * rear thigh/calf, front thigh/calf. Shared by menus, local and remote play. */
export function resolveRigPose(rig: ArtRig, aspect: number, pose: CharacterArtPose = {}): RigPose {
  const phase=(pose.phase??0)*Math.PI*2;
  // stride decays on stopping, so limbs settle even though phase is frozen.
  const gain=pose.moving?1:clamp(Math.abs(pose.stride??0)/2.4,0,1);
  const swing=Math.sin(phase)*gain;
  const time=pose.moving?phase/2.5:(pose.time??0);
  const melee=Math.sin(clamp(pose.melee??0,0,1)*Math.PI);
  const cast=Math.sin(clamp(pose.ranged??0,0,1)*Math.PI);
  const air=!!pose.airborne,dash=!!pose.dashing;
  const bodyY=rig.floating?Math.sin(time*2.5)*.012:gain*(-.008-Math.cos(phase*2)*.005)+Math.sin(time*2.1)*.002;
  const hip=unit(rig.hip,aspect),neck=unit(rig.neck,aspect);
  const rootShift: Point=[dash?.015:melee*.012,bodyY];
  const shift=(p:Point)=>add(p,rootShift[0],rootShift[1]);
  const torsoTilt=dash?-.12:air?-.04:gain*.025+melee*.025;
  const torsoPoint=(p:Point)=>rotate(shift(p),shift(hip),torsoTilt);
  const bones:Bone[]=[];
  const bone=(a:Point,b:Point,from:Point,to:Point)=>bones.push({restFrom:a,restTo:b,from,to});
  bone(hip,neck,shift(hip),torsoPoint(neck));
  const crown:Point=[neck[0],Math.max(.04,rig.headY-.22)];
  bone(neck,crown,torsoPoint(neck),rotate(torsoPoint(crown),torsoPoint(neck),-torsoTilt*.7+Math.sin(time*1.6)*.008));
  rig.arms.forEach((l,i)=>{
    const a=unit(l.root,aspect),b=unit(l.joint,aspect),c=unit(l.tip,aspect);
    const root=torsoPoint(a);
    let upper=(i===0?1:-1)*swing*.32;
    let elbow=.08+Math.max(0,(i===0?-swing:swing))*.35;
    if(air){upper=(i===0?.20:-.35);elbow=.45;}
    if(dash){upper=.65;elbow=.4;}
    if(i===0){upper-=melee*.78+cast*.32;elbow-=melee*.38+cast*.18;}
    else {upper+=melee*.32-cast*.25;elbow+=cast*.42;}
    upper+=Math.sin(time*2.1+i)*.012;
    const joint=rotate(add(b,root[0]-a[0],root[1]-a[1]),root,upper);
    const tip=rotate(add(c,joint[0]-b[0],joint[1]-b[1]),joint,upper+elbow);
    bone(a,b,root,joint);bone(b,c,joint,tip);
  });
  rig.legs.forEach((l,i)=>{
    const a=unit(l.root,aspect),b=unit(l.joint,aspect),c=unit(l.tip,aspect);
    const root=shift(a),cycle=phase+i*Math.PI;
    let target:Point=add(c,Math.cos(cycle)*.065*gain,-Math.max(0,Math.sin(cycle))*.055*gain);
    if(air){const rising=(pose.verticalVelocity??0)<0;target=add(c,i===0?-.035:.035,rising?(i===0?-.12:-.07):-.035);}
    if(dash)target=add(c,i===0?-.08:.055,-.025);
    if(rig.floating)target=add(c,Math.sin(time*2.5+i)*.02,bodyY);
    const joint=solveJoint(root,add(b,root[0]-a[0],root[1]-a[1]),add(c,root[0]-a[0],root[1]-a[1]),target);
    bone(a,b,root,joint);bone(b,c,joint,target);
  });
  return {bones,bodyY,cloth:(pose.moving?Math.sin(phase-.7)*.020:Math.sin(time*3.8)*.008)+(dash?.035:0)};
}

function distance(p:Point,a:Point,b:Point):number {
  const x=b[0]-a[0],y=b[1]-a[1];
  const t=clamp(((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1),0,1);
  return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-y*t);
}
export function inPolygon(p:Point,polygon:readonly Point[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export interface SkinVertex { source: Point; weights: readonly { bone: number; weight: number }[]; cloth: number }

/** Bind once per image. Broad central areas retain the painted torso, while
 * distance weights blend shoulders/knees with no cut seams or exposed holes. */
export function bindVertex(rig:ArtRig,aspect:number,point:Point):SkinVertex {
  const p=unit(point,aspect);
  const rest=resolveRigPose(rig,aspect,{}).bones;
  if(point[1]<rig.headY)return {source:p,weights:[{bone:1,weight:1}],cloth:0};
  const candidates:{bone:number;distance:number}[]=[{bone:0,distance:distance(p,rest[0].restFrom,rest[0].restTo)*.80}];
  // Long skirts and spectral tails are cloth, not two fabricated trouser legs.
  const skirt=rig.hemY<.70&&point[1]>rig.hemY&&point[1]<.88;
  for(let i=2;i<rest.length;i++){
    if(i>=6&&(rig.floating||skirt))continue;
    if(i>=6&&point[1]<rig.hip[1]-.035)continue;
    if(i<6&&point[1]>rig.hip[1]+.06)continue;
    candidates.push({bone:i,distance:distance(p,rest[i].restFrom,rest[i].restTo)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  const pair=candidates.slice(0,2);
  const raw=pair.map(v=>1/Math.pow(v.distance+.008,5)),total=raw.reduce((a,b)=>a+b,0);
  const edge=Math.abs(point[0]-rig.hip[0]);
  const cloth=skirt||rig.floating?Math.max(0,(point[1]-rig.hemY)/(1-rig.hemY)):edge>.29&&point[1]>.38?.6:0;
  return {source:p,weights:pair.map((v,i)=>({bone:v.bone,weight:raw[i]/total})),cloth};
}

export function deformVertex(vertex:SkinVertex,pose:RigPose):Point {
  let x=0,y=0;
  for(const {bone,weight} of vertex.weights){
    const b=pose.bones[bone];
    const angle=Math.atan2(b.to[1]-b.from[1],b.to[0]-b.from[0])-Math.atan2(b.restTo[1]-b.restFrom[1],b.restTo[0]-b.restFrom[0]);
    const p=rotate(vertex.source,b.restFrom,angle);
    x+=(p[0]+b.from[0]-b.restFrom[0])*weight;
    y+=(p[1]+b.from[1]-b.restFrom[1])*weight;
  }
  return [x+pose.cloth*vertex.cloth,y+Math.abs(pose.cloth)*vertex.cloth*.2];
}
