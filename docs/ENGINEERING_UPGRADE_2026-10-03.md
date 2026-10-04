# GcBtp — montée en gamme du moteur structurel

## Objectif

Cette version ajoute une couche d'ingénierie avancée au projet existant sans supprimer les modules historiques. Les moteurs sont volontairement séparés afin de distinguer :

1. modèle analytique ;
2. analyse globale ;
3. FEM de surfaces ;
4. actions et cas de charges ;
5. dimensionnement ;
6. détail des armatures ;
7. géotechnique ;
8. validation et rapport.

## 15 chantiers implantés

| # | Chantier | Implantation |
|---|---|---|
| 1 | Modèle analytique 3D | solveur 3D existant corrigé et pipeline professionnel |
| 2 | Dalles/voiles FEM | `shared/shell-fem.ts` : plaque Mindlin Q4 linéaire |
| 3 | Affectation des charges | `shared/load-assignment-engine.ts` |
| 4 | Modal | `shared/modal-analysis.ts` : valeurs/vecteurs propres et participation |
| 5 | Spectre | `shared/response-spectrum.ts` : SRSS/CQC paramétrique |
| 6 | Vent | `shared/wind-engine-v2.ts` |
| 7 | Séisme | `shared/seismic-engine-v2.ts` |
| 8 | Poutres BA | `shared/rc-advanced.ts` |
| 9 | Poteaux PMM | `shared/rc-advanced.ts` |
| 10 | Dalles/poinçonnement | `shared/rc-advanced.ts` |
| 11 | Voiles | `shared/wall-design-v2.ts` |
| 12 | Escaliers | `shared/stair-design-v2.ts` |
| 13 | Fondations/géotechnique | `shared/geotechnical-engine-v2.ts`, `shared/foundation-design-v2.ts` |
| 14 | Detailing acier | `shared/rebar-detailing-engine.ts` |
| 15 | Validation/rapport/performance | `shared/verification-suite.ts`, `shared/professional-report.ts`, `shared/sparse-solver.ts` |

## Limite réglementaire

Les moteurs paramétriques ne doivent pas être présentés comme une certification réglementaire. Les coefficients, annexes nationales, règles sismiques, classes d'exposition, ancrages, recouvrements, poinçonnement complet, interaction béton-acier et règles géotechniques doivent être sélectionnés et validés par le référentiel du projet.

Le rapport final doit rester bloqué si les paramètres nécessaires sont marqués provisoires.

## Validation réalisée dans cette archive

- compilation isolée des nouveaux moteurs TypeScript ;
- compilation du cœur 3D et de ses dépendances ;
- cas console 3D : 10 kN × 3 m → 30 kN·m ;
- contrôle du poids propre axial ;
- équilibre forces/moments ;
- releases ;
- FEM plaque : conservation de 80 kN de charge appliquée sur 4 × 4 m à 5 kN/m² ;
- vent : pression et distribution d'étage ;
- séisme : conservation du cisaillement de base ;
- fondation : excentricité ;
- poutre BA, poinçonnement et detailing : valeurs finies et armature fournie ≥ armature requise ;
- suite analytique de références.

## Vérification complète du dépôt

Le `node_modules` fourni dans l'environnement d'exécution de cette archive n'est pas complet. Le contrôle global `tsc`/Vitest ne peut donc pas être considéré comme un build de production dans cet environnement tant que les dépendances ne sont pas réinstallées.

Après installation :

```bash
pnpm install
pnpm check
pnpm test
pnpm test:engineering
pnpm build
```

## Étape suivante recommandée

La prochaine évolution technique doit assembler réellement les coques/dalles/voiles avec les poutres et poteaux dans une matrice globale commune, puis brancher les matrices globales `K` et `M` au calcul modal/spectre. C'est le point qui séparera définitivement une analyse de panneaux indépendante d'un vrai modèle EF global de bâtiment.
