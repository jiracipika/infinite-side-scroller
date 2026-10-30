import type { CharacterArtPose } from './character-art';
import { attackGesture, characterPerformance, type CharacterPerformance } from './character-performance';

/** Non-destructive skinning: landmarks refer to the original painted figure.
 * No replacement sprites, palette changes, or procedural stand-in limbs.
 * Coordinates are fractions of each source image, NOT collision dimensions. */
export type Point = readonly [number, number];
export interface Limb { root: Point; joint: Point; tip: Point }
export interface ArtRig {
  performance?: CharacterPerformance;
  neck: Point; hip: Point;
  arms: readonly [Limb, Limb]; legs: readonly [Limb, Limb];
  headY: number; hemY: number; floating?: boolean;
  longGown?: boolean;
  /** Staff/blade/bow ownership follows the actual hand, not a global wobble. */
  props?: readonly {
    polygon: readonly Point[]; arm: 0 | 1; behindBody?: boolean;
    /** Continue an originally occluded weapon shaft beneath the source pixels. */
    shaft?: { from: Point; to: Point; width: number };
  }[];
  /** Body silhouettes in front of an overlapping weapon stay on the body. */
  propExclusions?: readonly (readonly Point[])[];
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
  ninja: {...base,neck:[.675,.492],hip:[.644,.693],headY:.47,
    arms:[limb([.505,.542],[.39,.625],[.293,.685]),limb([.759,.527],[.86,.587],[.932,.673])],
    legs:[limb([.563,.693],[.438,.798],[.288,.935]),limb([.741,.694],[.812,.788],[.84,.916])],
    props:[{arm:0,polygon:[[.04,.86],[.07,.8],[.29,.65],[.34,.67],[.31,.73],[.12,.85]]}]},
  ranger: {...base,neck:[.54,.43],hip:[.55,.73],headY:.43,
    arms:[limb([.38,.49],[.32,.61],[.30,.69]),limb([.73,.53],[.79,.64],[.83,.73])],
    legs:[limb([.48,.75],[.42,.86],[.36,.97]),limb([.67,.75],[.68,.86],[.73,.97])],
    props:[{arm:1,polygon:[[.81,.45],[.99,.37],[1,.75],[.84,.86],[.79,.83],[.88,.67]]}]},
  tank: {...base,neck:[.59,.38],hip:[.57,.72],headY:.39,
    arms:[limb([.31,.43],[.25,.58],[.23,.68]),limb([.78,.44],[.83,.58],[.85,.68])],
    legs:[limb([.44,.74],[.37,.85],[.31,.97]),limb([.66,.74],[.68,.85],[.73,.97])],
    props:[{arm:1,polygon:[[.78,.32],[.99,.34],[1,.88],[.8,.88]]}]},
  cyborg: {...base,neck:[.55,.39],hip:[.55,.68],headY:.4,
    arms:[limb([.3,.43],[.23,.55],[.18,.66]),limb([.75,.44],[.82,.54],[.88,.65])],
    legs:[limb([.43,.7],[.38,.83],[.35,.97]),limb([.65,.7],[.65,.83],[.74,.97])],
    props:[{arm:0,polygon:[[.04,.48],[.2,.52],[.25,.67],[.02,.86],[.02,.68]]}]},
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
  grimshaw: {...base,neck:[.4792,.4442],hip:[.4691,.72],headY:.4442,hemY:.6245,floating:true,
    arms:[limb([.3089,.5185],[.2288,.5927],[.1486,.6352]),limb([.6394,.5185],[.7095,.6139],[.7396,.667])],
    props:[{arm:1,polygon:[[.6695,-0.0012],[1,-0.0012],[1,.2852],[.8397,.3382],[.7596,.8473],[.6494,.8685],[.7596,.2852],[.6895,.2321]]}]},
  cherry: {...base,neck:[.52,.384],hip:[.54,.55],headY:.38,hemY:.605,
    arms:[limb([.406,.39],[.35,.445],[.255,.47]),limb([.65,.405],[.725,.5],[.815,.575])],
    legs:[limb([.48,.66],[.46,.75],[.35,.85]),limb([.59,.66],[.58,.84],[.51,.95])]},
  velvet: {...base,neck:[.58,.232],hip:[.559,.423],headY:.235,hemY:.45,longGown:true,
    arms:[limb([.472,.261],[.427,.373],[.383,.495]),limb([.692,.261],[.734,.323],[.674,.244])]},
  ember: {...base,neck:[.578,.387],hip:[.55,.568],headY:.37,hemY:.60,
    arms:[limb([.454,.422],[.365,.485],[.258,.518]),limb([.675,.394],[.723,.319],[.697,.222])],
    legs:[limb([.57,.65],[.55,.78],[.54,.93]),limb([.65,.62],[.65,.77],[.61,.91])]},
  rosalia: {...base,neck:[.574,.216],hip:[.582,.415],headY:.215,hemY:.44,longGown:true,
    arms:[limb([.478,.263],[.498,.418],[.473,.573]),limb([.695,.258],[.747,.315],[.677,.232])]},
  marionette: {...base,neck:[.484,.461],hip:[.504,.627],headY:.45,hemY:.60,
    arms:[limb([.378,.502],[.273,.557],[.156,.589]),limb([.611,.489],[.782,.533],[.869,.586])],
    legs:[limb([.418,.711],[.376,.819],[.387,.888]),limb([.6,.719],[.633,.85],[.591,.938])]},
  dorian: {...base,neck:[.54,.3954],hip:[.58,.60],headY:.4,hemY:.67,
    arms:[limb([.46,.44],[.4,.46],[.35,.486]),limb([.668,.44],[.749,.44],[.857,.4])],
    legs:[limb([.533,.691],[.533,.801],[.552,.908]),limb([.668,.687],[.724,.815],[.79,.939])],
    props:[{arm:0,polygon:[[.037,.57],[.352,.462],[.417,.475],[.357,.511],[.058,.593]]}]},
  onyx: {...base,neck:[.53,.34],hip:[.53,.67],headY:.35,
    arms:[limb([.37,.41],[.25,.41],[.23,.31]),limb([.72,.42],[.79,.56],[.84,.68])],
    legs:[limb([.43,.69],[.37,.83],[.29,.96]),limb([.66,.69],[.69,.83],[.77,.96])],
    props:[{arm:0,polygon:[[0,.27],[.92,0],[1,.08],[.97,.25],[.31,.37],[.05,.38]],behindBody:true,
      shaft:{from:[.15,.33],to:[.84,.13],width:.065}}],
    propExclusions:[[[.34,.09],[.48,.065],[.68,.11],[.73,.2],[.66,.35],[.48,.385],[.31,.31],[.28,.2]]]},
  mortimer: {...base,neck:[.54,.35],hip:[.55,.66],headY:.35,hemY:.64,
    arms:[limb([.37,.40],[.29,.51],[.18,.49]),limb([.72,.41],[.77,.52],[.72,.59])],
    legs:[limb([.48,.69],[.48,.82],[.46,.96]),limb([.63,.69],[.64,.82],[.68,.96])],
    props:[{arm:0,polygon:[[0,.20],[.28,.20],[.31,.45],[.19,.53],[.04,.49]]}]},
};

