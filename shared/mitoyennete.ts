/** Controls based on Articles L.37-L.43 of Law 2023-21 (Senegal). */
export type MitoyenneteInput = {
  country: string;
  wallOnSeparativeLine: boolean;
  writtenNeighbourAgreement: boolean;
  isHousingProgram: boolean;
  wallIsCommon: boolean;
  hasOpeningInCommonWall: boolean;
  openingDistanceToBoundaryM?: number;
  directViewToNeighbour: boolean;
};

export function checkMitoyennete(input: MitoyenneteInput) {
  if (input.country !== 'Sénégal') return { applicable:false, checks:[] as any[], blockers:[] as string[] };
  const checks = [
    {id:'separative-line', label:'Construction sur ligne séparative', status:(input.wallOnSeparativeLine && !input.writtenNeighbourAgreement && !input.isHousingProgram) ? 'bloquant' : 'conforme', reference:'Loi 2023-21, art. L.37', message:'Construction sur la ligne séparative interdite sans accord écrit des propriétaires, hors programme immobilier.'},
    {id:'common-wall-opening', label:'Ouverture dans mur mitoyen', status:(input.wallIsCommon && input.hasOpeningInCommonWall && !input.writtenNeighbourAgreement) ? 'bloquant' : 'conforme', reference:'Loi 2023-21, art. L.39', message:'Une ouverture dans un mur mitoyen nécessite l’accord de l’autre propriétaire.'},
    {id:'direct-view', label:'Vue directe vers fonds voisin', status:(input.directViewToNeighbour && (input.openingDistanceToBoundaryM ?? 0) < 1) ? 'bloquant' : 'conforme', reference:'Loi 2023-21, art. L.43', message:'Une ouverture ne doit pas permettre une vue directe sur le fonds voisin à moins de 1 m de la ligne séparatrice.'},
  ];
  return {applicable:true, checks, blockers:checks.filter(c=>c.status==='bloquant').map(c=>c.message)};
}
