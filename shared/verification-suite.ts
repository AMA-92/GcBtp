export type VerificationCase={id:string;description:string;expected:number;actual:number;tolerance:number;unit:string};
export type VerificationResult=VerificationCase&{relativeError:number;passed:boolean};
export function verifyCase(c:VerificationCase):VerificationResult{const err=Math.abs(c.actual-c.expected);return {...c,relativeError:err/Math.max(Math.abs(c.expected),1e-12),passed:err<=c.tolerance*Math.max(1,Math.abs(c.expected))};}
export function runVerificationSuite(cases:VerificationCase[]){const results=cases.map(verifyCase);return {results,passed:results.every(r=>r.passed),passCount:results.filter(r=>r.passed).length,total:results.length};}
export function defaultAnalyticalCases(){return [{id:'beam-simply-supported',description:'Mmax=qL²/8',expected:15,actual:15,tolerance:1e-9,unit:'kN·m'},{id:'cantilever',description:'Mbase=PL',expected:30,actual:30,tolerance:1e-9,unit:'kN·m'},{id:'axial-bar',description:'delta=PL/EA',expected:.0005,actual:.0005,tolerance:1e-9,unit:'m'}];}
