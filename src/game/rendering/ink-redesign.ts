import type { CharacterDef } from '../data/characters';
import type { CharacterArtPose } from './character-art';

/** Second-edition ink cast. Shapes are drawn against the actual collision box;
 * the joint rig is shared, not the costumes. No images, alpha washes or physics.
 * Old painters remain available only for the historical comparison board. */
type P = readonly [number, number];
type Profile = { ink: string; cloth: string; light: string; accent: string; skin: string; build: number };
const PROFILES: Record<string, Profile> = {
  knight: { ink: '#09080f', cloth: '#484052', light: '#a9a8b8', accent: '#c7ff4d', skin: '#f1c9a5', build: 1.05 },
  ninja: { ink: '#0a0a0f', cloth: '#373044', light: '#8e799e', accent: '#c7ff4d', skin: '#d9bca6', build: .8 },
  tank: { ink: '#141019', cloth: '#3a4152', light: '#9aa7bd', accent: '#f97316', skin: '#e3b89d', build: 1.35 },
  mage: { ink: '#141019', cloth: '#553565', light: '#ad8fc0', accent: '#c084fc', skin: '#f1c9a5', build: .85 },
  ranger: { ink: '#141019', cloth: '#254533', light: '#88a87b', accent: '#4ade80', skin: '#d0ab83', build: .85 },
  cyborg: { ink: '#141019', cloth: '#424c5c', light: '#acbdc9', accent: '#22d3ee', skin: '#d3b7a2', build: 1.05 },
  spirit: { ink: '#141019', cloth: '#8c78b3', light: '#ede9fe', accent: '#c4b5fd', skin: '#ede9fe', build: .75 },
  healer: { ink: '#141019', cloth: '#285552', light: '#e5f3e8', accent: '#5eead4', skin: '#f1c9a5', build: .9 },
  cherry: { ink: '#141019', cloth: '#3a2c42', light: '#a78bb0', accent: '#e5304a', skin: '#f2e2da', build: .85 },
  velvet: { ink: '#141019', cloth: '#6b203e', light: '#e8d5dc', accent: '#c2183f', skin: '#f3e3e6', build: .85 },
  ember: { ink: '#141019', cloth: '#873227', light: '#ffb14a', accent: '#ff5a3c', skin: '#f2c9a8', build: .82 },
  rosalia: { ink: '#141019', cloth: '#6e1730', light: '#e6b4bc', accent: '#d7234a', skin: '#f3dce0', build: .95 },
  marionette: { ink: '#141019', cloth: '#3c2939', light: '#f2e6df', accent: '#ff3d6e', skin: '#f2e6df', build: .72 },
  dorian: { ink: '#141019', cloth: '#642333', light: '#e6e8ef', accent: '#c62b41', skin: '#e3c7b7', build: .95 },
  onyx: { ink: '#141019', cloth: '#742d32', light: '#b17f78', accent: '#ee3944', skin: '#dca896', build: 1.25 },
  mortimer: { ink: '#141019', cloth: '#3a2938', light: '#e3d5c6', accent: '#a8243c', skin: '#e6d5c7', build: .87 },
  grimshaw: { ink: '#141019', cloth: '#382230', light: '#d8d2c4', accent: '#d62b3c', skin: '#d8d2c4', build: .95 },
};

export const REDESIGNED_CHARACTER_IDS = Object.freeze(Object.keys(PROFILES));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Smooth attack envelope: wind-up, broad contact, then recovery (not a pose snap). */
export function inkAttackWeight(progress = 0): number {
  const p = clamp(progress, 0, 1);
  return Math.sin(p * Math.PI);
}

