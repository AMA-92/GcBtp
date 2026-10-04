# Référence DSRCAD — audit du module Bâtiment

## Sources consultées

1. [Site officiel DSRCAD](https://www.dsrcad.com/) — présentation de l’application mobile, export PDF, dimensionnement des poteaux, poutres, semelles et planchers, ainsi que les outils de génie civil.
2. [Fiche Google Play DSRCAD](https://play.google.com/store/apps/details?id=com.big.dsrcad&hl=fr) — fonctionnalités publiques annoncées et captures visibles de l’application.

## Observations vérifiées

La fiche publique annonce le dimensionnement des poteaux, poutres, semelles et planchers, avec prise en charge de la dalle pleine et des planchers à corps creux, ainsi que des plans d’exécution, notes de calcul et export PDF. Elle annonce également les métrés, volumes de béton, surfaces de coffrage, ferraillage, moments de poutres, escaliers, devis DQE et plannings.

Les captures publiques visibles montrent une interface Android centrée sur un parcours de bâtiment : sélection de niveau, représentation graphique de la structure, visualisation 3D intégrée et commandes d’action. Les captures utilisateur fournies complètent l’observation avec une grille d’axes X/Y/Z, un placement direct par type sélectionné sous la grille, des éléments identifiés par codes, des dalles translucides avec sens de portée, une vue 3D en perspective et une légende colorée.

## Limite d’audit

Les pages publiques consultées ne donnent pas accès à une session interactive complète du module Bâtiment. La comparaison fonctionnelle détaillée doit donc combiner les captures fournies par l’utilisateur, les fonctionnalités publiques annoncées et l’audit du code GcBtp. Une équivalence absolue à 100 % ne peut être affirmée sans accès à toutes les écrans et interactions privées de DSRCAD.

## Audit de la version publiée GcBtp

La version publiée expose un accueil mobile, une page Calculs regroupant 18 modules, puis une page Bâtiments avec historique des projets et bouton « Nouveau projet ». Le parcours Bâtiment est donc accessible et structuré, mais la page publique démarre par un état vide et ne permet pas d’observer la grille sans créer un projet. Les captures utilisateur restent la référence détaillée pour les écrans internes : onglets de niveaux, grille d’axes, sélection du modèle sous la grille, placement direct, édition/suppression, calcul et vue 3D.

Écart déjà visible : l’application GcBtp affiche publiquement une mention indiquant qu’il s’agit encore d’une web app mobile et que les résultats sont indicatifs ; DSRCAD est présenté comme une application mobile dédiée. L’objectif réaliste est une forte convergence fonctionnelle et visuelle, sans déclarer une identité à 100 % tant que les écrans privés, gestes et règles propriétaires de DSRCAD ne sont pas accessibles.

## Parcours Bâtiment GcBtp observé en direct

Après création d’un projet, GcBtp affiche les niveaux Fondation et RDC, l’ajout de niveau, le compteur d’éléments, la grille X/Y avec repères et deux sélecteurs sous la grille pour le type et la section. Le placement est annoncé directement par le texte « Touchez une intersection ». Les commandes Annuler/Rétablir sont visibles sous la grille.

Les écarts à traiter pour une convergence plus forte avec les captures DSRCAD sont la densité et la hiérarchie visuelle de l’écran, la présentation des boutons de niveau, les états d’aide contextuelle selon le mode Poutre/Dalle, la numérotation explicite des éléments placés, la gestion visible des charges par niveau et l’accès immédiat à la vue 3D/aux actions de bâtiment. Le code contient déjà plusieurs de ces fonctions, mais leur exposition et leur synchronisation visuelle doivent être vérifiées dans un parcours complet.
