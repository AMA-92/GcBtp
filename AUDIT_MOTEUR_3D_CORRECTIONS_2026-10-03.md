# GcBtp — Audit et corrections du moteur structurel 3D

## Corrections intégrées

### Solveur spatial `shared/frame-solver-3d.ts`
- Matrice de rigidité 3D 12×12 corrigée pour les deux axes de flexion d'une section rectangulaire non carrée.
- Constante de torsion de Saint-Venant `Jt` utilisée au lieu de `Iy + Iz`.
- `Jt` calculée et stockée dans `SectionProperty` pour les sections circulaires et rectangulaires.
- Charges uniformes verticales avec composante axiale et composantes transversales correctement converties vers les axes locaux.
- Poids propre axial des poteaux effectivement injecté dans le modèle spatial.
- Efforts internes locaux retournés aux deux extrémités : `N`, `Vy`, `Vz`, `T`, `My`, `Mz`.
- Efforts d'extrémité également retournés en axes globaux.
- Contrôle d'équilibre des forces et des moments autour de l'origine du modèle.
- Appuis élastiques 3D assemblés dans la matrice globale.
- Releases d'extrémité condensés au niveau élémentaire et récupération des déplacements libérés pour les efforts internes.
- Excentrements d'extrémité pris en compte par transformation cinématique rigide.
- Diaphragme rigide amélioré avec cinématique `Ux/Uy/Rz` par rapport au nœud maître.
- P-Delta remplacé par une procédure itérative utilisant une rigidité géométrique de compression ; la convergence est maintenant explicitement retournée.
- Les mécanismes/DDL sans raideur active sont signalés au lieu de provoquer systématiquement une fausse singularité algébrique.
- Les propriétés de section/matériau incomplètes bloquent le solveur au lieu d'introduire silencieusement des propriétés génériques.

## Connexion au dimensionnement

`shared/rc-design.ts` possède maintenant `deriveRCMemberDemandsFromSpatial()`.
Lorsque le solveur 3D a produit un résultat, le panneau béton armé utilise en priorité les efforts spatiaux pour les poutres, longrines et poteaux ; le solveur 2D reste un mode de secours.

## Tests ajoutés

`server/frame-solver-3d.test.ts` couvre :
- modèle spatial sans mécanisme ;
- poids propre axial ;
- constante de torsion de section ;
- réaction et moment d'une console 3D ;
- releases d'extrémité ;
- présence des composantes d'efforts internes.

## Validation effectuée dans cet environnement

Les fichiers cœur suivants ont été compilés directement avec TypeScript sans dépendances externes :
- `frame-solver-3d.ts`
- `frame-solver-2d.ts`
- `analytical-model.ts`
- `building-load-propagation.ts`
- `load-case-program.ts`
- `nonlinear-material.ts`
- `rc-design.ts`

Des cas numériques de référence ont été exécutés directement avec Node après transpilation :
- poteau vertical avec poids propre ;
- console 3D avec `F=10 kN` et `L=3 m`, donnant `Mbase≈30 kN·m` ;
- contrôle de l'équilibre des forces et moments ;
- analyse P-Delta itérative sur un cas simple.

## Limites qui restent volontairement bloquantes pour une note de calcul d'exécution

Ces points ne doivent pas être présentés comme certifiés par cette version :

1. Le solveur de surfaces `surface-analysis.ts` reste un modèle de plaque simplifié ; il n'est pas encore un solveur général de coques EF continu avec compatibilité poutres/dalles.
2. Les cas de vent, neige, température, tassement et accidentels ne sont pas encore affectés automatiquement à chaque élément dans le solveur spatial ; ils nécessitent un vrai système `LoadAssignment`.
3. L'analyse modale/spectrale doit être reliée aux matrices globales `K` et `M` du bâtiment pour devenir une analyse sismique complète.
4. Le P-Delta ajouté ici est une analyse géométriquement non linéaire simplifiée par rigidité géométrique ; il ne remplace pas toutes les vérifications de second ordre normatives.
5. Le matériau non linéaire actuel reste un diagnostic constitutif indicatif ; ce n'est pas un solveur non linéaire incrémental complet.
6. Le module béton armé reste explicitement « pré-étude — non réglementaire » : interaction N-Mx-My complète, torsion, fissuration `wk`, ancrages/recouvrements, dispositions sismiques, poinçonnement complet, voiles et détails constructifs doivent encore être validés selon le code et l'annexe nationale retenus.
7. Les fondations utilisent encore des hypothèses géotechniques de pré-étude lorsqu'aucune étude de sol n'est fournie.
8. Le solveur reste dense ; une matrice creuse et un solveur sparse sont nécessaires pour des modèles EF de grande taille.

## Règle de sécurité

Un résultat de GcBtp ne doit être utilisé comme note de calcul d'exécution que lorsque :
- le référentiel et son édition sont confirmés ;
- l'annexe nationale / les prescriptions locales sont confirmées ;
- les matériaux et sections sont confirmés ;
- les charges et leurs affectations sont documentées ;
- l'analyse globale converge ;
- les vérifications numériques de référence passent ;
- le dimensionnement et le détail des armatures ont été validés par un ingénieur structure qualifié.

## Extension professionnelle 2026-10-03

La version 1.1.0 ajoute une couche d'ingénierie avancée : FEM plaque Mindlin Q4, affectation structurée des charges, modal, SRSS/CQC, vent, séisme, BA avancé, PMM, poinçonnement paramétrique, voiles, escaliers, fondations/géotechnique, detailing, validation et rapport.

Le solveur 3D a également été raccordé au pipeline `professional-analysis.ts`. Les résultats 3D continuent de fournir les efforts N/V/M/T nécessaires à la dérivation des demandes BA.

Les modules marqués paramétriques ne constituent pas une certification réglementaire. Les paramètres normatifs doivent être confirmés par le code et l'annexe applicables au projet.
