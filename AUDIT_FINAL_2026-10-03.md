# Audit final GcBtp v6 — 2026-10-03

## Décisions appliquées

- L'optimisation de section est **unique par élément** : une proposition est testée avec les efforts courants ; si elle passe les contrôles disponibles, l'utilisateur la valide une fois et la section est verrouillée.
- Après validation, la maquette est réellement modifiée et un recalcul global est déclenché pour actualiser charges, réactions et ferraillage. **Aucun nouveau cycle d'optimisation automatique n'est lancé sur l'élément validé.**
- Les éléments verrouillés sont conservés dans le projet (`optimizationLockedElementIds`) et exclus des propositions futures.
- Une section validée est enregistrée sous un nom de modèle réutilisable par type + géométrie, sans intégrer l'identifiant de l'élément.

## Plans A4

- Un plan A4 représente un seul élément type.
- Les éléments identiques sont regroupés uniquement si type + section/géométrie + fingerprint de ferraillage sont identiques.
- Le plan affiche le représentant, la quantité et les repères associés, sans dessiner tous les éléments du groupe.
- Un bouton permet de télécharger le PDF A4 individuel de chaque groupe ; le dossier complet reste disponible.
- L'orientation A4 portrait/paysage du gabarit est appliquée au PDF.
- La nomenclature dépasse désormais la limite artificielle de dix lignes : des pages A4 de suite sont ajoutées automatiquement.
- Le cartouche exploite les informations principales de l'entreprise, du bureau, du projet, du client, des responsables et les références.
- Le schéma contient des indications dimensionnelles et rappelle qu'il représente l'élément type.

## 3D

- Les sections rectangulaires sont rendues à leurs dimensions métriques réelles.
- Les poteaux circulaires du catalogue sont rendus comme volumes polygonaux circulaires.
- La grille 3D respecte les distances métriques de la trame.

## Optimisation des semelles

- La recherche ne se limite plus aux carrés : des dimensions rectangulaires sont testées, avec épaisseurs candidates.
- La proposition reste conditionnée aux contrôles disponibles dans le moteur.

## Limites maintenues volontairement

Le logiciel ne déclare pas de conformité réglementaire là où elle n'est pas implémentée. Les limites déjà signalées restent explicites : règles nationales/annexes complètes, torsion, poinçonnement, voiles réglementaires complets, dispositions sismiques, ancrages normatifs, second ordre et fissuration complète. Ces points ne doivent pas être remplacés par une mention trompeuse de conformité.

## Vérification technique de cette version

- Transpilation TypeScript/TSX des fichiers modifiés : OK, aucune erreur de syntaxe signalée.
- Le `tsc --noResolve` ciblé ne remonte aucune erreur dans les fichiers modifiés ; les erreurs restantes du projet sont principalement liées aux dépendances non installées et à des erreurs préexistantes/résolution de modules.
- Les tests Vitest complets n'ont pas pu être exécutés dans l'environnement de travail faute de `node_modules` complet.
