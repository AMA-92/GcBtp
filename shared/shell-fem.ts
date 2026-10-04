/** Linear Mindlin-Reissner Q4 plate solver: w, rx, ry per node. */
export type PlateNode={id:string;x:number;y:number};
export type PlateElement={id:string;nodeIds:[string,string,string,string]};
export type MindlinPlateInput={nodes:PlateNode[];elements:PlateElement[];thicknessM:number;EKnM2:number;poissonRatio:number;shearCorrection?:number;uniformLoadKnM2:number;fixedNodeIds?:string[];simplySupportedNodeIds?:string[];springs?:Array<{nodeId:string;kWKnM?:number;kRxKnM?:number;kRyKnM?:number}>};
export type MindlinPlateResult={displacements:Array<{nodeId:string;wM:number;rxRad:number;ryRad:number}>;reactions:Array<{nodeId:string;rwKn:number;mRxKnM:number;mRyKnM:number}>;maxDeflectionM:number;totalLoadKn:number;reactionTotalKn:number;equilibriumResidualKn:number;warnings:string[]};
const zeros=(n:number)=>Array.from({length:n},()=>Array(n).fill(0) as number[]);
function solve(A:number[][],b:number[],tol=1e-11){const n=b.length,a=A.map((r,i)=>[...r,b[i]]);for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[p][c]))p=r;if(Math.abs(a[p][c])<tol)throw new Error(`Plaque singulière au ddl ${c}.`);[a[c],a[p]]=[a[p],a[c]];const d=a[c][c];for(let j=c;j<=n;j++)a[c][j]/=d;for(let r=0;r<n;r++){if(r===c)continue;const f=a[r][c];if(Math.abs(f)<1e-30)continue;for(let j=c;j<=n;j++)a[r][j]-=f*a[c][j]}}return a.map(r=>r[n]);}
function shape(xi:number,eta:number){return [0.25*(1-xi)*(1-eta),0.25*(1+xi)*(1-eta),0.25*(1+xi)*(1+eta),0.25*(1-xi)*(1+eta)];}
function deriv(xi:number,eta:number){return [[-0.25*(1-eta),0.25*(1-eta),0.25*(1+eta),-0.25*(1+eta)],[-0.25*(1-xi),-0.25*(1+xi),0.25*(1+xi),0.25*(1-xi)]];}
function inverse2(a:number,b:number,c:number,d:number){const det=a*d-b*c;if(Math.abs(det)<1e-14)throw new Error('Élément de plaque dégénéré.');return [[d/det,-b/det],[-c/det,a/det]];}
function quadArea(p:PlateNode[]){let a=0;for(let i=0;i<4;i++){const q=p[i],r=p[(i+1)%4];a+=q.x*r.y-r.x*q.y}return Math.abs(a)/2;}
export function solveMindlinPlate(input:MindlinPlateInput):MindlinPlateResult{
 const {nodes,elements}=input;if(!nodes.length||!elements.length)throw new Error('Aucun élément de plaque.');
 const E=input.EKnM2,v=input.poissonRatio,t=input.thicknessM,ks=input.shearCorrection??5/6;if(t<=0||E<=0||Math.abs(v)>=.5)throw new Error('Propriétés de plaque invalides.');
 const G=E/(2*(1+v)),Db=[[E*t**3/(12*(1-v*v)),v*E*t**3/(12*(1-v*v)),0],[v*E*t**3/(12*(1-v*v)),E*t**3/(12*(1-v*v)),0],[0,0,E*t**3/(24*(1+v))]],Ds=ks*G*t;
 const index=new Map(nodes.map((n,i)=>[n.id,i])),K=zeros(nodes.length*3),F=Array(nodes.length*3).fill(0) as number[],gauss=[-1/Math.sqrt(3),1/Math.sqrt(3)];
 for(const el of elements){const pts=el.nodeIds.map(id=>nodes[index.get(id)!]),ke=zeros(12),fe=Array(12).fill(0) as number[];
  const addPoint=(xi:number,eta:number,weight:number,includeShear:boolean,includeLoad:boolean)=>{const d=deriv(xi,eta),J11=d[0].reduce((s,q,i)=>s+q*pts[i].x,0),J12=d[0].reduce((s,q,i)=>s+q*pts[i].y,0),J21=d[1].reduce((s,q,i)=>s+q*pts[i].x,0),J22=d[1].reduce((s,q,i)=>s+q*pts[i].y,0),det=J11*J22-J12*J21;if(det<=0)throw new Error(`Élément ${el.id} orienté ou dégénéré.`);const inv=inverse2(J11,J12,J21,J22),dx=d[0].map((_,i)=>inv[0][0]*d[0][i]+inv[0][1]*d[1][i]),dy=d[0].map((_,i)=>inv[1][0]*d[0][i]+inv[1][1]*d[1][i]),N=shape(xi,eta),Bb=zeros(3),Bs=zeros(2);for(let i=0;i<4;i++){Bb[0][3*i+1]=dx[i];Bb[1][3*i+2]=dy[i];Bb[2][3*i+1]=dy[i];Bb[2][3*i+2]=dx[i];Bs[0][3*i]=dx[i];Bs[0][3*i+1]=-N[i];Bs[1][3*i]=dy[i];Bs[1][3*i+2]=-N[i];}
   for(let i=0;i<12;i++)for(let j=0;j<12;j++){let kb=0,ksv=0;for(let a=0;a<3;a++)for(let b=0;b<3;b++)kb+=Bb[a][i]*Db[a][b]*Bb[b][j];for(let a=0;a<2;a++)for(let b=0;b<2;b++)ksv+=Bs[a][i]*(a===b?Ds:0)*Bs[b][j];ke[i][j]+=(kb+(includeShear?ksv:0))*det*weight;}if(includeLoad)for(let i=0;i<4;i++)fe[3*i]+=N[i]*input.uniformLoadKnM2*det*weight;};
  for(const xi of gauss)for(const eta of gauss)addPoint(xi,eta,1,false,true);
  addPoint(0,0,4,true,false); // reduced integration for transverse shear
  const ids=el.nodeIds.map(id=>index.get(id)!);for(let i=0;i<12;i++){F[3*ids[Math.floor(i/3)]+i%3]+=fe[i];for(let j=0;j<12;j++)K[3*ids[Math.floor(i/3)]+i%3][3*ids[Math.floor(j/3)]+j%3]+=ke[i][j];}
 }
 const fixed=new Set<number>();for(const id of input.fixedNodeIds??[]){const i=index.get(id);if(i!==undefined)[0,1,2].forEach(d=>fixed.add(3*i+d));}for(const id of input.simplySupportedNodeIds??[]){const i=index.get(id);if(i!==undefined)fixed.add(3*i);}
 for(const s of input.springs??[]){const i=index.get(s.nodeId);if(i!==undefined){K[3*i][3*i]+=Math.max(0,s.kWKnM??0);K[3*i+1][3*i+1]+=Math.max(0,s.kRxKnM??0);K[3*i+2][3*i+2]+=Math.max(0,s.kRyKnM??0);}}
 if(!fixed.size)throw new Error('Plaque sans conditions aux limites.');const free=Array.from({length:F.length},(_,i)=>i).filter(i=>!fixed.has(i));const u=Array(F.length).fill(0) as number[];if(free.length){const uf=solve(free.map(i=>free.map(j=>K[i][j])),free.map(i=>F[i]));free.forEach((d,i)=>u[d]=uf[i]);}
 const reactions=(input.fixedNodeIds??[]).concat(input.simplySupportedNodeIds??[]).filter((id,i,a)=>a.indexOf(id)===i).map(id=>{const n=index.get(id)!;let rw=0,rx=0,ry=0;for(let j=0;j<F.length;j++){rw+=K[3*n][j]*u[j];rx+=K[3*n+1][j]*u[j];ry+=K[3*n+2][j]*u[j]}rw=Number.isFinite(rw)?rw:0;rx=Number.isFinite(rx)?rx:0;ry=Number.isFinite(ry)?ry:0;return {nodeId:id,rwKn:F[3*n]-rw,mRxKnM:rx-F[3*n+1],mRyKnM:ry-F[3*n+2]};});
 const totalLoadKn=input.uniformLoadKnM2*elements.reduce((s,e)=>s+quadArea(e.nodeIds.map(id=>nodes[index.get(id)!])),0),reactionTotal=reactions.reduce((s,r)=>s+r.rwKn,0);
 return {displacements:nodes.map((n,i)=>({nodeId:n.id,wM:u[3*i],rxRad:u[3*i+1],ryRad:u[3*i+2]})),reactions,maxDeflectionM:Math.max(0,...nodes.map((_,i)=>Math.abs(u[3*i]))),totalLoadKn,reactionTotalKn:reactionTotal,equilibriumResidualKn:reactionTotal-totalLoadKn,warnings:['FEM plaque Mindlin linéaire. Il reste indépendant du solveur global tant que la compatibilité coque-poutre/poteau n’est pas assemblée dans une matrice globale.']};
}