for (const [id, rig] of Object.entries(FULL_ART_RIGS)) rig.performance = characterPerformance(id);

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
  const personality = rig.performance ?? characterPerformance('knight');
  const phase=(pose.phase??0)*Math.PI*2;
  // stride decays on stopping, so limbs settle even though phase is frozen.
  const gain=pose.moving?1:clamp(Math.abs(pose.stride??0)/2.4,0,1);
  // Gait energy scales with actual ground speed: sprinting leans and reaches
  // further than a jog, and the run never reads at full amplitude on a crawl.
  const speed=clamp(pose.speedRatio??(pose.moving?1:gain),0,1.35);
  const run=gain*clamp(speed,.55,1.35);
  const swing=Math.sin(phase);
  const time=(pose.moving?phase/2.5:(pose.time??0)) * personality.breath;
  const melee=Math.sin(clamp(pose.melee??0,0,1)*Math.PI);
  const cast=Math.sin(clamp(pose.ranged??0,0,1)*Math.PI);
  const gesture=attackGesture(pose.melee ?? 0, personality.gesture);
  const casting=attackGesture(pose.ranged ?? 0, personality.gesture === 'bow' ? 'bow' : 'cast');
  const air=!!pose.airborne,dash=!!pose.dashing;
  // Airborne keyframe blend: 0 = fully rising (tucked), 1 = fully falling
  // (reaching for the ground). Driven by vertical velocity so the pose eases
  // through a collected apex instead of snapping between two fixed shapes.
  const airT=air?clamp(((pose.verticalVelocity??0)+560)/1120,0,1):0;
  // A slow mid-air drift keeps long falls alive — a frozen tuck reads as a
  // statue between keyframes. Amplitude is small enough to never fight the
  // takeoff stretch or the landing reach.
  const airDrift=air?Math.sin((pose.time??0)*3)*.012:0;
  // Two ground contacts per cycle (phase 0 and π): body dips to absorb at each
  // contact and rebounds tall through the pass — the double-bob of a real gait.
  const contact=(1+Math.cos(phase*2))/2;
  const landing=clamp(pose.land??0,0,1);
  const bodyY=rig.floating?Math.sin(time*2.5)*.012
    :air?(.003-airT*.007)
    :run*(-.005+.012*contact)*personality.weight+Math.sin(time*2.1)*.002*(1-gain)+landing*.012*personality.weight;
  const hip=unit(rig.hip,aspect),neck=unit(rig.neck,aspect);
  // Leading with the chest: dash and sprint both push the root forward; the
  // melee lunge keeps its dedicated shift. Airborne stays centered.
  const rootShift: Point=[(dash?.02:air?0:run*.016)*personality.lean+gesture.lunge+casting.lunge,bodyY];
  const shift=(p:Point)=>add(p,rootShift[0],rootShift[1]);
  // Forward lean grows with speed (a sprint tilts ~2× a jog) with a small
  // stride-cadence sway layered on top; falling tips slightly forward to
  // counterbalance the reaching lead leg.
  const torsoTilt=(dash?-.15:air?-.02+airT*.035:-.085*run+swing*.02*gain)*personality.lean+melee*.025;
  const torsoPoint=(p:Point)=>rotate(shift(p),shift(hip),torsoTilt);
  const bones:Bone[]=[];
  const bone=(a:Point,b:Point,from:Point,to:Point)=>bones.push({restFrom:a,restTo:b,from,to});
  bone(hip,neck,shift(hip),torsoPoint(neck));
  const crown:Point=[neck[0],Math.max(.04,rig.headY-.22)];
  // The head stabilizes the gaze (counter-rotation against the torso lean) and
  // trails the body bob by a fraction of a cycle — cheap, believable lag.
  const headLag=run*Math.sin(phase*2-1)*.006+Math.sin(time*1.6)*.008*(1-gain);
  bone(neck,crown,torsoPoint(neck),rotate(torsoPoint(crown),torsoPoint(neck),-torsoTilt*.8+headLag));
  rig.arms.forEach((l,i)=>{
    const a=unit(l.root,aspect),b=unit(l.joint,aspect),c=unit(l.tip,aspect);
    const root=torsoPoint(a);
    // Arm pump: opposite phase to the legs, amplitude scaled by gait energy.
    // Carry heavy props close; Mortimer keeps the tray/candelabra level,
    // while Ember's unweighted arms open out with her dancer's stride.
    const carrying = (rig.props?.some(prop=>prop.arm===i) ?? false) ? .65 : 1;
    let upper=(i===0?1:-1)*swing*.55*run*personality.armSwing*carrying;
    let elbow=.1+Math.max(0,(i===0?-swing:swing))*.45*run*personality.armSwing;
    if(!gain){upper+=Math.sin(time*1.7+i*2.1)*.02;elbow+=.06;}
    if(air){
      // Rising: both arms fold up with the tuck. Falling: they spread and
      // trail high — the universal mid-air balance gesture.
      upper=(i===0?.2+.6*airT:-.35-.35*airT)+airDrift*(i===0?1:-1);
      elbow=(i===0?.5-.22*airT:.42)+airDrift*.5;
    }
    if(dash){upper=(i===0?.7:.5)*personality.lean;elbow=.35;}
    if(i===personality.weaponArm){upper+=gesture.shoulder+casting.shoulder;elbow+=gesture.elbow+casting.elbow;}
    else {upper+=melee*.32-cast*.25;elbow+=cast*.42;}
    if(personality.gesture==='bow' && i!==personality.weaponArm){upper-=cast*.65;elbow+=cast*.7;}
    if(personality.gesture==='puppet'){upper+=Math.sin(phase*2+i)*.09*run;elbow+=Math.max(0,swing)*.2*run;}
    if(personality.gesture==='serve' && i===0 && !melee && !cast){upper*=.25;elbow=-upper*.85;}
    const joint=rotate(add(b,root[0]-a[0],root[1]-a[1]),root,upper);
    const tip=rotate(add(c,joint[0]-b[0],joint[1]-b[1]),joint,upper+elbow);
    bone(a,b,root,joint);bone(b,c,joint,tip);
  });
  rig.legs.forEach((l,i)=>{
    const a=unit(l.root,aspect),b=unit(l.joint,aspect),c=unit(l.tip,aspect);
    const root=shift(a),cycle=phase+i*Math.PI;
    const step=Math.cos(cycle),lift=Math.max(0,Math.sin(cycle));
    let target: Point;
    if(air){
      // Rise keyframe: knees drive up (rear higher — asymmetric tuck).
      // Fall keyframe: the lead leg reaches forward-down for the landing
      // while the rear trails — blended continuously through the apex.
      // The takeoff stretch impulse outranks the tuck for its first moments,
      // otherwise the sprite reads compact exactly when it should read tall.
      const tuck=(1-airT)*(1-Math.min(1,pose.launch??0)*.65);
      const reach=airT;
      target=add(c,i===0?-.02-.035*tuck:.045+.02*reach,i===0?-.03-.105*tuck:-.02-.07*tuck+.015*reach);
    } else if(dash){
      target=add(c,i===0?-.075:.055,i===0?-.02:-.045);
    } else {
      // Grounded gait: the swing half lifts the foot with a forward knee
      // drive; the stance half stays at ground level while sweeping back,
      // so each foot reads as planting instead of ice-skating. Amplitude
      // is ~2.4× the old cycle — visible at gameplay scale, not a vibration.
      const reach=.12*run*personality.reach,drive=.095*run*personality.footLift;
      target=add(c,step*reach*(lift>0?1:.85),-lift*drive);
    }
    if(rig.floating)target=add(c,Math.sin(time*2.5+i)*.02,bodyY);
    // Clamp horizontal reach before solving the knee. Previously IK clamped
    // the knee alone, then attached an unreachable foot, stretching the calf.
    // Preserve the requested ground Y whenever it is physically reachable.
    const upperLength=Math.hypot(b[0]-a[0],b[1]-a[1]),lowerLength=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const reach=upperLength+lowerLength-.0001,minReach=Math.abs(upperLength-lowerLength)+.0001;
    const dy=clamp(target[1]-root[1],-reach,reach);
    const maxX=Math.sqrt(Math.max(0,reach*reach-dy*dy));
    const minX=Math.sqrt(Math.max(0,minReach*minReach-dy*dy));
    let dx=clamp(target[0]-root[0],-maxX,maxX);
    if(Math.abs(dx)<minX)dx=(Math.sign(dx)||(i===0?-1:1))*minX;
    target=[root[0]+dx,root[1]+dy];
    const joint=solveJoint(root,add(b,root[0]-a[0],root[1]-a[1]),add(c,root[0]-a[0],root[1]-a[1]),target);
    bone(a,b,root,joint);bone(b,c,joint,target);
  });
  const airCloth=air?airT*.018:0;
  return {bones,bodyY,cloth:((pose.moving?Math.sin(phase-.7)*.02:Math.sin(time*3.8)*.008)+(dash?.035:0)+airCloth)*personality.cloth};
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

