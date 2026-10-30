import type { CharacterArtPose } from './character-art';
import { quantizeCharacterPose } from './character-performance';
import { bindVertex, deformVertex, FULL_ART_RIGS, resolveRigPose, resolveSkinTransforms, propOwnerAt, type Point, type SkinVertex } from './fullart-rig';

interface Triangle {
  a:number; b:number; c:number;
  x:number; y:number; ax:number; ay:number; bx:number; by:number; determinant:number;
}

interface Mesh {
  vertices: SkinVertex[];
  triangles: Triangle[];
  aspect: number;
  texture: HTMLCanvasElement;
  props: { texture: HTMLCanvasElement; bone: number; bounds: Point[]; behindBody: boolean; shaft?: { from: Point; to: Point; width: number } }[];
}
const meshes = new Map<string, Mesh>();
interface ArtFrame { canvas: HTMLCanvasElement; left: number; top: number; bytes: number }
const frames = new Map<string, ArtFrame>();
let frameBytes = 0;
// Dynamic silhouettes use a byte ceiling as well as a frame-count ceiling.
// Large scythe swings get enough room without growing the shared LRU unchecked.
export const FULL_ART_FRAME_LIMIT = 512;
export const FULL_ART_CACHE_BYTE_LIMIT = 64 * 1024 * 1024;
const EDGE = 192;

/** Diagnostic snapshot for the render benchmark; no additional render work. */
export function fullArtCacheStats():{frames:number;bytes:number} {
  return {frames:frames.size,bytes:frameBytes};
}

export function fullArtFrameRect(points: readonly Point[]): { left: number; top: number; width: number; height: number } {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
  const left = Math.floor(minX) - 3;
  const top = Math.floor(minY) - 3;
  const right = Math.ceil(maxX) + 3;
  const bottom = Math.ceil(maxY) + 3;
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function buildMesh(id:string,img:HTMLImageElement):Mesh|undefined {
  const rig=FULL_ART_RIGS[id];
  if(!rig||typeof document==='undefined')return;
  const aspect=img.width/img.height;
  const mask=document.createElement('canvas');
  mask.width=img.width;mask.height=img.height;
  const ctx=mask.getContext('2d',{willReadFrequently:true});
  if(!ctx)return;
  ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,img.width,img.height),rgba=pixels.data;
  const props:Mesh['props']=[];
  const removed=new Uint8Array(img.width*img.height);
  // Rigid accessories are isolated once, in memory. The source asset remains
  // untouched and the animated prop retains its exact shaft/blade silhouette.
  for(const arm of [0,1] as const) {
    const definitions=rig.props?.filter(p=>p.arm===arm)??[];
    if(!definitions.length)continue;
    const texture=document.createElement('canvas');texture.width=img.width;texture.height=img.height;
    const propCtx=texture.getContext('2d');if(!propCtx)continue;
    const part=propCtx.createImageData(img.width,img.height);
    let left=img.width,top=img.height,right=0,bottom=0;
    for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
      const i=y*img.width+x,o=i*4;
      if(propOwnerAt(rig, [x/img.width,y/img.height]) === arm){
        part.data.set(rgba.subarray(o,o+4),o);removed[i]=1;
        if(rgba[o+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
      }
    }
    propCtx.putImageData(part,0,0);props.push({texture,bone:arm===0?3:5,
      bounds:left<right?[[left/img.height,top/img.height],[right/img.height,top/img.height],[right/img.height,bottom/img.height],[left/img.height,bottom/img.height]]:[],
      behindBody:definitions.some(p=>p.behindBody),shaft:definitions.find(p=>p.shaft)?.shaft});
  }
  const original=rgba.slice();
  for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){
    const i=y*img.width+x,o=i*4;
    // Keep boots, gown hems, hair and low weapon tips intact. Broad bottom
    // strips previously erased real artwork along with painted ground lines.
    if(!removed[i])continue;
    rgba[o+3]=0;
    // At a staff crossing inside a robe, extend adjacent costume ink under
    // its old position. Outside the figure the cut remains transparent.
    const neighbors:number[]=[];
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      for(let d=1;d<=10;d++){
        const px=x+dx*d,py=y+dy*d;if(px<0||py<0||px>=img.width||py>=img.height)break;
        const j=py*img.width+px;
        if(!removed[j]){if(original[j*4+3]>220)neighbors.push(j);break;}
      }
    }
    if(neighbors.length>=3){
      const j=neighbors[0]*4;rgba[o]=original[j];rgba[o+1]=original[j+1];rgba[o+2]=original[j+2];rgba[o+3]=255;
    }
  }
  ctx.putImageData(pixels,0,0);
  const cols=24,rows=34;
  const indices:[number,number,number][]=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    // Cull only provably transparent cells; thin bowstrings and staff tips
    // survive because this checks every source pixel, not just the corners.
    let visible=false;
    for(let py=Math.floor(y/rows*img.height);py<Math.ceil((y+1)/rows*img.height)&&!visible;py++)
      for(let px=Math.floor(x/cols*img.width);px<Math.ceil((x+1)/cols*img.width);px++)
        if(rgba[(py*img.width+px)*4+3]>0){visible=true;break;}
    if(!visible)continue;
    const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;
    indices.push([a,b,d],[a,d,c]);
  }
  // Share one rest skeleton across the grid and precompile the immutable
  // source geometry. Keep the original grid extents and bitmap placement so
  // nearest-neighbor sampling remains pixel-identical to the original art.
  const rest=resolveRigPose(rig,aspect,{}).bones;
  const vertices:SkinVertex[]=[],source:Point[]=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
    const vertex=bindVertex(rig,aspect,[x/cols,y/rows],rest);vertices.push(vertex);
    source.push([vertex.source[0]*img.height,vertex.source[1]*img.height]);
  }
  const triangles=indices.map(([a,b,c])=>{
    const p=source[a],q=source[b],r=source[c];
    const ax=q[0]-p[0],ay=q[1]-p[1],bx=r[0]-p[0],by=r[1]-p[1];
    return {a,b,c,x:p[0],y:p[1],ax,ay,bx,by,determinant:ax*by-bx*ay};
  });
  const mesh={vertices,triangles,aspect,texture:mask,props};meshes.set(id,mesh);return mesh;
}

