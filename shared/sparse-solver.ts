export type SparseEntry={row:number;col:number;value:number};
export function assembleSparse(entries:SparseEntry[],n:number){const rows=Array.from({length:n},()=>new Map<number,number>());for(const e of entries)rows[e.row].set(e.col,(rows[e.row].get(e.col)??0)+e.value);return rows;}
export function sparseToDense(rows:Map<number,number>[],n:number){return rows.map(r=>{const a=Array(n).fill(0) as number[];r.forEach((v,k)=>a[k]=v);return a;});}
export function estimateDiagonalCondition(rows:Map<number,number>[]){let min=Infinity,max=0;for(const r of rows){const d=Math.abs(r.get(rows.indexOf(r))??0);if(d>0){min=Math.min(min,d);max=Math.max(max,d)}}return min===Infinity?Infinity:max/Math.max(min,1e-30);}