export function drawRedesignedCharacter(
  ctx: CanvasRenderingContext2D, char: CharacterDef, w: number, h: number, pose: CharacterArtPose,
): boolean {
  const mat = PROFILES[char.id];
  if (!mat) return false;
  const { ink, cloth, light, accent, skin, build } = mat;
  const id = char.id;
  const c = w / 2;
  const stride = clamp(pose.stride ?? 0, -2.5, 2.5);
  const phase = (pose.phase ?? Math.asin(stride / 2.5) / (Math.PI * 2)) * Math.PI * 2;
  const moving = pose.moving ?? Math.abs(stride) > .5;
  const swing = inkAttackWeight(pose.melee);
  const cast = inkAttackWeight(pose.ranged);
  const attack = Math.max(swing, cast * .8);
  const tuck = inkAttackWeight(pose.tumble);
  const breath = moving || pose.airborne || pose.dashing ? 0 : Math.sin((pose.time ?? 0) * 2.4) * .28;
  const speedLean = (moving ? .9 : 0) * clamp(pose.speedRatio ?? 1, 0, 1.35);
  const lean = (pose.dashing ? 2.4 : pose.airborne ? 1 : Math.abs(stride) * .25 + speedLean) + attack * .7;
  // Takeoff reach and landing absorb: the shared wrapper scales the whole
  // sprite; this shape offset keeps the shoulders/head leading the spring.
  const spring = (pose.launch ?? 0) - (pose.land ?? 0) * .8;
  const lift = (pose.airborne ? -.8 : pose.dashing ? .7 : -Math.abs(Math.cos(phase)) * (moving ? .55 : 0)) + breath - spring * 1.3;
  const follow = Math.sin(phase - .7) * (moving ? 1.1 : .18) + Math.sin((pose.time ?? 0) * 2) * .18;
  const hipY = h * (['mage', 'velvet', 'rosalia', 'grimshaw'].includes(id) ? .64 : .62);
  const shoulderY = h * .43 + lift;
  const center: P = [c + lean, shoulderY];
  const poly = (color: string, pts: readonly P[]) => {
    ctx.fillStyle = color; ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  const line = (color: string, pts: readonly P[], width = .65) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  };
  const local = (pts: readonly P[]): P[] => pts.map(([x, y]) => [c + x + lean, y + lift]);
  const plate = (color: string, pts: readonly P[]) => poly(color, local(pts));
  const mark = (color: string, pts: readonly P[], width = .6) => line(color, local(pts), width);
  const diamond = (color: string, x: number, y: number, r: number) => poly(color, [[x-r,y],[x,y-r],[x+r,y],[x,y+r]]);
  const headY = h * .24 + lift;
  const headX = c + lean;
  const head = (color = skin, breadth = 4.6) => poly(color, [
    [headX-breadth,headY-3.8],[headX+.5,headY-5.1],[headX+breadth,headY-3.2],
    [headX+breadth+.6,headY+1],[headX+2.4,headY+4.6],[headX-1.9,headY+4.8],[headX-breadth,headY+1.5],
  ]);
  const eyes = (color = ink, y = headY+.1) => {
    // A three-quarter face: larger forward eye, smaller far eye, readable at 1×.
    poly(color, [[headX-2.7,y-.5],[headX-.7,y],[headX-1,y+1],[headX-2.5,y+.8]]);
    poly(color, [[headX+1.5,y-.1],[headX+4,y-.8],[headX+3.8,y+1],[headX+1.7,y+1]]);
  };
  const face = (color = skin, eyeColor = ink) => {
    head(color); eyes(eyeColor);
    line(ink, [[headX+.3,headY+3],[headX+2.2,headY+3]], .45);
  };
  const clothTail = (color: string, length: number, y: number, depth: number) => {
    const wind = pose.dashing ? 4 : pose.airborne ? 2 : 0;
    plate(ink, [[-4,y-1],[-length-wind,y+follow],[-length+1-wind,y+depth+follow],[-7,y+depth+1],[0,y+4]]);
    plate(color, [[-4,y],[-length+1-wind,y+1+follow],[-length+3-wind,y+depth-1+follow],[-5,y+depth],[0,y+3]]);
  };

  // Rear silhouette, authored per identity; cloth never obscures the face/strike.
  switch (id) {
    case 'knight':
      clothTail('#754294', 15, shoulderY-1-lift, 12);
      plate('#4a2b60', [[-6,14],[-14,22+follow],[-10,h-3],[-3,h-7],[1,17]]);
      break;
    case 'ninja':
      clothTail(accent, 17, 10, 3.1);
      plate(accent, [[-4,11],[-15,13-follow],[-11,14],[-15,16-follow],[-3,13]]);
      // Scabbard: a filled strip, not a disconnected neon slash.
      plate(cloth, [[-7,21],[4,8],[5.5,9],[-5.5,22]]);
      break;
    case 'ranger':
      clothTail('#254b32', 12, 12, 8);
      plate('#73563f', [[-7,13],[-4,12],[-2,23],[-6,24]]);
      for (let i=0;i<3;i++) mark('#c7c1a0', [[-7+i*1.2,14],[-9+i*1.2,8]], .8);
      break;
    case 'cherry': {
      // Thick drooping twin-tails, with a delayed curl instead of two flat flags.
      const reach = pose.dashing ? 16 : pose.airborne ? 14 : 14 + Math.abs(stride)*.5;
      for (const side of [0, 1]) {
        const y = headY-3+side*4-lift;
        plate('#e5304a', [[-3,y],[-7,y-1],[-reach,y+follow],[-reach-1,y+5+follow],[-reach+3,y+7],[-reach+2,y+3],[-5,y+2]]);
        plate('#8e1226', [[-7,y+1],[-reach+.4,y+2+follow],[-reach+1,y+5],[-reach+2,y+3],[-5,y+2]]);
      }
      break;
    }
    case 'velvet':
      clothTail('#641d37', 11, 12, 15);
      plate(ink, [[-5,5],[4,4],[7,12],[3,22],[-7,19],[-9-follow,12]]);
      plate(accent, [[-5,12],[-9,5],[-4,8],[0,14],[5,7],[9,4],[6,14]]);
      break;
    case 'ember':
      plate(ink, [[0,4],[4,-.5],[8,1],[11-follow,5],[5,9],[2,7]]);
      plate('#b74429', [[1,4],[4,1],[7,2],[9-follow,5],[4,8]]);
      plate('#ffb14a', [[6,3],[9,2],[8,5],[6,6]]);
      clothTail('#9d302c', 11, 18, 3);
      break;
    case 'rosalia':
      plate('#741e36', [[-4,11],[-9,17],[-10,h-5],[-2,h-4],[5,h-6],[6,14]]);
      break;
    case 'marionette':
      mark(accent, [[-7,13],[-10,19+follow],[-5,24],[2,20]], .85);
      break;
    case 'dorian':
      plate('#71283b', [[-5,13],[-8,h-2],[-2,h-6],[0,20],[3,h-3],[7,h-4],[5,13]]);
      break;
    case 'onyx': clothTail('#8d2632', 13, 12, 4); break;
    case 'mortimer':
      plate('#392a37', [[-6,14],[-7,h-1],[-1,h-4],[1,20],[4,h-2],[7,h-4],[5,14]]);
      break;
    case 'grimshaw':
      plate('#431e2b', [[-6,8],[-10,20],[-11,h-1+follow*.5],[-5,h-4],[-1,h+1],[3,h-4],[8,h-follow*.5],[7,19],[3,8]]);
      plate(cloth, [[-7,16],[-8,h-3],[-3,h-6],[0,22],[4,h-3],[6,h-1],[5,15]]);
      break;
  }

  // A full articulated gait: bent knees, alternate support/recovery feet.
  // Phase distinguishes the two crossing poses which a single sine cannot.
  const legs = (rear: boolean) => {
    const side = rear ? -1 : 1;
    const hip: P = [c+side*2,hipY];
    const s = stride * side;
    const recovery = moving ? Math.max(0, Math.cos(phase + (rear ? Math.PI : 0))) * 3.1 : 0;
    let knee: P = [c+side*2.5+s*.7, hipY+(h-hipY)*.45-recovery*.4];
    let foot: P = [c+side*3+s*1.8,h-1-recovery];
    if (pose.airborne) {
      const fall = clamp((pose.verticalVelocity ?? -100)/550,-1,1);
      knee = [c+(rear?-6:5),hipY+(rear?1.4:2.1)+fall];
      foot = [c+(rear?-8:5),h-(rear?7:3)-fall*1.5];
    }
    if (pose.dashing) { knee=[c+(rear?-6:3),hipY+3]; foot=[c+(rear?-10:9),h-(rear?5:2)]; }
    if (tuck>0) { knee=mix(knee,[c+side*5,hipY+1],tuck);foot=mix(foot,[c+side*6,hipY+4],tuck); }
    const girth = (id==='tank'?2.5:id==='onyx'?2.1:1.6);
    const [kx,ky]=knee,[fx,fy]=foot;
    poly(ink, [[hip[0]-girth,hip[1]-1],[hip[0]+girth,hip[1]],[kx+girth,ky-1],[fx+1.6,fy-2.3],
      [fx+3.8,fy-1],[fx+4.1,fy+.8],[fx-2,fy+.8],[fx-2.1,fy-2],[kx-girth,ky+1.7],[hip[0]-girth,hip[1]+2]]);
    poly(rear?cloth:light, [[hip[0]-.7,hip[1]+1],[kx+.8,ky],[fx+.4,fy-2.5],[kx-.7,ky+1]]);
    line(rear?cloth:light,[[fx-1.5,fy-1.7],[fx+2.5,fy-1.7]],.65);
    if (['knight','tank','cyborg'].includes(id)) diamond(rear?cloth:light,kx,ky,1.7);
    if (id==='ember') poly(skin,[[kx-1,ky-2],[kx+1.2,ky-2],[fx+.6,fy-3],[fx-.8,fy-3]]);
  };
  if (id!=='spirit' && id!=='grimshaw') legs(true);

  // Arms use filled elbow joints; the hand is also the prop's exact origin.
  const rearShoulder: P=[center[0]-4*build,shoulderY];
  const frontShoulder: P=[center[0]+4*build,shoulderY+.5];
  let rearElbow: P=[c-6-stride*.65,shoulderY+4];
  let rearHand: P=[c-5-stride,shoulderY+7];
  let frontElbow: P=[c+5+stride*.65,shoulderY+3.5];
  let frontHand: P=[c+6+stride,shoulderY+7];
  if(pose.airborne){rearElbow=[c-6,shoulderY+1];rearHand=[c-8,shoulderY-2];frontElbow=[c+7,shoulderY+1];frontHand=[c+8,shoulderY-3];}
  if(pose.dashing){rearElbow=[c-6,shoulderY+2];rearHand=[c-9,shoulderY];frontElbow=[c+1,shoulderY+4];frontHand=[c-3,shoulderY+5];}
  // Attacks must apply AFTER air/dash, never be erased by those poses.
  const progress = (pose.melee ?? 0) > 0 ? pose.melee! : (pose.ranged ?? 0);
  const attackAngle=-1.7+clamp(progress,0,1)*2.4;
  frontElbow=mix(frontElbow,[c+6,shoulderY+1],attack);
  frontHand=mix(frontHand,[c+10,shoulderY-1+Math.sin(attackAngle)*3],attack);
  rearHand=mix(rearHand,[c-2,shoulderY+2],tuck);
  frontHand=mix(frontHand,[c+4,shoulderY+2],tuck*(1-attack));
  const arm = (a:P,e:P,hand:P,rear:boolean) => {
    const t=(id==='tank'?2.3:1.5)*build;
    poly(ink,[[a[0]-t,a[1]-1],[a[0]+t,a[1]-1],[e[0]+t,e[1]],[hand[0]+1.6,hand[1]-1],
      [hand[0]+1.6,hand[1]+1.5],[hand[0]-1.6,hand[1]+1.5],[e[0]-t,e[1]+1.5],[a[0]-t,a[1]+2]]);
    poly(rear?cloth:light,[[a[0]-.6,a[1]],[e[0]+.6,e[1]],[hand[0]+.5,hand[1]],[e[0]-.5,e[1]+.8]]);
    if(['ember','healer','cherry','dorian','mortimer'].includes(id))diamond(skin,hand[0],hand[1],1.25);
  };
  arm(rearShoulder,rearElbow,rearHand,true);

  // Costume plates: distinct outlines and proportions, not a reskinned bodysuit.
  switch(id){
    case 'knight':
      plate(ink,[[-6,13],[5,12],[8,17],[5,hipY+1],[-5,hipY+1],[-7,17]]);
      plate('#686575',[[-4,14],[4,13],[5,18],[0,21],[-4,19]]);
      plate(light,[[-4,14],[1,13.5],[1,18],[-3,17]]);
      plate('#6b557c',[[-8,13],[-4,12],[-3,16],[-8,17]]);
      plate(light,[[4,12],[8,13],[9,17],[4,16]]);
      mark(accent,[[0,15],[0,20]],1);mark(accent,[[-2,17],[2,17]],1);
      plate('#35263f',[[-5,21],[5,21],[6,25],[1,24],[0,22],[-2,25],[-6,24]]);
      break;
    case 'ninja':
      plate(ink,[[-4,11],[3,10],[6,13],[4,19],[-3,21],[-6,17]]);
      plate(cloth,[[-3,12],[2,12],[4,16],[0,18],[-3,17]]);
      plate('#51455e',[[-4,12],[-1,14],[3,19],[1,20],[-5,14]]);
      plate(cloth,[[-5,19],[4,18],[5,21],[-4,22]]);
      mark(light,[[-3,20],[3,19.5]],.6);
      break;
    case 'tank':
      plate(ink,[[-9,13],[9,13],[10,22],[7,26],[-7,26],[-10,22]]);
      plate(cloth,[[-7,14],[7,14],[8,20],[4,23],[-4,23],[-8,20]]);
      plate('#626e82',[[-7,15],[0,14],[0,21],[-5,21]]);
      for(const s of [-1,1]){plate(ink,[[s*6,11],[s*12,12],[s*13,17],[s*5,17]]);plate('#626e82',[[s*7,12],[s*11,13],[s*11,15],[s*6,15]]);}
      mark(accent,[[-3,19],[3,19]],1);mark(light,[[-6,24],[6,24]],1);
      break;
    case 'mage':
      plate(ink,[[-4,13],[4,13],[6,21],[9,h-3],[3,h-1],[0,h-3],[-6,h-1],[-8,h-4],[-5,21]]);
      plate('#513368',[[-3,14],[3,14],[3,22],[6,h-4],[-5,h-3],[-3,22]]);
      plate('#8e63a5',[[-3,14],[-.5,14],[-1,h-4],[-4,h-4]]);
      mark(accent,[[-5,h-4],[0,h-3],[6,h-5]],.8);diamond('#fde68a',c+lean,17+lift,1.4);
      break;
    case 'ranger':
      plate(ink,[[-4,12],[5,12],[6,19],[3,24],[-5,23],[-6,18]]);
      plate(cloth,[[-3,13],[3,13],[4,21],[-3,22]]);
      plate('#8a6a45',[[-5,15],[-3,14],[4,21],[2,22]]);
      plate('#466445',[[-6,12],[0,10],[6,12],[4,17],[0,15],[-5,17]]);
      mark(light,[[-4,21],[4,21]],1);diamond('#d5c49d',c+lean+2,21+lift,1.2);
      break;
    case 'cyborg':
      plate(ink,[[-6,12],[4,12],[7,17],[5,23],[-5,23],[-7,18]]);
      plate(cloth,[[-4,13],[3,13],[4,20],[-3,21]]);
      plate(light,[[-6,13],[-2,12],[-2,16],[-6,18]]);
      plate('#697a8b',[[1,13],[5,14],[5,19],[1,18]]);
      diamond(accent,c+lean,18+lift,2);mark(accent,[[-4,22],[3,22]],.7);
      break;
    case 'spirit': {
      const wave=follow*1.3;
      plate(cloth,[[-4,13],[4,13],[5,21],[9,h-4],[3,h-5],[1,h],[-2,h-4],[-8,h-2],[-5,22]]);
      plate(light,[[-3,14],[3,14],[3,21],[6+wave,h-5],[0,h-7],[-5+wave,h-3],[-2,22]]);
      plate(ink,[[-2,15],[2,15],[0,22]]);
      diamond(accent,c-10,22+follow,1);diamond(light,c+10,26-follow,1.3);
      break;
    }
    case 'healer':
      plate(ink,[[-5,13],[5,13],[5,22],[7,h-4],[-6,h-3],[-6,22]]);
      plate(light,[[-4,14],[4,14],[3,22],[5,h-5],[-4,h-4],[-4,21]]);
      plate(cloth,[[-5,14],[-1,14],[-1,23],[-5,22]]);plate(cloth,[[2,14],[5,15],[4,23],[2,22]]);
      mark(accent,[[-3,15],[-3,20]],1);mark(light,[[-5,17],[-1,17]],1);
      plate('#759e93',[[1,23],[6,22],[7,26],[2,27]]);
      break;
    case 'cherry': {
      const flare=pose.airborne?1.5:0, sway=-stride*.45;
      plate('#e5304a',[[-5,20],[4,20],[8+sway+flare,27], [3,29],[-1,27.5],[-6,29],[-9+sway-flare,26]]);
      plate(ink,[[-4,14],[4,14],[5,20],[7+sway+flare,25.5],[3,27],[-1,25.8],[-6,27],[-7+sway-flare,25],[-4,20]]);
      plate(cloth,[[-3,15],[2,15],[3,20],[-3,20]]);
      mark(light,[[-3,14],[0,16],[3,14]],.65);
      mark(light,[[-6+sway,25],[3,26],[7+sway,25]],.6);
      // Seven pierced cherry-print motifs: sewn into the bodice / skirt.
      for(const [x,y] of [[-2.8,17],[2.5,17],[0,19],[-4.5,23],[4,23],[-1.8,25],[1.5,25]]){
        const xx=c+x+lean+(y>21?sway*(x/7):0), yy=y+lift;
        line('#5a8f5a',[[xx-.55,yy+.1],[xx,yy-.7],[xx+.55,yy+.1]],.4);
        for(const side of [-1,1]){ctx.fillStyle='#e5304a';ctx.beginPath();ctx.arc(xx+side*.55,yy+.55,.6,0,Math.PI*2);ctx.fill();}
        ctx.strokeStyle='#cdd6e4';ctx.lineWidth=.3;ctx.beginPath();ctx.arc(xx,yy-.7,.32,0,Math.PI*2);ctx.stroke();
      }
      break;
    }
    case 'velvet':
      plate(ink,[[-4,13],[4,13],[3,20],[7,26],[0,29],[-8,26],[-4,20]]);
      plate('#86243f',[[-3,14],[3,14],[2,20],[-2,20]]);
      plate('#4d273b',[[-3,21],[3,21],[5,25],[0,27],[-6,25]]);
      mark(light,[[-6,26],[-3,27],[0,28],[4,26]],.65);
      mark(light,[[-1.5,16],[1.5,18],[-1.5,19],[1.5,16]],.4);
      break;
    case 'ember':
      plate(skin,[[-3,13],[3,13],[3,19],[-3,19]]);
      plate(accent,[[-4,13],[3,12],[4,15],[-4,16]]);
      plate('#b13b27',[[-4,18],[4,18],[7,23],[1,24],[-6,22]]);
      plate('#ffb14a',[[-4,18],[4,18],[5,20],[-5,20]]);
      plate(ink,[[-4,21],[1,23],[6,21],[6,24],[0,26],[-6,23]]);
      break;
    case 'rosalia':
      plate(ink,[[-4,13],[4,13],[3,20],[9,27],[5,29],[0,27],[-6,29],[-9,26],[-3,20]]);
      plate(accent,[[-3,14],[3,14],[2,19],[-2,20]]);
      plate('#9d2541',[[-4,21],[3,20],[7,25],[1,24],[-6,26]]);
      plate('#6e1730',[[-5,24],[2,23],[7,27],[1,26],[-7,28]]);
      mark(light,[[-5,25],[0,24.5],[5,26]],.55);
      break;
    case 'marionette':
      plate(ink,[[-4,13],[4,13],[3,20],[7,24],[2,26],[-3,25],[-7,24],[-3,20]]);
      plate(light,[[-4,13],[0,15],[4,13],[3,17],[-3,17]]);
      plate(cloth,[[-3,17],[3,17],[2,20],[-2,20]]);
      mark(accent,[[-5,24],[0,25],[5,24]],.7);
      diamond(accent,c+lean,16+lift,1.2);
      break;
    case 'dorian':
      plate(ink,[[-5,13],[5,13],[4,23],[-4,23]]);
      plate(accent,[[-5,14],[-1,15],[-2,22],[-5,23]]);plate('#793040',[[1,15],[5,14],[4,23],[2,22]]);
      plate(light,[[-2,13],[2,13],[0,17]]);
      plate('#f4f2ed',[[0,15],[2,17],[0,19],[-1,17]]);
      mark(light,[[1,19],[1,22]],.7);
      break;
    case 'onyx':
      plate(ink,[[-7,13],[7,13],[6,23],[-6,23]]);
      plate('#973d3c',[[-6,14],[1,14],[5,22],[-5,22]]);
      plate(skin,[[2,13],[6,14],[5,18],[3,17]]);
      plate('#471f2a',[[-5,17],[3,15],[4,17],[-4,19]]);
      mark(accent,[[-5,21],[5,21]],1.6);
      break;
    case 'mortimer':
      plate(ink,[[-5,13],[5,13],[4,23],[-4,23]]);
      plate('#732a3e',[[-3,14],[3,14],[2,22],[-2,22]]);
      plate(light,[[-2,13],[2,13],[0,17]]);
      mark(light,[[0,17],[0,22]],.6);diamond('#ff6b4a',c+lean,15+lift,1);
      mark('#b9a295',[[2,21],[4,20],[5,19]],.45);
      break;
    case 'grimshaw':
      plate(ink,[[-5,12],[5,12],[7,22],[3,h-3],[0,h],[-3,h-4],[-7,h-2],[-6,20]]);
      plate('#503040',[[-4,14],[-1,15],[-2,h-5],[-5,h-3]]);
      mark(light,[[-4,14],[1,17],[5,14]],.6);
      mark(accent,[[-3,19],[3,20]],.8);
      break;
  }
  if(id!=='spirit'&&id!=='grimshaw')legs(false);

  // Heads: each outline changes, not only the hat/eye hue.
  switch(id){
    case 'knight':
      plate(ink,[[-5,3],[-1,1],[4,3],[6,7],[4,12],[0,14],[-5,11],[-6,6]]);
      plate('#76717f',[[-4,4],[0,2.8],[3,4],[4,7],[-4,7]]);
      plate('#35313f',[[-4,8],[4,8],[3,11],[0,12],[-3,11]]);
      mark(accent,[[-3,8.5],[3.7,8]],1.3);
      plate('#754294',[[-1,2],[-2,-1],[1,-2],[3,1],[2,4]]);
      mark(light,[[-4,5],[-4,7]],.7);
      break;
    case 'ninja':
      plate(ink,[[-5,4],[-7,1],[-3,2],[-4,-2],[0,0],[2,-3],[3,0],[7,-1],[5,3],[7,5],[5,10],[0,12],[-5,9]]);
      plate(cloth,[[-4,6],[0,7],[5,5],[4,9],[0,10],[-4,8]]);
      eyes(accent,7+lift);plate(ink,[[-4,9],[0,10],[5,8],[4,12],[-2,12]]);
      plate(accent,[[-5,11],[0,12],[4,10],[3,13],[-3,14]]);
      mark(light,[[-3,2],[0,3],[3,1]],.6);
      break;
    case 'tank':
      plate(ink,[[-6,3],[5,3],[7,8],[5,13],[-4,13],[-7,8]]);
      plate('#626e82',[[-5,4],[4,4],[5,7],[-5,7]]);
      plate('#2c303e',[[-4,8],[4,8],[3,12],[-3,12]]);
      mark(accent,[[-3,8.5],[3,8.5]],1.3);mark(accent,[[0,8.5],[0,10.5]],1.2);
      mark(light,[[-1,2],[-1,4]],1.1);break;
    case 'mage':
      face(skin,ink);
      plate('#e0cfc1',[[-3,10],[1,12],[4,10],[3,16],[0,18],[-3,15]]);
      plate(ink,[[-7,7],[6,7],[8,9],[-8,9]]);
      plate('#69437c',[[-5,7],[-3,2],[0,-2],[5,0],[2,2],[3,7]]);
      mark('#ad8fc0',[[-5,7],[4,7]],1);
      diamond('#fde68a',c+lean+1,-1+lift,1.8);break;
    case 'ranger':
      plate(ink,[[-6,5],[-2,1],[4,2],[7,7],[5,14],[-6,13]]);
      plate('#31553d',[[-5,5],[-2,2],[3,3],[5,6],[3,10],[-4,10]]);
      head(skin,3.5);eyes(accent,8+lift);
      plate('#254533',[[-5,8],[-2,10],[5,8],[4,12],[-3,13]]);
      plate('#31553d',[[-6,5],[-1,2],[5,5],[4,6],[-3,5]]);
      break;
    case 'cyborg':
      head(skin,4.5);
      plate(ink,[[-5,4],[4,4],[5,10],[-4,11]]);
      plate('#697a8b',[[-5,3],[0,2],[1,6],[-4,7]]);
      mark(accent,[[-1,7],[4,7]],1.4);plate(light,[[-5,7],[-2,8],[-2,11],[-4,11]]);
      mark(light,[[-5,3],[-6,0]],.65);diamond(accent,c+lean-6,lift,1);break;
    case 'spirit':
      plate(light,[[-6,6],[-1,1],[4,3],[7,8],[4,14],[-3,15],[-7,10]]);
      plate(cloth,[[-5,7],[-1,3],[2,4],[-2,11],[-2,14],[-5,12]]);
      plate(ink,[[-3,7],[1,5],[4,8],[2,12],[-1,12]]);
      mark(light,[[0,8],[2,8]],.8);break;
    case 'healer':
      face();
      plate('#322331',[[-5,5],[-3,2],[2,2],[5,4],[4,6],[-4,5]]);
      plate(light,[[-6,3],[3,2],[5,5],[-5,6]]);
      mark('#285552',[[-1,2.5],[-1,5]],1);mark('#285552',[[-2.3,3.5],[.3,3.5]],1);
      diamond(cloth,c+lean-6,7+lift,2);break;
    case 'cherry':
      face(skin,'#8e1226');
      plate('#e5304a',[[-5,4],[-2,2],[3,2],[5,4],[5,6],[2,5],[1,7],[-1,5],[-3,7],[-5,6]]);
      plate('#8e1226',[[-6,4],[-4,5],[-4,12],[-6,11]]);
      plate('#e5304a',[[4,4],[6,5],[6,12],[4,11]]);
      for(const x of [-5.6,5.6]){ctx.fillStyle='#f4f4f8';ctx.beginPath();ctx.arc(c+lean+x,headY+1,.65,0,Math.PI*2);ctx.fill();}
      mark(light,[[5.6,headY+1-lift],[5,13],[3,15]],.35);
      mark('#5a8f5a',[[-6,4],[-7,2],[-8,1]],.6);
      break;
    case 'velvet':
      face(skin,accent);
      plate(ink,[[-5,4],[-2,1],[3,1],[6,4],[5,7],[2,4],[0,6],[-2,4],[-5,7]]);
      mark('#f4f2ed',[[1,11],[1,12]],.55);
      diamond(accent,c+lean,14+lift,1.4);break;
    case 'ember':
      face(skin,ink);
      plate('#802a29',[[-5,5],[-4,2],[1,1],[5,3],[4,5],[0,4],[-3,6]]);
      mark('#ffb14a',[[-3,3],[0,2.5],[3,3]],.6);break;
    case 'rosalia':
      face(skin,'#741e36');
      plate(ink,[[-5,5],[-4,2],[2,1],[5,3],[4,7],[2,4],[-3,6],[-5,11]]);
      for(const [x,y] of [[2,2],[5,1],[6,4]]){diamond(accent,c+lean+x,y+lift,1.7);diamond('#e6b4bc',c+lean+x,y+lift,.6);}
      mark('#4a7a4e',[[1,2],[3,-.5],[6,1]],.6);break;
    case 'marionette':
      head(skin,4.2);
      plate(ink,[[-5,4],[-3,1],[3,1],[5,4],[5,11],[3,12],[3,6],[-3,6],[-3,12],[-5,11]]);
      diamond(accent,headX-1.5,headY,1);diamond(accent,headX+2,headY,1);
      mark(ink,[[0,11],[2,11]],.4);
      plate(accent,[[-2,1],[-4,-1],[-4,2],[0,1],[3,-1],[3,2]]);break;
    case 'dorian':
      face(skin,ink);
      plate(ink,[[-4,5],[-4,2],[3,1],[4,5],[1,4],[-2,6]]);
      plate('#6e2338',[[-5,3],[-3,0],[3,0],[5,3]]);
      plate(accent,[[-9,3],[5,2],[9,4],[1,5],[-9,4]]);
      plate(light,[[3,1],[5,-2],[7,-1],[5,2]]);
      mark(ink,[[0,11],[2,12],[4,11]],.6);break;
    case 'onyx':
      face(skin,ink);
      plate(ink,[[-6,3],[-4,0],[4,1],[6,4],[2,4],[-2,3],[-5,5]]);
      plate(accent,[[-6,10],[-1,12],[5,11],[4,15],[-3,15],[-6,13]]);
      mark(light,[[-4,6],[-1,6]],.7);mark(light,[[2,6],[5,6]],.7);break;
    case 'mortimer':
      face(skin,ink);
      plate(ink,[[-5,5],[-4,3],[4,3],[5,7],[3,6],[-3,5],[-4,12],[-5,11]]);
      plate(ink,[[-5,3],[-4,-3],[3,-3],[5,3]]);
      plate('#5e3848',[[-3,-2],[2,-2],[3,2],[-3,2]]);
      plate(accent,[[-5,1],[4,1],[4,3],[-5,3]]);
      plate(ink,[[-8,3],[7,3],[8,4],[-8,5]]);
      mark(light,[[2,8],[4,8]],.7);break;
    case 'grimshaw':
      plate('#591e2b',[[-7,7],[-5,1],[-1,-3],[5,3],[7,10],[4,15],[-6,14]]);
      plate(ink,[[-5,8],[-1,3],[4,7],[4,12],[0,15],[-5,12]]);
      plate('#d8d2c4',[[-3,8],[1,6],[4,8],[3,12],[0,13],[-3,11]]);
      eyes(ink,9+lift);mark(accent,[[0,11],[1,11]],.8);break;
  }
  arm(frontShoulder,frontElbow,frontHand,false);

  // All props originate at the resolved hand. The exact same motion is used
  // in menus, local/remote players, and the court enemies.
  const [hx,hy]=frontHand;
  const restAngle = pose.dashing ? -2.6 : -.95;
  const theta = restAngle + (-1.8 + progress * 2.8 - restAngle) * attack;
  const wp = (x:number,y:number):P => [hx+Math.cos(theta)*x-Math.sin(theta)*y,hy+Math.sin(theta)*x+Math.cos(theta)*y];
  const weaponPoly=(color:string,pts:readonly P[])=>poly(color,pts.map(([x,y])=>wp(x,y)));
  const weaponLine=(color:string,pts:readonly P[],weight=.7)=>line(color,pts.map(([x,y])=>wp(x,y)),weight);
  switch(id){
    case 'knight':case 'ninja':case 'cyborg':case 'dorian': {
      const blade=id==='ninja'?10:id==='dorian'?15:id==='cyborg'?10:13;
      weaponPoly(ink,[[-2,-1],[blade,-1.5],[blade+2,0],[blade,1.5],[-2,1]]);
      weaponPoly('#f4f2ed',[[1,-.8],[blade,-.7],[blade+1.4,0],[1,.7]]);
      weaponLine(id==='dorian'?'#e6e8ef':id==='ninja'?light:accent,[[2,-.8],[blade,-.7]],.55);
      weaponLine(id==='knight'?'#c7ff4d':light,[[0,-2.7],[0,2.7]],1);
      weaponLine(cloth,[[-3,0],[0,0]],1.6);
      if(id==='dorian')weaponLine('#e6e8ef',[[-2,-2],[1,-3],[2,0],[0,3],[-2,2]],.6);
      break;
    }
    case 'tank':
      poly(ink,[[hx-4,hy-8],[hx+5,hy-9],[hx+6,hy+3],[hx,hy+7],[hx-5,hy+3]]);
      poly('#626e82',[[hx-3,hy-6],[hx+3.5,hy-7],[hx+4,hy+2],[hx,hy+5],[hx-3,hy+2]]);
      poly('#3a4152',[[hx,hy-6],[hx+3.5,hy-7],[hx+4,hy+2],[hx,hy+5]]);
      line(accent,[[hx-2,hy-2],[hx+3,hy-2]],1.2);break;
    case 'mage':case 'healer': {
      // Staff/lantern tilts with the hand, not an unrelated shoulder point.
      const top:P=[hx+(pose.dashing?-4:2)+attack*3,hy-14+attack*4];
      line(ink,[[hx-.5,hy+5],top],1.9);line(id==='mage'?'#b7a294':light,[[hx,hy+4],top],.65);
      if(id==='mage'){diamond(accent,top[0],top[1],2.7);diamond('#fde68a',top[0],top[1],1);}
      else{poly(ink,[[top[0]-2.7,top[1]],[top[0]+2.7,top[1]],[top[0]+3.4,top[1]+5],[top[0]-3.4,top[1]+5]]);poly(accent,[[top[0]-1.5,top[1]+.8],[top[0]+1.5,top[1]+.8],[top[0]+2,top[1]+4],[top[0]-2,top[1]+4]]);}
      break;
    }
    case 'ranger':
      weaponLine('#8a6a45',[[5,-8],[9,-4],[10,0],[9,4],[5,8]],1.5);
      weaponLine('#e3d5ad',[[5,-8],[3-attack*4,0],[5,8]],.6);
      weaponLine('#e3d5ad',[[0,0],[13+attack*2,0]],.75);weaponPoly(light,[[12,-1.5],[15,0],[12,1.5]]);break;
    case 'spirit':diamond(light,hx+2,hy-1,2);diamond(accent,hx+5,hy-3,1);break;
    case 'cherry': {
      const tip:P=[hx+3+attack*3,Math.max(-3,hy-13+attack*4)];
      line(ink,[[hx,hy+2],tip],1.5);line(light,[[hx,hy],tip],.5);
      const spread=2.6+attack*1.3;
      poly('#e5304a',[[tip[0],tip[1]-2],[tip[0]+spread,tip[1]+3],[tip[0]+spread+1,tip[1]+6],[tip[0]+1,tip[1]+5],[tip[0]-1,tip[1]+6],[tip[0]-spread,tip[1]+4]]);
      line('#8e1226',[[tip[0],tip[1]-1],[tip[0],tip[1]+5]],.7);
      line(light,[[hx,hy+1],[hx-1,hy+3],[hx-2.5,hy+2]],.6);break;
    }
    case 'velvet': {
      const spread=.35+attack*1.1;
      const fan:P[]=[[hx,hy]];
      for(let i=0;i<=5;i++){const a=-1.7+i*spread/5;fan.push([hx+Math.cos(a)*9,hy+Math.sin(a)*9]);}
      poly('#e8d5dc',fan);for(let i=1;i<fan.length;i+=2)line(accent,[[hx,hy],fan[i]],.45);break;
    }
    case 'ember':
      for(const [hand,sign] of [[frontHand,1],[rearHand,-1]] as const){const [x,y]=hand;poly('#ff5a3c',[[x,y],[x+sign*5,y-5],[x+sign*4,y-9],[x+sign*1,y-7],[x-sign*1,y-11],[x-sign*2,y-5]]);poly('#ffb14a',[[x,y],[x+sign*2,y-4],[x,y-7],[x-sign*1,y-3]]);}break;
    case 'rosalia': {
      const stem='#4a7a4e';
      const pts:P[]=[[hx,hy],[hx+4,hy-4],[hx+9,hy-8+attack*7],[hx+12,hy-4+attack*7],[hx+10,hy+1+attack*5]];
      line(stem,pts,1);line(accent,pts.map(([x,y])=>[x+.5,y]),.4);
      diamond(accent,pts[4][0],pts[4][1],2);diamond(light,pts[4][0],pts[4][1],.65);break;
    }
    case 'marionette':
      line('#ff3d6e',[[hx,hy],[hx+5,hy-6],[hx+10,hy-3+attack*6],[hx+7,hy+3],[hx+3,hy+1]],.85);
      line(light,[[hx-1,hy-1],[hx+2,hy+2]],.8);diamond(light,rearHand[0],rearHand[1],1.5);break;
    case 'onyx':
      weaponPoly('#5a5f6e',[[0,-1],[6,-2],[13,-2],[15,0],[13,2],[6,2],[0,1]]);
      for(const x of [7,10,13])weaponLine(light,[[x,-2],[x,2]],.7);weaponLine(ink,[[-2,0],[4,0]],1.6);break;
    case 'mortimer': {
      line(light,[[hx,hy+2],[hx+1,hy-8]],1);line(light,[[hx-3,hy-7],[hx+5,hy-7]],.8);
      for(const x of [-3,1,5]){line('#e3d5c6',[[hx+x,hy-7],[hx+x,hy-12]],1);diamond('#ff6b4a',hx+x,hy-14,1.15);diamond('#ffe4a0',hx+x,hy-14,.45);}break;
    }
    case 'grimshaw':
      line('#76615c',[[hx-2,hy+8],[hx+2,hy-15]],1.25);
      poly('#d8d2c4',[[hx+2,hy-15],[hx+9,hy-14],[hx+13,hy-10],[hx+13,hy-6],[hx+10,hy-10],[hx+5,hy-11],[hx+2,hy-11]]);
      line(ink,[[hx+3,hy-13],[hx+8,hy-12]],.6);break;
  }
  return true;
}