/** Foreground faces win over props crossing behind them. In particular,
 * Onyx's club silhouette must not take his head along when he swings it. */
export function propOwnerAt(rig: ArtRig, point: Point): 0 | 1 | undefined {
  if (rig.propExclusions?.some(polygon => inPolygon(point, polygon))) return undefined;
  return rig.props?.find(prop => inPolygon(point, prop.polygon))?.arm;
}
export interface SkinVertex { source: Point; weights: readonly { bone: number; weight: number }[]; cloth: number }

/** Bind once per image. Broad central areas retain the painted torso, while
 * distance weights blend shoulders/knees with no cut seams or exposed holes. */
export function bindVertex(rig:ArtRig,aspect:number,point:Point,restBones?:readonly Bone[]):SkinVertex {
  const p=unit(point,aspect);
  const rest=restBones??resolveRigPose(rig,aspect,{}).bones;
  if(point[1]<rig.headY)return {source:p,weights:[{bone:1,weight:1}],cloth:0};
  const candidates:{bone:number;distance:number}[]=[{bone:0,distance:distance(p,rest[0].restFrom,rest[0].restTo)*.80}];
  // Long skirts and spectral tails are cloth, not two fabricated trouser legs.
  const skirt=rig.hemY<.70&&point[1]>rig.hemY&&(rig.longGown||point[1]<.88);
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

export interface SkinTransform { restX: number; restY: number; fromX: number; fromY: number; cos: number; sin: number }

/** The same bone rotation serves hundreds of vertices. Calculate its trig
 * once per pose, rather than twice per skin weight on every vertex. */
export function resolveSkinTransforms(pose:RigPose):SkinTransform[] {
  return pose.bones.map(b=>{
    const angle=Math.atan2(b.to[1]-b.from[1],b.to[0]-b.from[0])-Math.atan2(b.restTo[1]-b.restFrom[1],b.restTo[0]-b.restFrom[0]);
    return {restX:b.restFrom[0],restY:b.restFrom[1],fromX:b.from[0],fromY:b.from[1],cos:Math.cos(angle),sin:Math.sin(angle)};
  });
}

export function deformVertex(vertex:SkinVertex,pose:RigPose,transforms?:readonly SkinTransform[]):Point {
  let x=0,y=0;
  for(const {bone,weight} of vertex.weights){
    if(transforms){
      const t=transforms[bone],dx=vertex.source[0]-t.restX,dy=vertex.source[1]-t.restY;
      x+=(t.restX+dx*t.cos-dy*t.sin+t.fromX-t.restX)*weight;
      y+=(t.restY+dx*t.sin+dy*t.cos+t.fromY-t.restY)*weight;
    }else{
      const b=pose.bones[bone];
      const angle=Math.atan2(b.to[1]-b.from[1],b.to[0]-b.from[0])-Math.atan2(b.restTo[1]-b.restFrom[1],b.restTo[0]-b.restFrom[0]);
      const p=rotate(vertex.source,b.restFrom,angle);
      x+=(p[0]+b.from[0]-b.restFrom[0])*weight;
      y+=(p[1]+b.from[1]-b.restFrom[1])*weight;
    }
  }
  return [x+pose.cloth*vertex.cloth,y+Math.abs(pose.cloth)*vertex.cloth*.2];
}