/** Shared deterministic pose bucketing. Time is the simulation clock, so
 * paused games don't animate; attacks and flight remain separate cache keys.
 * Buckets are fine enough (48/cycle ≈ 4.3° at the retimed ~3 stride/s gait)
 * that successive render frames differ without a visible step. */
export function fullArtFrameKey(id:string,pose:CharacterArtPose):string {
  return id + ':' + Object.values(quantizeCharacterPose(pose)).join(':');
}

function paintTriangle(ctx:CanvasRenderingContext2D,img:HTMLCanvasElement,triangle:Triangle,target:readonly Point[]):void {
  const {ax,ay,bx,by,determinant}=triangle;
  const p=target[triangle.a],q=target[triangle.b],r=target[triangle.c];
  if(Math.abs(determinant)<1e-8)return;
  const ux=q[0]-p[0],uy=q[1]-p[1],vx=r[0]-p[0],vy=r[1]-p[1];
  const m00=(ux*by-vx*ay)/determinant,m01=(vx*ax-ux*bx)/determinant;
  const m10=(uy*by-vy*ay)/determinant,m11=(vy*ax-uy*bx)/determinant;
  ctx.save();ctx.beginPath();
  // Subpixel overlap hides Canvas triangle-edge antialias seams. Alpha on
  // the source silhouette is retained; there are no rectangular limb cuts.
  const mx=(p[0]+q[0]+r[0])/3,my=(p[1]+q[1]+r[1])/3;
  for(let i=0;i<3;i++){
    const v=i===0?p:i===1?q:r,dx=v[0]-mx,dy=v[1]-my,length=Math.hypot(dx,dy)||1;
    const x=v[0]+dx/length*.35,y=v[1]+dy/length*.35;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.clip();
  ctx.transform(m00,m10,m01,m11,p[0]-m00*triangle.x-m01*triangle.y,p[1]-m10*triangle.x-m11*triangle.y);
  ctx.drawImage(img,0,0);
  ctx.restore();
}

/** Rasterize a skinned pose only when it changes, then draw it with one
 * drawImage on subsequent render ticks. Original PNG/WebP pixels stay intact. */
export function drawSkinnedFullArt(ctx:CanvasRenderingContext2D,id:string,img:HTMLImageElement,width:number,height:number,pose:CharacterArtPose):boolean {
  const mesh=meshes.get(id)??buildMesh(id,img);
  if(!mesh)return false;
  const key=fullArtFrameKey(id,pose);
  let frame=frames.get(key);
  if(!frame){
    const bakedPose=quantizeCharacterPose(pose);
    const resolved=resolveRigPose(FULL_ART_RIGS[id],mesh.aspect,bakedPose);
    const transforms=resolveSkinTransforms(resolved);
    const target=mesh.vertices.map(v=>{const p=deformVertex(v,resolved,transforms);return [p[0]*EDGE,p[1]*EDGE] as Point;});
    const extent:Point[]=[...target];
    for(const prop of mesh.props){
      const transform=(p:Point)=>{const v=deformVertex({source:p,weights:[{bone:prop.bone,weight:1}],cloth:0},resolved,transforms);return [v[0]*EDGE,v[1]*EDGE] as Point;};
      extent.push(...prop.bounds.map(transform));
      if(prop.shaft)for(const p of [prop.shaft.from,prop.shaft.to]){
        const v=transform([p[0]*mesh.aspect,p[1]]),r=prop.shaft.width*EDGE/2;
        extent.push([v[0]-r,v[1]-r],[v[0]+r,v[1]+r]);
      }
    }
    const rect=fullArtFrameRect(extent),canvas=document.createElement('canvas');
    canvas.width=rect.width;canvas.height=rect.height;
    const paint=canvas.getContext('2d');if(!paint)return false;
    paint.imageSmoothingEnabled=false;paint.translate(-rect.left,-rect.top);
    const paintProp = (prop: Mesh['props'][number]) => {
      const b=resolved.bones[prop.bone];
      const angle=Math.atan2(b.to[1]-b.from[1],b.to[0]-b.from[0])-Math.atan2(b.restTo[1]-b.restFrom[1],b.restTo[0]-b.restFrom[0]);
      paint.save();paint.translate(b.from[0]*EDGE,b.from[1]*EDGE);
      paint.rotate(angle);paint.translate(-b.restFrom[0]*EDGE,-b.restFrom[1]*EDGE);
      if(prop.shaft){
        const {from,to,width:shaftWidth}=prop.shaft;
        paint.lineCap='round';paint.strokeStyle='#19151f';paint.lineWidth=shaftWidth*EDGE;
        paint.beginPath();paint.moveTo(from[0]*mesh.aspect*EDGE,from[1]*EDGE);paint.lineTo(to[0]*mesh.aspect*EDGE,to[1]*EDGE);paint.stroke();
        paint.strokeStyle='#55495f';paint.lineWidth=shaftWidth*EDGE*.5;paint.stroke();
      }
      paint.drawImage(prop.texture,0,0,EDGE*mesh.aspect,EDGE);paint.restore();
    };
    for(const prop of mesh.props)if(prop.behindBody)paintProp(prop);
    for(const triangle of mesh.triangles)paintTriangle(paint,mesh.texture,triangle,target);
    for(const prop of mesh.props)if(!prop.behindBody)paintProp(prop);
    frame={canvas,left:rect.left,top:rect.top,bytes:canvas.width*canvas.height*4};
    frames.set(key,frame);frameBytes+=frame.bytes;
    while(frames.size>FULL_ART_FRAME_LIMIT || frameBytes>FULL_ART_CACHE_BYTE_LIMIT){
      const oldest=frames.keys().next().value!;
      frameBytes-=frames.get(oldest)!.bytes;frames.delete(oldest);
    }
  }else {frames.delete(key);frames.set(key,frame);}
  const scale=height*1.3/EDGE;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.drawImage(frame.canvas,width/2-EDGE*mesh.aspect/2*scale+frame.left*scale,height-EDGE*scale+frame.top*scale,frame.canvas.width*scale,frame.canvas.height*scale);
  ctx.restore();return true;
}
