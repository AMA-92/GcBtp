# Audit du ferraillage 3D — GcBtp

**Date :** 6 octobre 2026

**Dépôt :** [AMA-92/GcBtp](https://github.com/AMA-92/GcBtp)

**Branche auditée :** `main`, commit de départ `8409360`
**Périmètre :** mode Ferraillage 3D, liaison au dimensionnement BA, pré-étude des escaliers et prise en compte du référentiel des paramètres projet.

## Conclusion

Les principales fonctions annoncées sont présentes et reliées au calcul BA. Trois corrections/intégrations ont été réalisées dans la copie locale :

1. activation des **longrines** dans les catégories 3D par défaut, avec tests;
2. raccordement d’une **pré-étude indicative des deux volées d’escalier** au panneau BA, aux propositions rendues dans la vue 3D et aux rapports;
3. synchronisation du référentiel BA avec la norme **sélectionnée dans les paramètres du projet**, avec blocage explicite si le moteur ne prend pas en charge le code sélectionné.

Le mode reste une **pré-étude schématique non certifiée**. Il ne constitue pas un plan d’exécution ni une vérification réglementaire complète. Les vérifications de cisaillement d’escalier, d’espacement maximal normatif, des ancrages/recouvrements et des paliers sont explicitement bloquées ou signalées comme non calculées.

## Fonctionnalités confirmées et intégrées

| Sujet | Constat |
|---|---|
| Activation/désactivation | `Building3DView` gère le mode par état local d’affichage; le bouton ne modifie pas la géométrie du projet. |
| Béton et commandes | Opacité du béton réglable, filtres par familles, légende des aciers et fiche lors de la sélection d’une proposition. |
| Liaison au calcul | `BuildingCreateFlow` transmet les résultats BA à `Building3DView`; les propositions sont indexées par identifiant d’élément. |
| Familles | Poteaux, poutres, longrines, dalles, balcons traités comme dalles, semelles, voiles et escaliers peuvent afficher les propositions disponibles. |
| Résultat absent | Sans géométrie/demande et proposition valides, aucune barre n’est dessinée. |
| HA8 en poteau | Le dimensionnement impose au moins 10 mm pour les armatures longitudinales principales, rejette un remplacement HA8 et permet HA8 pour les cadres si le catalogue le permet. Des tests existants couvrent ces cas. |
| Norme du projet | Le panneau BA reprend maintenant le `norm` des paramètres projet; l’ancienne sélection locale concurrente a été retirée. Un changement de famille de norme réinitialise les coefficients et confirmations dépendants au lieu de réutiliser silencieusement une ancienne saisie. |
| Portée des codes | Les profils BAEL 91 mod. 99 et Eurocode 2 sont reconnus pour la pré-étude générique. Une norme sélectionnée non supportée, par exemple BS 8110, SANS 10100 ou ECP, bloque le ferraillage et l’optimisation au lieu d’être traitée à tort comme Eurocode. `regulatoryReady` reste `false`. |

## Changements apportés

### Filtre des longrines

La clé `longrines` manquait dans l’état initial des filtres; la catégorie était donc désactivée même si l’interface la présentait cochée. Les catégories et leur classement sont maintenant centralisés dans `shared/reinforcement-3d.ts`; les longrines sont actives par défaut et couvertes par des tests.

### Pré-étude des escaliers

`BuildingCreateFlow` dérive les dimensions des deux volées depuis leurs coins 3D, les niveaux et la configuration d’escalier. Le poids propre est estimé avec `calculateStairPermanentLoad`; la charge d’usage et les facteurs G/Q proviennent du projet et de la combinaison sélectionnée. Le moteur `designStairV2` calcule une bande de volée simplement appuyée sur la portée horizontale et produit des propositions d’armatures principales et transversales minimales. Si la géométrie est absente ou invalide, aucune barre n’est proposée.

Les propositions apparaissent dans le panneau BA, la vue 3D, le métré/nomenclature et la synthèse numérique. Les checks de cisaillement normatif, d’espacement maximal selon l’édition et l’annexe, d’ancrage et de recouvrement sont explicitement bloqués. Ce calcul est une **pré-étude générique**, pas un dimensionnement certifié.

### Référentiel depuis les paramètres du projet

Le panneau n’offre plus un deuxième choix de norme susceptible de diverger de celui du projet. Il affiche `projectNorm`, utilise cette valeur dans le résultat et choisit le profil de pré-étude BAEL ou Eurocode correspondant. En cas de changement de famille, les coefficients, l’annexe/source par défaut et l’attestation de base sont réinitialisés; les saisies de session ne peuvent donc pas masquer le changement fait dans les paramètres.

Le profil sélectionné ne transforme toutefois pas les formules génériques en implémentation exhaustive BAEL ou EN 1992. Pour tout autre code du catalogue projet non pris en charge par ce moteur, le calcul et l’optimisation sont bloqués et aucun ferraillage ne doit être affiché.

## Travaux restant à faire

### Escaliers — analyse et dispositions complètes

Le calcul ajouté traite chaque volée indépendamment, en bande simplement appuyée, et utilise la projection horizontale. Il ne résout pas les conditions réelles d’appui, la continuité avec les paliers, les paliers eux-mêmes, les efforts latéraux, la torsion, le poinçonnement, la flèche, la fissuration ni les détails constructifs. Les barres 3D restent des lignes schématiques et les longueurs proposées n’incluent pas les ancrages et recouvrements.

**À compléter :** établir le modèle de calcul des volées et paliers depuis les liaisons réelles, calculer les enveloppes de sollicitations et les dispositions transversales, puis valider par des cas de référence et un ingénieur structure.

### Détails d’exécution

Les crochets, longueurs d’ancrage et de recouvrement, zones de confinement, arrêts de barres et dispositions sismiques ne sont pas calculés. Les valeurs d’espacement/répartition affichées ne valent pas validation des règles de détail du référentiel.

**À compléter :** implémenter ces règles pour l’édition et l’annexe nationales choisies, avec les données d’adhérence, de confinement et de position; produire les formes et longueurs constructives; valider les cas par un ingénieur.

### Vérifications réglementaires

La sélection BAEL/Eurocode est maintenant suivie par le panneau, et les autres codes sont bloqués lorsqu’ils ne sont pas pris en charge. Mais les calculs BAEL et Eurocode disponibles demeurent des pré-études génériques paramétrées, non des implémentations normatives complètes. Les éditions/annexes, la flexion biaxiale réglementaire, le second ordre complet, la torsion, le poinçonnement complet, les voiles et les dispositions sismiques ne sont pas entièrement couverts.

**À compléter :** implémenter séparément les clauses propres aux deux codes, expliciter l’édition et l’annexe/projet applicables, comparer les résultats à des exemples reconnus et faire valider les calculs par un ingénieur qualifié. Sans cette revue, la conformité ne peut être affirmée.

## Vérifications exécutées

- `pnpm check` : réussi.
- `pnpm test` : **57 fichiers, 277 tests réussis**.
- `pnpm build` : réussi côté client et serveur.
- `git diff --check` : réussi.
- Avertissement non bloquant : bundle JavaScript client supérieur à 500 kB minifié.

## État des changements

Les changements sont locaux dans la copie de travail et ne sont ni commités ni poussés sur GitHub. Le commit de départ reste `8409360`.
