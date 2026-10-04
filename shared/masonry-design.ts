export type MasonryDemand = {
  id: string; heightM: number; lengthM: number; thicknessMm: number;
  axialKn: number; shearKn: number; momentKnM?: number;
  compressiveStrengthMpa: number; shearStrengthMpa: number;
  eccentricityMm?: number; openingRatio?: number; supportLengthMm?: number;
  verticalTieSpacingM?: number; horizontalTieSpacingM?: number;
};

export type MasonryCheck = { id:string; label:string; demand:number; resistance:number; utilization:number; status:'satisfaisant'|'non satisfaisant'|'bloqué'; unit:string; formula:string; };

export function designMasonryWall(d:MasonryDemand){
  const A = d.lengthM * d.thicknessMm * 1000;
  const tM = d.thicknessMm / 1000;
  const slenderness = d.heightM / Math.max(tM, 1e-9);
  const eccentricity = Math.abs(d.eccentricityMm ?? (d.momentKnM ? d.momentKnM * 1000 / Math.max(Math.abs(d.axialKn), 1e-9) : 0));
  const sigmaEd = Math.abs(d.axialKn) * 1000 / Math.max(A,1e-9);
  const sigmaRd = d.compressiveStrengthMpa / 1.5;
  const tauEd = Math.abs(d.shearKn) * 1000 / Math.max(A,1e-9);
  const tauRd = d.shearStrengthMpa / 1.5;
  const opening = d.openingRatio ?? 0;
  const checks:MasonryCheck[] = [
    {id:'masonry-compression',label:'Compression du mur',demand:sigmaEd,resistance:sigmaRd,utilization:sigmaEd/Math.max(sigmaRd,1e-9),status:sigmaEd<=sigmaRd?'satisfaisant':'non satisfaisant',unit:'MPa',formula:'σEd ≤ σRd'},
    {id:'masonry-shear',label:'Cisaillement du mur',demand:tauEd,resistance:tauRd,utilization:tauEd/Math.max(tauRd,1e-9),status:tauEd<=tauRd?'satisfaisant':'non satisfaisant',unit:'MPa',formula:'τEd ≤ τRd'},
    {id:'masonry-slenderness',label:'Élancement H/t',demand:slenderness,resistance:27.5,utilization:slenderness/27.5,status:slenderness<=27.5?'satisfaisant':'non satisfaisant',unit:'—',formula:'H/t ≤ 27,5 — seuil de contrôle à confirmer selon le système de maçonnerie'},
    {id:'masonry-eccentricity',label:'Excentricité',demand:eccentricity,resistance:d.thicknessMm/6,utilization:eccentricity/Math.max(d.thicknessMm/6,1e-9),status:eccentricity<=d.thicknessMm/6?'satisfaisant':'non satisfaisant',unit:'mm',formula:'e ≤ t/6 — contrôle de compression sans traction simplifié'},
    {id:'masonry-openings',label:'Taux d’ouvertures',demand:opening,resistance:.30,utilization:opening/.30,status:opening<=.30?'satisfaisant':'non satisfaisant',unit:'ratio',formula:'Ouvertures ≤ 30 % avant vérification locale des jambages/linteaux'},
    {id:'masonry-ties-vertical',label:'Chaînages verticaux',demand:d.verticalTieSpacingM ?? Infinity,resistance:4,utilization:(d.verticalTieSpacingM ?? Infinity)/4,status:(d.verticalTieSpacingM ?? Infinity)<=4?'satisfaisant':'bloqué',unit:'m',formula:'Espacement de contrôle ≤ 4 m ; à confirmer selon système et règles locales'},
    {id:'masonry-ties-horizontal',label:'Chaînages horizontaux',demand:d.horizontalTieSpacingM ?? Infinity,resistance:4,utilization:(d.horizontalTieSpacingM ?? Infinity)/4,status:(d.horizontalTieSpacingM ?? Infinity)<=4?'satisfaisant':'bloqué',unit:'m',formula:'Espacement de contrôle ≤ 4 m ; à confirmer selon système et règles locales'},
  ];
  return {status:'contrôle réglementaire conditionnel', checks, warnings:['Les résistances des blocs, mortiers, joints, chaînages et règles parasismiques doivent être rattachées au référentiel structurel sélectionné.','Les seuils de contrôle génériques ne constituent pas à eux seuls une certification de maçonnerie.']};
}
