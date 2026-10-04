import { describe, expect, it } from 'vitest';
import { solveMindlinPlate } from '@shared/shell-fem';
import { calculateEquivalentLateralForces } from '@shared/seismic-engine-v2';
import { calculateWindV2 } from '@shared/wind-engine-v2';
import { bearingCapacityTerzaghi, effectiveFoundationPressure } from '@shared/geotechnical-engine-v2';
import { designBeamAdvanced, checkPunching } from '@shared/rc-advanced';
import { detailRebar } from '@shared/rebar-detailing-engine';
import { runVerificationSuite, verifyCase } from '@shared/verification-suite';

describe('GcBtp professional engineering extensions', () => {
  it('plate FEM conserves the applied load in a supported panel', () => {
    const nodes = [
      {id:'1',x:0,y:0},{id:'2',x:4,y:0},{id:'3',x:4,y:4},{id:'4',x:0,y:4},
    ];
    const result = solveMindlinPlate({nodes,elements:[{id:'Q1',nodeIds:['1','2','3','4']}],thicknessM:.16,EKnM2:30_000_000,poissonRatio:.2,uniformLoadKnM2:5,simplySupportedNodeIds:['1','2','3','4']});
    expect(result.totalLoadKn).toBeCloseTo(80,8);
    expect(result.reactionTotalKn).toBeCloseTo(80,6);
  });
  it('wind produces positive dynamic pressure and story forces', () => {
    const r=calculateWindV2({basicSpeedMPerS:30,terrainFactor:1,referenceHeightM:10,buildingHeightM:12,facadeWidthM:10,netPressureCoefficient:1});
    expect(r.velocityPressureKPa).toBeGreaterThan(0); expect(r.storyForces).toHaveLength(4);
  });
  it('seismic equivalent force distribution conserves base shear', () => {
    const r=calculateEquivalentLateralForces({direction:'x',stories:[{storyIndex:0,heightM:3,massTonnes:100},{storyIndex:1,heightM:6,massTonnes:100}],spectrum:[{periodS:0,SaMPerS2:2},{periodS:1,SaMPerS2:2}]});
    expect(r.storyForces.reduce((s,x)=>s+x.forceKn,0)).toBeCloseTo(r.baseShearKn,8);
  });
  it('foundation pressure detects eccentricity', () => {
    const p=effectiveFoundationPressure(2,2,{NKn:400,MxKnM:40,MyKnM:20,HxKn:0,HyKn:0});
    expect(p.ex).toBeCloseTo(.05); expect(p.fullContact).toBe(true);
  });
  it('beam and punching engines return finite design values', () => {
    const basis={fckMpa:25,fykMpa:500,gammaC:1.5,gammaS:1.15,coverMm:30,minRho:.0015,maxRho:.04};
    const b=designBeamAdvanced({bMm:300,hMm:500,dMm:450,MEdKnM:100,VEdKn:100,Lmm:5000,basis});
    const p=checkPunching({reactionKn:300,MxKnM:10,MyKnM:10,dMm:150,columnBmm:300,columnHmm:300,criticalPerimeterMm:2400,fckMpa:25,rhoL:.005,gammaC:1.5});
    expect(Number.isFinite(b.AsRequiredMm2)).toBe(true); expect(Number.isFinite(p.utilization)).toBe(true);
  });
  it('detailing chooses a constructible bar arrangement', () => {
    const r=detailRebar({memberId:'B1',widthMm:300,depthMm:500,lengthM:5,coverMm:30,mainAreaMm2:1200,stirrupAreaMm2:100,availableDiametersMm:[8,10,12,16,20,25,32],minSpacingMm:20,maxSpacingMm:200});
    expect(r.providedAreaMm2).toBeGreaterThanOrEqual(1200);
  });
  it('verification helper detects a passing reference case', () => {
    expect(verifyCase({id:'x',description:'test',expected:10,actual:10.000001,tolerance:1e-4,unit:'kN'}).passed).toBe(true);
    expect(runVerificationSuite([{id:'x',description:'test',expected:1,actual:1,tolerance:1e-8,unit:'m'}]).passed).toBe(true);
  });
});
