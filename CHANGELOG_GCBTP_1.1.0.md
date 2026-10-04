# GcBtp 1.1.0 — Upgrade moteur structurel

## Moteur 3D
- efforts internes N, Vy, Vz, My, Mz, T ;
- poids propre axial ;
- releases ;
- excentrements ;
- ressorts ;
- diaphragmes cinématiques ;
- P-Delta itératif ;
- réactions avec matrice tangentielle finale ;
- contrôles d'équilibre forces/moments.

## 15 capacités ajoutées
- FEM Mindlin Q4 ;
- affectation des charges ;
- modal ;
- SRSS/CQC ;
- vent ;
- séisme ;
- poutres BA ;
- poteaux PMM ;
- poinçonnement ;
- voiles ;
- escaliers ;
- fondations/géotechnique ;
- detailing acier ;
- validation ;
- rapport/performance.

## Statut
Les modules paramétriques sont utilisables comme moteurs d'analyse/pré-dimensionnement et doivent être raccordés aux paramètres réglementaires du projet avant une note de calcul finale. La compatibilité globale coque-poutre-poteau et la certification réglementaire restent des étapes distinctes.

## Mise à niveau réglementation Sénégal — Code 2023-21
- Ajout du catalogue `shared/senegal-construction-code.ts` : Loi n°2023-21 + Décret n°2024-1495.
- Contrôles automatiques : autorisation de construire, étude géotechnique, contrôle technique, ouverture des fouilles, sécurité, accessibilité et performance énergétique.
- Ajout de `shared/mitoyennete.ts` : contrôles L.37-L.43 sur ligne séparative, mur mitoyen, ouvertures et vues directes.
- Ajout de `shared/masonry-design.ts` : contrôles compression, cisaillement, élancement, excentricité, ouvertures et chaînages.
- Sénégal/Dakar appliqué aux valeurs par défaut et aux exemples de démarrage ; suppression des propositions géotechniques Abidjan dans le moteur générique.
- Les données et contrôles restent liés à leur source et à la validation du dossier local ; aucun seuil réglementaire structurel n'est présenté comme certifié sans référentiel de calcul explicite.
