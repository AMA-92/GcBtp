# Project TODO

- [x] Définir le périmètre fonctionnel du MVP GcBtp et les limites des calculs techniques
- [x] Mettre à jour le titre, la langue et l’identité visuelle de l’application GcBtp
- [x] Concevoir le modèle de données pour utilisateurs, projets, éléments, charges, prix, devis, calculs et rapports
- [x] Ajouter la gestion des projets : créer, modifier, dupliquer, archiver et consulter l’historique
- [x] Ajouter le module de métré par élément structurel
- [x] Ajouter le calcul des volumes de béton
- [x] Ajouter le calcul des surfaces de coffrage
- [x] Ajouter l’estimation des quantités d’acier
- [x] Ajouter la bibliothèque de prix unitaires réutilisable
- [x] Ajouter le module de devis DQE avec postes, unités, quantités, prix, taxes et totaux
- [x] Ajouter le module de descente de charges simplifiée plancher → poutre → poteau → semelle
- [x] Afficher les hypothèses, unités, formules et résultats intermédiaires de la descente de charges
- [x] Ajouter le dimensionnement simplifié des poutres, poteaux, semelles et planchers
- [x] Ajouter le choix dalle pleine / dalle à corps creux
- [x] Ajouter le calcul indicatif du ferraillage et des sections avec avertissements de validation professionnelle
- [x] Ajouter la formulation et le dosage indicatif du béton
- [x] Ajouter le calcul des moments fléchissants et efforts principaux des poutres
- [x] Ajouter le dimensionnement indicatif des escaliers
- [x] Ajouter l’aperçu 3D ou schéma technique des éléments calculés
- [x] Ajouter la génération de notes de calcul, rapports de descente de charges et DQE en PDF
- [x] Sauvegarder les rapports PDF dans le stockage sécurisé et persistante
- [x] Ajouter l’accès aux rapports depuis tous les appareils connectés
- [x] Ajouter des liens de partage sécurisés pour les rapports
- [x] Ajouter l’assistant conversationnel contextuel aux modules
- [x] Ajouter les tests unitaires Vitest du moteur de calcul, du DQE et des validations
- [x] Vérifier les parcours responsive sur desktop et mobile
- [x] Vérifier les états de chargement, erreurs, données vides et succès
- [x] Lire todo.md et marquer tous les éléments terminés avant le checkpoint final

## Correctifs et compléments identifiés

- [x] Brancher les actions projet éditer, dupliquer, archiver et journaliser l’historique
- [x] Persister les éléments de métré par projet et les réutiliser dans le DQE
- [x] Étendre le calcul d’acier aux éléments principaux avec résultats et avertissements
- [x] Brancher l’enregistrement réel du DQE à la procédure estimates.create
- [x] Implémenter la transmission réelle des charges entre niveaux et éléments
- [x] Créer un module utilisable de dosage du béton et un module escalier
- [x] Générer des PDF métier alimentés par les données du DQE et de la descente de charges
- [x] Brancher l’ouverture et le partage des rapports depuis l’interface
- [x] Ajouter les tests des validations, erreurs, chaîne de charges, PDF et partage
- [x] Vérifier tous les états de chargement, erreurs, données vides et succès

## Fiabilisation métier à poursuivre

- [x] Remplacer les formules locales par un moteur persistant de dimensionnement et ferraillage par élément
- [x] Ajouter un sélecteur réel dalle pleine / corps creux avec règles de calcul distinctes
- [x] Créer un module escalier autonome avec ses propres entrées, résultats et rapport
- [x] Rendre le schéma technique dynamique et lié aux résultats calculés
- [x] Persister les métrés par projet et alimenter automatiquement les lignes du DQE
- [x] Finaliser l’édition et l’historique daté des projets
- [x] Propager les charges par niveaux et éléments avec un modèle de calcul persistant
- [x] Générer des PDF métier depuis les données réelles du DQE et des calculs
- [x] Ajouter les tests d’intégration des rapports, du partage et des erreurs métier

## Reproduction DSRCAD à partir de la vidéo

- [x] Analyser la vidéo de navigation et relever tous les écrans, menus, champs et actions visibles
- [x] Comparer les parcours DSRCAD avec les fenêtres actuellement disponibles dans GcBtp
- [x] Ajouter les fenêtres DSRCAD manquantes dans la navigation GcBtp
- [x] Reproduire les formulaires et résultats de calcul visibles dans la vidéo
- [x] Reproduire les parcours de rapports, plans, partage et visualisation visibles
- [x] Vérifier la navigation mobile et les états de chaque nouvelle fenêtre
- [x] Ajouter les tests des nouveaux parcours et sauvegarder un checkpoint

## Compléments DSRCAD à fiabiliser

- [x] Remplacer les toasts des modules DSRCAD par des formulaires fonctionnels et résultats détaillés
- [x] Compléter le parcours Bâtiment : projet → plan 2D → vue 3D exploitable → paramètres → calcul/rapport
- [x] Parcourir et vérifier chaque nouvelle fenêtre DSRCAD en responsive avec états de chargement, vide, erreur et succès
- [x] Ajouter des tests ciblés des nouveaux parcours DSRCAD et relancer toute la suite

## Migration Android dédiée inspirée de DSRCAD

- [x] Remplacer le shell desktop/responsive par un viewport mobile Android dédié
- [x] Reproduire la palette DSRCAD turquoise, orange, blanc et noir avec les cartes mobiles correspondantes
- [x] Ajouter une navigation Android par barre inférieure et écrans empilés
- [x] Recomposer l’accueil avec les cartes DSRCAD et les calculs récents
- [x] Recomposer les fenêtres Calculs, Bâtiment, Planning, Rapports, AI Vision et Plus
- [x] Adapter les formulaires de calcul et les résultats à l’usage tactile Android
- [x] Vérifier le rendu sur un viewport Android et les parcours tactiles principaux
- [x] Documenter que la livraison actuelle reste une interface web mobile tant qu’un projet Expo/APK dédié n’est pas initialisé

## Cohérence Android de toutes les fenêtres

- [x] Refondre FeatureWorkspace en écrans Android dédiés pour Calculs, Bâtiment, Planning, Rapports, AI Vision et Plus
- [x] Appliquer la palette et les cartes DSRCAD sur tous les écrans Android
- [x] Adapter réellement les formulaires et résultats au tactile Android avec actions persistantes
- [x] Tester explicitement chaque parcours Android principal en viewport mobile
- [x] Ajouter une note visible indiquant que la version actuelle est une interface mobile web et non un APK Expo natif

## Descente de charges contextualisée par pays

- [x] Ajouter la liste complète des pays africains dans le sélecteur de dimensionnement
- [x] Ajouter la sélection de ville, emplacement ou zone du projet
- [x] Définir la matrice de référentiels proposés par pays et afficher la source ou le statut à confirmer
- [x] Ajouter la sélection du type de structure et des matériaux
- [x] Ajouter les cas de charges : permanentes, exploitation, toiture, vent, séisme et cloisons
- [x] Calculer la chaîne plancher → poutre → poteau → fondation avec résultats intermédiaires
- [x] Générer une note de calcul contextualisée avec hypothèses, unités, combinaisons et avertissements
- [x] Ajouter les tests des pays, normes proposées, cas de charges et scénarios de calcul

## Fiabilisation du moteur de descente de charges

- [x] Ajouter un sélecteur de matériaux ou système porteur et relier ce choix aux hypothèses
- [x] Remplacer les constantes locales par un moteur traçable utilisant pays, emplacement, structure et charges sélectionnées
- [x] Étendre la note PDF avec pays, ville, référentiel, hypothèses, unités, charges, étapes et combinaisons calculées
- [x] Ajouter des tests ciblés des cas de charges, scénarios et résultats intermédiaires

## Contextualisation avancée et note métier

- [x] Ajouter des paramètres contextuels explicites par pays, zone de projet et type de structure
- [x] Faire varier les sorties du moteur lorsque le contexte réglementaire ou structurel change
- [x] Inclure Gk, Qk, γG, γQ, surface, épaisseur et matériau dans le contenu PDF
- [x] Supprimer les champs génériques volume/moment/acier des notes dédiées à la descente de charges
- [x] Ajouter des tests prouvant l’effet du pays, de la zone et du type de structure sur les résultats

## Derniers contrôles de la note de descente

- [x] Ajouter des tests Vitest montrant l’effet du pays, de la ville et du type de structure sur les sorties
- [x] Adapter la génération PDF pour exclure volume, moment et acier des notes de descente de charges
- [x] Tester la présence des hypothèses Gk, Qk, γG, γQ, surface, épaisseur et matériau dans la note

## Tests finaux du contexte et de la note

- [x] Tester l’effet d’une ville réellement paramétrée, par exemple Abidjan versus Dakar ou Cape Town
- [x] Tester la présence de Gk, Qk, γG, γQ, surface tributaire, épaisseur dalle et matériau dans le contenu de note
- [x] Tester l’absence de Volume, Moment et Acier indicatif dans une note de descente de charges

## Sol et fondations

- [x] Ajouter les profils de sol avec valeurs par défaut provisoires et statut à confirmer
- [x] Ajouter la contrainte admissible ou résistance de calcul du sol
- [x] Ajouter la profondeur d’assise, le niveau de nappe et le coefficient de sécurité
- [x] Ajouter le choix de fondation : semelle isolée, filante, radier ou pieux
- [x] Calculer la surface minimale de fondation et les dimensions préliminaires
- [x] Calculer la pression moyenne sous fondation et vérifier le dépassement de la contrainte admissible
- [x] Ajouter les résultats sol-fondation dans la chaîne de descente de charges et la note PDF
- [x] Ajouter les tests des profils de sol, types de fondation et cas de dépassement

## Paramétrage qadm

- [x] Relier le champ qadm saisi au moteur avec validation de la valeur
- [x] Ajouter un test montrant que qadm modifie la surface, la pression et le statut de fondation

## Parcours création bâtiment selon vidéo

- [x] Écouter et relever les étapes et champs de la vidéo de création bâtiment
- [x] Faire ouvrir la carte Bâtiment sur une fenêtre de création dédiée
- [x] Ajouter le nom du bâtiment et les détails visibles dans la vidéo
- [x] Ajouter la validation et la transition vers l’espace bâtiment
- [x] Préserver les données saisies dans les paramètres et la vue bâtiment
- [x] Tester le parcours tactile, les validations et les retours arrière

## Écarts à corriger avant livraison du parcours Bâtiment

- [x] Documenter les éléments audio non exploitables et confirmer le parcours par examen visuel des frames
- [x] Vérifier et brancher explicitement la carte d’entrée Bâtiment vers BuildingCreateFlow
- [x] Compléter les menus et paramètres visibles : duplication de niveau, grille, éléments et visualisation
- [x] Persister le bâtiment et ses paramètres au minimum pendant la session et tester la réouverture
- [x] Ajouter une vérification interactive du dialogue, du nom obligatoire et du retour arrière

## Dernières corrections du parcours Bâtiment

- [x] Restaurer tous les paramètres sauvegardés depuis sessionStorage : niveau, hauteur, aimantation, noms, sens des charges, norme et pays
- [x] Ajouter les réglages visibles supplémentaires : continuité BAEL, rayon d’aimantation, pied de page PDF, opacité des planchers et visualisation
- [x] Ajouter une vérification structurée du parcours : carte Bâtiment, nom obligatoire, Annuler, Créer, retour et réouverture

## Vérification explicite du parcours Bâtiment

- [x] Documenter une vérification manuelle structurée : clic carte Bâtiment, nom vide, Annuler, Créer, retour arrière et réouverture avec paramètres restaurés

## Test automatisé du parcours Bâtiment

- [x] Ajouter une machine d’état testable du parcours Bâtiment couvrant ouverture, nom vide, Annuler, Créer, retour et réouverture
- [x] Vérifier automatiquement la restauration de tous les paramètres sauvegardés

## Refonte détaillée du parcours Bâtiment

- [x] Afficher les projets enregistrés après clic sur la carte Bâtiment
- [x] Ajouter le bouton Nouveau projet et le formulaire de nom obligatoire
- [x] Ouvrir l’espace projet après validation avec sauvegarde, 3D et menu séparé
- [x] Ajouter le menu complet : grille de trame, mes modèles, éléments du niveau, duplication, paramètres et sixième action définie
- [x] Remplacer les niveaux par Fondation, RDC et Ajouter un niveau avec onglets R+1 visibles
- [x] Rendre les niveaux cliquables et permettre ajout, modification et suppression d’éléments
- [x] Rendre la grille de trame interactive selon X, Y et Z
- [x] Ajouter le placement d’éléments avec sélection semelle, poteau, poutre et dalle
- [x] Ajouter les sections des éléments et les types de planchers corps creux ou dalle pleine
- [x] Ouvrir les paramètres dans une fenêtre séparée avec pays, ville, emplacement, structure, normes et charges
- [x] Déduire les paramètres de sol à partir de l’emplacement avec statut provisoire à confirmer
- [x] Ajouter une fenêtre séparée pour chaque action secondaire du menu
- [x] Ajouter la persistance des projets, niveaux, éléments et paramètres
- [x] Tester le parcours complet sur Android et les interactions de la grille

## Compléments fonctionnels du parcours Bâtiment

- [x] Ajouter l’édition réelle des éléments placés : type, section, position et niveau
- [x] Permettre la modification et suppression des axes X/Y et des altitudes Z existants
- [x] Déduire une proposition de sol, qadm et nappe selon pays, ville et emplacement avec statut provisoire
- [x] Persister les charges, la grille, les axes, les distances et les réglages de visualisation
- [x] Documenter un test structuré du parcours Android Bâtiment et des interactions de grille

## Tests métier de la refonte Bâtiment

- [x] Tester la proposition de sol selon Abidjan, Dakar et une localisation inconnue
- [x] Tester la modification, suppression et persistance d’un élément de niveau
- [x] Documenter les actions vérifiées de la grille X/Y/Z et des fenêtres séparées

## Derniers correctifs avant checkpoint

- [x] Ajouter un niveau cible dans l’éditeur d’élément et permettre son déplacement entre niveaux
- [x] Persister et restaurer la vue 2D/3D et les préférences visuelles du bâtiment
- [x] Ajouter des tests ciblés de modification, suppression et persistance d’un élément avec son niveau

## Tests finaux éléments et préférences visuelles

- [x] Ajouter des tests Vitest pour updateElement, removeElement et moveElement avec changement de niveau
- [x] Tester la sérialisation/restauration des éléments dans les données d’un projet
- [x] Étendre et documenter la persistance des préférences visuelles : vue 2D/3D, affichage des noms, opacité et aimantation

## Dernière preuve de persistance

- [x] Tester la sérialisation/restauration d’un projet contenant plusieurs niveaux et éléments
- [x] Documenter explicitement la restauration de la vue 2D/3D, des noms, de l’opacité et de l’aimantation

## Preuve complète de persistance projet

- [x] Tester plusieurs niveaux et plusieurs éléments répartis sur chaque niveau avec restauration intégrale après sérialisation
- [x] Vérifier l’intégrité des types, sections, positions, niveaux, paramètres de grille et charges restaurés

## Configuration détaillée des planchers

- [x] Ajouter le choix entre plancher à corps creux et dalle pleine
- [x] Ajouter les épaisseurs disponibles et une épaisseur personnalisée validée
- [x] Ajouter les paramètres propres aux corps creux : entrevous, dalle de compression, nervures et portée indicative
- [x] Ajouter les paramètres propres à la dalle pleine : épaisseur, portée et sens de portée
- [x] Persister la configuration du plancher par projet et par niveau
- [x] Afficher la configuration dans les éléments du niveau et la note de calcul
- [x] Ajouter les tests des variantes, épaisseurs et restauration de configuration

## Tests de configuration des planchers

- [x] Tester les préréglages corps creux et dalle pleine
- [x] Tester les épaisseurs personnalisées et les paramètres associés
- [x] Tester la restauration de la configuration du plancher depuis la session

## Correctifs planchers avant checkpoint

- [x] Stabiliser le mode d’épaisseur personnalisée sans écraser la valeur saisie
- [x] Tester les paramètres corps creux : entrevous, dalle de compression, nervures et portée
- [x] Tester la dalle pleine avec épaisseur personnalisée
- [x] Tester explicitement la persistance et la restauration de floorConfig depuis gcbtp-building-config

## Fiabilisation finale des planchers

- [x] Valider l’épaisseur personnalisée avec format, valeur obligatoire et bornes cohérentes
- [x] Rattacher floorConfig au projet et au niveau actif avec restauration au changement
- [x] Stocker la configuration détaillée sur chaque élément Dalle
- [x] Afficher la configuration dans la liste des éléments du niveau et la note générée
- [x] Ajouter les tests de validation, persistance par projet/niveau et contenu de note

## Refonte grille de trame DSRCAD — placement géométrique

- [x] Numéroter les axes indépendamment suivant X, Y et Z avec repères visibles
- [x] Placer semelles et poteaux uniquement sur les intersections exactes des axes
- [x] Placer une poutre par sélection successive du poteau de départ et du poteau d’arrivée
- [x] Placer une dalle par sélection de deux coins et calculer son rectangle de trame
- [x] Rendre les poteaux en carrés pleins colorés selon la section choisie
- [x] Rendre les semelles en rectangles plus grands non pleins
- [x] Rendre les poutres en barres reliant les poteaux et les dalles en surfaces quadrillées avec flèche de portée
- [x] Supprimer les boutons Vue 2D et Vue 3D sous la grille et agrandir la zone de travail
- [x] Permettre le déplacement tactile fluide de la grille et de ses axes dans la zone de travail
- [x] Ajouter les tests des interactions de placement et des géométries de grille

## Améliorations grille DSRCAD — déplacement, accrochage et calcul

- [x] Permettre le déplacement direct des poteaux, semelles, poutres et dalles par glissement tactile
- [x] Afficher un aperçu d’accrochage des extrémités de poutre sur les poteaux avant validation
- [x] Relier les dalles à leur portée, sens de portée et chaîne de descente de charges
- [x] Ajouter les tests du déplacement, de l’accrochage et de la liaison dalle-calcul

## Améliorations grille DSRCAD — charges, historique et 3D

- [x] Afficher les charges détaillées de chaque dalle, poutre, poteau et semelle dans les éléments du niveau
- [x] Ajouter annulation et rétablissement des déplacements tactiles
- [x] Générer une vue 3D basée sur les coordonnées, sections et géométries réellement placées
- [x] Ajouter les tests des charges visibles, de l’historique et de la projection 3D

## Export PDF détaillé de descente de charges

- [x] Ajouter un bouton dédié d’export PDF dans le panneau de descente de charges
- [x] Générer un rapport détaillé avec contexte, hypothèses, charges, résultats intermédiaires et avertissements
- [x] Inclure les données de planchers, éléments et fondations dans le rapport exporté
- [x] Ajouter les tests du contenu et du déclenchement de l’export PDF

## Paramètres de grille DSRCAD — axes X, Y et Z

- [x] Reproduire l’en-tête mobile « Grille de trame » avec retour et onglets Axe X, Axe Y, Axe Z
- [x] Ajouter le choix du libellé de numérotation de l’axe X : 1, 2, 3…
- [x] Ajouter le choix du libellé de numérotation de l’axe Y : A, B, C…
- [x] Afficher les lignes X et Y sous forme de cartes avec position, portée, édition, suppression et insertion intermédiaire
- [x] Ajouter la gestion de l’axe Z par niveaux avec altitude, hauteur, nombre d’éléments, édition et suppression
- [x] Ajouter les boutons violets « Ajouter une ligne » et « Ajouter un niveau » avec le style des captures
- [x] Recalculer automatiquement les positions, portées et géométries après modification des axes
- [x] Ajouter les tests des onglets, des insertions, des suppressions et de la gestion des niveaux

## Correctifs grille DSRCAD — distances et typographie

- [x] Conserver les libellés des axes X et Y fixes lors de l’édition
- [x] Éditer la distance en mètres entre les lignes X et Y, avec recalcul des positions
- [x] Éditer la hauteur ou l’écart en mètres des niveaux Z sans modifier leur libellé fixe
- [x] Réduire les tailles de texte, cartes, boutons et espacements pour correspondre aux captures
- [x] Ajouter les tests des distances éditables et des libellés invariants

## Onglet Mes modèles DSRCAD

- [x] Reproduire la présentation mobile des familles de modèles selon les captures
- [x] Ajouter les modèles de semelles, poteaux, poutres et dalles avec sections détaillées
- [x] Ajouter une couleur distincte par section ou modèle et l’afficher dans les cartes
- [x] Propager la couleur du modèle sélectionné sur les éléments placés dans la grille
- [x] Conserver les couleurs dans les éléments, la vue 3D et les projets restaurés
- [x] Ajouter les tests du catalogue, des couleurs et du placement coloré

## Légende des couleurs des modèles

- [x] Afficher sur la grille les modèles réellement utilisés avec pastille, nom et section
- [x] Maintenir une légende lisible sur mobile sans masquer les éléments placés
- [x] Ajouter la même légende au rapport PDF de descente de charges
- [x] Ajouter les tests de génération de légende et de contenu PDF

## Corrections Mes modèles et modèle actif

- [x] Ouvrir une fenêtre d’édition au clic sur une carte pour modifier section et couleur
- [x] Faire du bouton Nouveau modèle un sélecteur de famille puis ouvrir le formulaire concerné
- [x] Réduire la typographie et les espacements de l’onglet selon les captures
- [x] Afficher sous la grille le modèle actif avec couleur et section dans les deux sélecteurs
- [x] Ajouter les tests d’édition, de création et de synchronisation du modèle actif

## Palette couleurs et placement grille

- [x] Ajouter une palette de couleurs automatique et sélectionnable dans les fenêtres de création et modification
- [x] Propager la couleur choisie aux modèles, éléments placés, grille, vue 3D et légende
- [x] Réparer le clic de placement des poteaux et semelles sur les intersections de grille
- [x] Réparer le placement séquentiel des poutres entre deux poteaux existants
- [x] Réparer le placement rectangulaire des dalles par deux points
- [x] Ajouter les tests de palette et de placement fonctionnel

## Correctif ReferenceError placement grille

- [x] Reproduire l’erreur ReferenceError au placement d’un élément
- [x] Corriger le cycle d’initialisation dans le rendu ou le handler de grille
- [x] Vérifier le placement des poteaux, semelles, poutres et dalles après correction
- [x] Ajouter un test de régression et publier le correctif

## Placement direct et rendus DSRCAD

- [x] Déclencher le placement directement au clic sur une intersection selon le type et la section choisis sous la grille
- [x] Afficher un mode poutre avec premier et second point, sans fenêtre de sélection
- [x] Afficher un mode dalle avec deux coins, sans fenêtre de sélection
- [x] Reproduire les tailles 2D visibles des poteaux, poutres, semelles et planchers
- [x] Reproduire la vue 3D avec niveaux, couleurs, transparence des dalles, zoom et navigation
- [x] Ajouter les tests de placement direct et de géométrie 2D/3D

## Correctif placement sans fenêtre et vue 3D DSRCAD

- [x] Supprimer toute fenêtre intermédiaire lors du clic de placement
- [x] Réparer le changement de mode et le placement des poutres, semelles et dalles
- [x] Ajouter l’état visuel du premier et second point pour les éléments séquentiels
- [x] Reproduire la perspective 3D DSRCAD avec plans, niveaux, couleurs et éléments visibles
- [x] Ajouter navigation tactile, zoom, recentrage et légende cohérente dans la vue 3D
- [x] Ajouter les tests de placement multi-types et de projection 3D

## Rotation 3D interactive

- [x] Ajouter la rotation horizontale et verticale par glissement de souris ou doigt
- [x] Conserver le zoom et le recentrage pendant la rotation
- [x] Ajouter un indicateur visuel de rotation et un retour à la vue initiale
- [x] Ajouter les tests de l’état de rotation et de ses limites

## Vue 3D — hiérarchie verticale DSRCAD

- [x] Utiliser l’altitude et la hauteur réelles de chaque niveau dans la projection
- [x] Maintenir les semelles sous les fondations et les poteaux au niveau fondation
- [x] Rattacher les poutres aux poteaux du même niveau
- [x] Poser les dalles au-dessus du système poteaux-poutres du niveau
- [x] Ajouter les tests de hiérarchie verticale et de projection par niveau

## Audit comparatif DSRCAD — module Bâtiment

- [x] Visiter la référence DSRCAD et documenter le parcours Bâtiment, le tracé, les niveaux, les éléments, les charges et la vue 3D
- [x] Comparer chaque étape avec la version GcBtp actuelle et consigner les écarts
- [x] Corriger les écarts prioritaires d’interaction et de rendu identifiés
- [x] Tester les parcours complets et la cohérence des calculs après comparaison

## Correctifs placement combiné, poutres et dalles

- [x] Autoriser une semelle et un poteau sur la même intersection sans remplacement ni blocage
- [x] Tracer une poutre par glissement du point de départ au point d’arrivée avec barre horizontale accrochée
- [x] Détecter automatiquement l’espace rectangulaire fermé par quatre poteaux pour placer une dalle sans débordement
- [x] Orienter automatiquement les nervures de dalle selon la plus petite portée
- [x] Supprimer toute fenêtre intermédiaire résiduelle pour semelle, poteau, poutre et dalle
- [x] Ajouter les tests de régression des quatre parcours de placement

## Aperçus de placement et tests Android

- [x] Afficher une poutre fantôme pendant le glissement entre le poteau de départ et le point courant
- [x] Afficher le rectangle de dalle détecté, sa portée et son sens de nervures avant validation
- [x] Ajouter des tests tactiles du placement direct, du glissement poutre et de la détection dalle

## Mode Semelles — rendu 2D et vue 3D DSRCAD

- [x] Reproduire les semelles carrées violettes avec diagonales internes et repères S1, S2, S3, S4
- [x] Conserver les cotes de trame et les positions exactes aux intersections
- [x] Reproduire l’extrusion 3D violette des semelles avec axes en perspective
- [x] Ajouter la main de déplacement, le zoom +/−, le cercle de recentrage et la légende S1
- [x] Ajouter les tests de rendu et de navigation du mode Semelles

## Repères poteaux/semelles et continuité structurelle

- [x] Numéroter les semelles selon l’ordre de pose S1, S2, S3… en 2D et 3D
- [x] Numéroter les poteaux selon l’ordre de pose P1, P2, P3… en 2D et 3D
- [x] Réduire de moitié le carré 2D des poteaux
- [x] Rendre le volume 3D des semelles plein et rattacher visuellement les poteaux de fondation
- [x] Décaler automatiquement les libellés P et S pour éviter les collisions avec les rectangles
- [x] Ajouter les tests de nomenclature, taille et continuité semelle-poteau

## Correctifs semelles et navigation 3D

- [x] Renuméroter les semelles existantes et nouvelles selon leur ordre de pose S1, S2, S3… sans saut
- [x] Rendre l’encastrement poteau-semelle explicite par une liaison verticale continue en 3D
- [x] Rendre la rotation 3D fluide sur les axes horizontal et vertical dans toutes les directions
- [x] Ajouter les tests de séquence, d’encastrement et de rotation multi-directionnelle

## Rotation inertielle 3D

- [x] Ajouter une inertie après le relâchement de la souris avec décélération progressive
- [x] Interrompre proprement l’inertie dès le début d’un nouveau glissement ou d’un recentrage
- [x] Respecter les limites d’inclinaison et la réduction de mouvement système
- [x] Ajouter les tests de rotation inertielle et publier la correction

## Placement des poutres entre deux points

- [x] Afficher un sélecteur rouge sur le point de départ choisi pour une poutre
- [x] Tracer automatiquement la poutre entre le point de départ et le point d’arrivée, y compris entre deux axes
- [x] Autoriser l’accrochage aux extrémités supérieures des poteaux du niveau actif
- [x] Ajouter les tests de placement, d’aperçu et de rattachement altimétrique des poutres

## Correction du placement libre des poutres

- [x] Supprimer toute fenêtre intermédiaire lors du premier clic d’une poutre
- [x] Conserver uniquement le sélecteur rouge au premier point choisi
- [x] Autoriser le tracé et l’enregistrement d’une poutre entre deux intersections, sans poteaux obligatoires
- [x] Ajouter les tests de clic direct, d’aperçu et de poutre entre axes libres

## Placement direct des dalles par rectangle

- [x] Afficher un curseur rouge sur le premier coin choisi d’une dalle
- [x] Afficher l’aperçu du rectangle entre le premier coin et le coin opposé
- [x] Créer automatiquement la dalle au second clic sans fenêtre intermédiaire
- [x] Ajouter les tests de sélection des coins et de création rectangulaire

## Correctifs dalle et nomenclature des semelles

- [x] Supprimer toute fenêtre intermédiaire au premier clic d’une dalle et afficher directement le curseur rouge
- [x] Corriger la numérotation des semelles pour produire S1, S2, S3… par unité successive
- [x] Ajouter les tests de clic direct sur dalle et de renumérotation après ajout ou suppression

## Correctifs finaux des dalles

- [x] Réinitialiser complètement le premier coin après la création d’une dalle
- [x] Supprimer le curseur et l’aperçu résiduels après le second clic
- [x] Contraindre le rendu de la dalle au rectangle exact sélectionné, sans débordement
- [x] Ajouter les tests du cycle complet et des limites de surface de dalle

## Gestion des éléments depuis le modèle actif

- [x] Ajouter une entrée de sous-menu pour sélectionner un élément existant
- [x] Afficher les propriétés d’une dalle, poutre, poteau ou semelle sélectionnée
- [x] Permettre la suppression contrôlée de l’élément sélectionné en cas d’erreur
- [x] Ajouter les tests de sélection, propriétés et suppression pour les quatre familles

## Grille, navigation 3D et cohérence structurelle

- [x] Afficher les valeurs d’entraxe entre les axes X et Y de la grille
- [x] Séparer le mode Main pour déplacer la scène du mode Curseur pour une rotation 3D complète
- [x] Permettre une rotation 3D complète au-dessus, en dessous et sur tous les côtés
- [x] Garantir l’accrochage exact des poutres, semelles, poteaux et dalles aux points cliqués sans débordement
- [x] Renuméroter automatiquement chaque famille après suppression d’un élément
- [x] Faire respecter aux poteaux la hauteur du niveau auquel ils appartiennent
- [x] Ajouter les tests de grille, navigation 3D, accrochage, renumérotation et hauteur des poteaux

## Continuité verticale et navigation 3D inspirée de RSA

- [x] Comparer la capture utilisateur avec les principes publics de modélisation et navigation Autodesk RSA
- [x] Raccorder visuellement semelles et poteaux de fondation
- [x] Raccorder les poteaux de fondation au RDC et le RDC aux niveaux supérieurs
- [x] Aligner poutres et dalles sur les sommets réels des poteaux de chaque niveau
- [x] Améliorer la fluidité du pan, de la rotation complète et du recentrage 3D
- [x] Ajouter les tests de continuité verticale et de navigation 3D

## Vue 3D compacte, duplication et nomenclature globale

- [x] Supprimer les textes d’en-tête de la vue 3D
- [x] Réduire de moitié les boutons et les placer dans le coin inférieur droit
- [x] Réduire de moitié la légende et la placer dans le coin inférieur gauche
- [x] Supprimer le bouton inférieur de recentrage non fonctionnel
- [x] Afficher les hauteurs cumulées des niveaux : Fondation 0 m, RDC H, R+1 H+H…
- [x] Rendre la duplication d’un niveau vers un autre fonctionnelle
- [x] Rendre les semelles compactes en une entité pleine sans vide intérieur ni latéral
- [x] Unifier les nomenclatures globales S, P, B et PL en commençant à 1
- [x] Restaurer automatiquement les nomenclatures après suppression et poursuivre la séquence après copie inter-niveaux
- [x] Ajouter les tests de vue 3D, duplication, géométrie des semelles et nomenclature globale

## Nomenclature des semelles et sélection 3D

- [x] Unifier les identifiants de semelles affichés en 2D, 3D et dans la liste des éléments
- [x] Garantir une séquence S1, S2, S3… sans doublon ni saut après restauration ou copie
- [x] Permettre la sélection directe d’un poteau, poutre, dalle ou semelle dans la vue 3D
- [x] Ouvrir les propriétés de l’élément sélectionné depuis la vue 3D
- [x] Permettre la suppression de l’élément sélectionné depuis la vue 3D
- [x] Ajouter les tests de nomenclature cohérente et d’interaction 3D

## Blocage des superpositions similaires

- [x] Refuser une semelle sur une semelle au même emplacement et niveau
- [x] Refuser un poteau sur un poteau au même emplacement et niveau
- [x] Refuser une poutre sur une poutre avec les mêmes extrémités et niveau
- [x] Refuser une dalle sur une dalle avec le même rectangle et niveau
- [x] Afficher une notification explicite lors du rejet
- [x] Ajouter les tests de validation des quatre familles d’éléments

## Libellés, sauvegarde et barre d’actions

- [x] Centrer la nomenclature des dalles au milieu de leur surface
- [x] Centrer la nomenclature des poutres sur leur barre
- [x] Rendre le bouton Sauvegarder fonctionnel et persistant
- [x] Descendre la légende 3D au niveau du bouton de zoom arrière
- [x] Remplacer Annuler/Rétablir par Retour, Avance et Lancer les calculs sur une même ligne
- [x] Ajouter les tests des libellés, de la sauvegarde et de la barre d’actions

## États des boutons d’historique

- [x] Griser et désactiver Retour lorsque l’historique précédent est vide
- [x] Griser et désactiver Avance lorsque l’historique futur est vide
- [x] Ajouter les tests de disponibilité et de rendu des deux boutons

## Grille proportionnelle selon les distances

- [x] Calculer les positions cumulées des axes X selon leurs entraxes
- [x] Calculer les positions cumulées des axes Y selon leurs entraxes
- [x] Rendre le cadre et les éléments proportionnels aux distances saisies
- [x] Préserver l’accrochage et le placement sur les intersections adaptées
- [x] Ajouter les tests de géométrie proportionnelle et vérifier le rendu Android

## Grille agrandie et navigation ciblée

- [x] Agrandir la géométrie de la grille pour occuper le champ de navigation
- [x] Permettre le déplacement panoramique de la grille sans perturber le placement
- [x] Ajouter un zoom progressif centré sur la zone touchée
- [x] Conserver l’accrochage et la sélection des éléments après zoom/pan
- [x] Ajouter les tests de navigation et vérifier le rendu Android

## Reproduction du cadrage de grille

- [x] Recentrer la grille dans le champ avec une emprise proche de la deuxième référence
- [x] Agrandir les axes et leurs entraxes pour éviter le rendu minuscule
- [x] Maintenir la lisibilité des libellés X/Y et des distances non uniformes
- [x] Préserver le pan, le zoom et l’accrochage après recadrage
- [x] Vérifier le rendu Android et ajouter les tests associés

## Cotations des axes ajoutés

- [x] Étendre automatiquement les distances X lors de l’ajout d’un axe X
- [x] Étendre automatiquement les distances Y lors de l’ajout d’un axe Y
- [x] Afficher la cotation de chaque intervalle entre axes existants et ajoutés
- [x] Ajouter les tests de cotation après ajout d’axes

## Suppression d’axes sans perte d’éléments

- [x] Renuméroter automatiquement les axes X restants après suppression
- [x] Renuméroter automatiquement les axes Y restants après suppression
- [x] Ajuster les listes d’entraxes après suppression sans perdre les valeurs restantes
- [x] Conserver les éléments placés sur l’axe supprimé sans les supprimer ni les déplacer
- [x] Ajouter les tests de suppression d’axe et de conservation des éléments

## Confirmation de suppression d’axe

- [x] Ouvrir une boîte de dialogue avant toute suppression d’axe X ou Y
- [x] Expliquer que les éléments sont conservés mais que la trame et les cotations changent
- [x] Permettre l’annulation ou la confirmation explicite de la suppression
- [x] Ajouter les tests des deux parcours : annuler et confirmer

## Descente de charges professionnelle contextualisée

- [x] Définir le périmètre initial, les hypothèses et les normes prioritaires
- [x] Intégrer le contexte pays, ville, localisation, altitude et type de bâtiment
- [x] Intégrer le profil de sol, qadm, nappe, profondeur d’assise et classe sismique
- [x] Ajouter les charges permanentes, d’exploitation, cloisons, équipements et poids propre
- [x] Intégrer les escaliers, marches, paillasses, paliers et réactions d’appui
- [x] Déterminer automatiquement l’applicabilité du vent, de la neige et du séisme
- [x] Ajouter les combinaisons réglementaires et leur traçabilité
- [x] Propager les charges par surfaces tributaires jusqu’aux fondations
- [x] Ajouter les vérifications indicatives des éléments et du sol
- [x] Générer une synthèse par élément et une note PDF complète
- [x] Ajouter des cas de référence, tests de non-régression et avertissements professionnels

## Améliorations de la descente de charges reliée au bâtiment
- [x] Relier la propagation aux éléments réels du modèle bâtiment et produire une synthèse par élément
- [x] Ajouter les paliers d’escalier et leurs réactions d’appui dans la chaîne de charges
- [x] Structurer les paramètres réglementaires locaux par pays avec provenance, zone et statut de validation
- [x] Ajouter les tests et vérifier le rendu Android des nouvelles interactions

## Correction du lancement de descente de charges
- [x] Remplacer le panneau intermédiaire par un calcul direct de la structure modélisée
- [x] Afficher les charges par niveau et par élément avec les avertissements de liaison
- [x] Ajouter les tests du bouton de calcul et de l’affichage des résultats

## Export PDF sans authentification en phase de construction
- [x] Générer et télécharger localement le rapport PDF sans exiger de connexion
- [x] Conserver l’enregistrement distant comme option future lorsque l’authentification sera activée
- [x] Tester l’export direct et vérifier le rendu Android

## Correction Synthèse et PDF de descente de charges
- [x] Afficher la synthèse G/Q/Nu/Nser par élément réel après lancement
- [x] Générer un PDF valide, non vide et ouvrable sur Android
- [x] Tester le parcours de synthèse, l’export et le téléchargement

## Recalibrage DSRCAD et cumul multi-niveaux
- [x] Revoir la distribution des charges selon les surfaces tributaires et les combinaisons G/Q
- [x] Cumuler les charges verticalement de tous les niveaux jusqu’aux fondations
- [x] Afficher les totaux par niveau et produire le rapport multi-niveaux

## Catalogue complet de charges et cheminement DSRCAD
- [x] Définir un catalogue paramétrable des charges permanentes, variables et climatiques
- [x] Intégrer les charges propres exactes, murs, cloisons, finitions, plafonds et équipements
- [x] Ajouter les charges d’exploitation par usage, toiture, vent, neige et séisme avec combinaisons
- [x] Afficher le cheminement graphique des charges et enrichir le rapport multi-niveaux
- [x] Ajouter les tests de non-régression et vérifier le rendu Android

## Audit comparatif DSRCAD/RSA et correction normative
- [x] Établir un cas test identique avec géométrie, matériaux, charges et niveaux explicités
- [x] Auditer les unités, poids propres, surfaces tributaires et charges par élément
- [x] Corriger les cas de charges, coefficients et combinaisons ELU/ELS selon le référentiel choisi
- [x] Vérifier le cumul multi-niveaux et la cohérence DSRCAD/RSA des résultats
- [x] Ajouter des tests comparatifs et documenter les hypothèses restantes

## Paramètres projet et profils pays automatiques
- [x] Limiter la liste aux pays demandés avec Sénégal par défaut
- [x] Créer les profils automatiques Sénégal, Mauritanie, Mali et Gambie
- [x] Rendre le catalogue de charges accessible dans Paramètres du projet
- [x] Appliquer automatiquement norme, hypothèses, charges climatiques et avertissements au changement de pays
- [x] Ajouter les tests du changement de pays et vérifier le rendu Android

## Profils climatiques par ville
- [x] Ajouter les principales villes des quatre pays dans un catalogue dépendant du pays
- [x] Associer à chaque ville les paramètres vent, pluie/neige, séisme et provenance
- [x] Actualiser automatiquement les paramètres du projet et le calcul au changement de ville
- [x] Ajouter les tests de sélection ville-pays et vérifier le rendu Android

## Correction du raccordement des charges aux éléments
- [x] Reproduire le cas test à quatre poteaux, quatre poutres et quatre semelles
- [x] Corriger la perte des charges de plancher et le rattachement erroné des niveaux
- [x] Afficher des charges non nulles et cohérentes par élément et par niveau
- [x] Ajouter un contrôle d’équilibre charges appliquées / réactions et tester le PDF

## Reprise de conformité du calcul DSRCAD
- [x] Établir un cas de référence complètement paramétré et comparable
- [x] Tracer les charges appliquées, réactions et cumuls à chaque niveau
- [x] Corriger les écarts démontrés de formules, unités ou liaisons
- [x] Afficher les contrôles d’équilibre et la traçabilité dans la synthèse et le PDF
- [x] Ajouter les tests de référence et vérifier avant toute publication

## Correction poids propre poutres de fondation
- [x] Reproduire une poutre 20×40 de 4 m et obtenir G = 8,00 kN
- [x] Corriger la conversion des coordonnées et de la section dans tous les chemins de calcul
- [x] Corriger la synthèse et le PDF pour afficher la même valeur
- [x] Ajouter le test numérique et vérifier le parcours Android

## Correction du calcul avec dalle ajoutée
- [x] Reproduire une dalle rectangulaire avec sa configuration de plancher réelle
- [x] Corriger le poids propre surfacique et les charges permanentes/variables de la dalle
- [x] Corriger la distribution par portée vers les poutres limites sans double comptage
- [x] Vérifier le cumul dalle–poutre–poteau–semelle et ajouter des tests numériques

## Alignement exact GcBtp / DSRCAD pour la dalle
- [x] Décomposer l’écart de 7,4 kN entre GcBtp et DSRCAD
- [x] Aligner les charges surfaciques et les hypothèses du plancher sur le cas DSRCAD
- [x] Propager le G corrigé aux poutres, poteaux, semelles et au PDF
- [x] Ajouter un test de référence garantissant G = 93,4 kN
- [x] Ajouter les champs G caractéristique et Q caractéristique du plancher, avec 5,84 et 1,50 kN/m² comme profil DSRCAD de référence

## Différenciation automatique des planchers
- [x] Recalculer G/Q lorsque le type passe de corps creux 16+4 à dalle pleine 20 cm
- [x] Désactiver les charges caractéristiques héritées lorsqu’elles ne correspondent plus à la nature du plancher
- [x] Propager le nouveau poids propre vers poutres, poteaux et semelles
- [x] Ajouter les tests comparatifs 16+4 et dalle pleine 20 cm et vérifier Android

## Synchronisation Mes modèles et éléments du niveau
- [x] Faire apparaître les éléments créés depuis Mes modèles dans la liste du niveau
- [x] Utiliser ces éléments dans la modélisation et la descente de charges
- [x] Retirer immédiatement de la liste les éléments supprimés
- [x] Réduire la typographie et améliorer l’affichage Android de Mes modèles
- [x] Ajouter les tests de création, suppression et synchronisation

## Correction visibilité des modèles personnalisés
- [x] Utiliser une source unique persistante pour Mes modèles et la liste de placement
- [x] Afficher les nouveaux modèles après création et après réouverture du panneau
- [x] Permettre leur sélection et leur placement effectif sur la grille
- [x] Ajouter un test de régression pour catalogue, sélecteur et placement

## Correction dimensionnement dalle pleine existante
- [x] Reproduire le remplacement d’une dalle corps creux par une dalle pleine 20 cm
- [x] Enregistrer le nouveau type et la section sur la dalle existante
- [x] Recalculer le poids propre et les charges de dimensionnement
- [x] Propager les nouvelles charges et vérifier synthèse/PDF

## Correction définitive Mes modèles et édition des éléments
- [x] Diagnostiquer la source réelle de persistance et le rendu du catalogue personnalisé
- [x] Rendre les modèles ajoutés visibles dans Mes modèles et dans tous les sélecteurs
- [x] Rendre le clic sur un élément existant ouvrable en édition depuis grille et liste
- [x] Rendre la modification et la suppression réactives avec renumérotation
- [x] Ajouter les tests de régression et vérifier le parcours Android

## Fluidification et reconnaissance du placement tactile
- [x] Stabiliser la conversion des coordonnées tactiles vers la grille et l’accrochage au point réellement touché
- [x] Fiabiliser la sélection du premier et du second point pour les poutres
- [x] Fiabiliser la sélection des coins et la reconnaissance du rectangle pour les dalles
- [x] Rendre les prévisualisations et marqueurs de placement nets, sans décalage ni sélection parasite
- [x] Ajouter les tests de régression du placement tactile et vérifier le rendu Android

## Placement direct sans fenêtre intermédiaire
- [x] Identifier l’ouverture résiduelle du panneau pendant la pose des éléments
- [x] Placer directement poteaux, semelles et éléments ponctuels au toucher sur la grille
- [x] Conserver uniquement le second point nécessaire aux poutres et dalles, sans panneau intermédiaire
- [x] Tester le placement tactile après sélection du modèle actif et vérifier le rendu Android

## Cohabitation de tous les éléments sur un nœud
- [x] Identifier la validation qui bloque une semelle lorsqu’un poteau existe déjà au même nœud
- [x] Autoriser semelle, poteau et autres familles compatibles sur le même point
- [x] Refuser uniquement le doublon d’une même famille au même emplacement
- [x] Ajouter les tests de pose dans les deux ordres et vérifier Android

## Dalle pleine : calcul sans nervures et symbole en crois
- [x] Vérifier que la dalle pleine n’utilise aucune direction de nervures dans les charges
- [x] Conserver une direction uniquement pour les planchers à corps creux
- [x] Afficher les deux diagonales du rectangle pour une dalle pleine
- [x] Ajouter les tests de calcul et de représentation de la dalle pleine

## Analyse visuelle, valeurs et rapport PDF
- [x] Identifier le poteau et la semelle les plus chargés après calcul
- [x] Ajouter l’affichage activable des valeurs G/Q/Nu/Nser et moments sur la vue 2D/3D
- [x] Colorer en rouge vif les éléments les plus chargés en 2D, 3D et dans le rapport
- [x] Ajouter les options de visualisation d’analyse structurelle disponibles dans le projet
- [x] Recomposer le PDF avec les mêmes marges, tableaux et espacements que l’aperçu
- [x] Ajouter les tests et vérifier le rendu Android et le rapport exporté

## Échelle progressive des charges
- [x] Calculer la normalisation des charges Nu des poteaux et semelles
- [x] Appliquer un dégradé de couleurs cohérent en 2D et 3D avec rouge vif au maximum
- [x] Ajouter une légende graduée avec valeurs minimale, intermédiaires et maximale
- [x] Reporter l’échelle et les éléments critiques dans le PDF
- [x] Ajouter les tests de classement et vérifier le rendu Android

## Élément actif Escaliers
- [x] Définir les paramètres géométriques et les charges propres/exploitation de l’escalier
- [x] Ajouter Escaliers aux modèles actifs, aux sélecteurs et au placement 2D comme une dalle
- [x] Modéliser l’escalier en 3D avec marches, paillasse et direction de montée
- [x] Propager ses charges vers les appuis, poteaux et fondations et l’inclure au rapport
- [x] Ajouter les tests et vérifier le rendu Android

## Escalier à deux volées avec paliers
- [x] Définir une géométrie paramétrique à deux volées, palier de repos et palier d’arrivée
- [x] Déclencher la génération complète par un seul toucher sur la poutre de départ
- [x] Remplacer le rectangle par un plan 2D lisible avec marches, paliers et flèches de montée
- [x] Modéliser les deux volées, le palier central et le palier d’arrivée en 3D
- [x] Conserver l’intégration des charges, niveaux et appuis dans le dimensionnement
- [x] Ajouter les tests et vérifier le parcours Android

## Pose 3D des escaliers en deux points
- [x] Déplacer la pose Escaliers hors de la grille 2D vers la vue 3D
- [x] Capturer le nœud de départ puis le nœud d’arrivée avec un marqueur clair
- [x] Générer deux volées de 1 m avec palier central à mi-hauteur, jour de 2 cm et palier d’arrivée
- [x] Générer automatiquement l’aperçu 2D correspondant sans permettre sa pose directe
- [x] Conserver les charges et la propagation vers les appuis
- [x] Ajouter les tests et vérifier le parcours Android

## Ancrage structurel des escaliers
- [x] Reconnaître uniquement les intersections réelles poteau–poutre comme nœuds d’escalier
- [x] Refuser la sélection d’un simple point de grille ou d’un élément non structurel
- [x] Calculer l’altitude de départ, l’altitude d’arrivée et la hauteur totale du poteau/niveau
- [x] Adapter les deux volées et le palier à la hauteur réelle de l’étage
- [x] Vérifier la propagation des charges depuis les ancrages et publier les tests

## Pose Escaliers en trois clics
- [x] Diagnostiquer pourquoi les nœuds poteau–poutre existants ne sont pas sélectionnés
- [x] Afficher et rendre cliquables uniquement les vrais nœuds structurels
- [x] Mémoriser départ, palier de repos puis arrivée dans cet ordre
- [x] Déduire le sens des deux volées depuis le deuxième clic
- [x] Adapter plan 2D, vue 3D, charges et tests au parcours en trois clics

## Ancrage Escaliers départ–poteau–arrivée
- [x] Reconnaître le premier support comme nœud poteau–poutre de départ
- [x] Reconnaître le deuxième support comme poteau porteur du palier de repos
- [x] Reconnaître le troisième support comme poutre porteuse du palier d’arrivée
- [x] Afficher des cibles 3D différentes selon l’étape active
- [x] Générer la géométrie et conserver les charges selon ces trois ancrages
- [x] Ajouter les tests et publier la correction

## Étiquettes du parcours Escaliers
- [x] Afficher « Départ » sur le premier support sélectionné
- [x] Afficher « Palier » sur le poteau du deuxième clic
- [x] Afficher « Arrivée » sur la poutre ciblée au troisième clic
- [x] Masquer les étiquettes après validation et vérifier la lisibilité Android

## Réactivité du clic Escaliers en vue 3D
- [x] Identifier pourquoi les cibles d’escalier ne reçoivent pas le clic
- [x] Rendre la zone de clic prioritaire sur la rotation et le panoramique
- [x] Afficher immédiatement le marqueur Départ au premier clic
- [x] Conserver les clics Palier et Arrivée et réinitialiser après validation
- [x] Ajouter une régression et vérifier le parcours Android

## Aperçu Escaliers avant validation
- [x] Construire une géométrie d’aperçu à partir du départ et du palier sélectionnés
- [x] Afficher les deux volées et le palier en semi-transparence avant le troisième clic
- [x] Mettre à jour l’aperçu selon la poutre d’arrivée ciblée sans valider prématurément
- [x] Retirer l’aperçu après validation ou annulation et ajouter les tests Android

## Pose Escaliers simplifiée en un clic
- [x] Remplacer le parcours trois clics par un clic unique sur une poutre de départ
- [x] Choisir automatiquement une poutre d’arrivée cohérente sur le niveau
- [x] Générer l’escalier avec aperçu et permettre la modification après pose
- [x] Conserver les charges, la vue 2D synchronisée et les tests Android

## Rendu 3D réaliste des escaliers
- [x] Remplacer les lignes inclinées par des volumes pleins de marches et contremarches
- [x] Construire deux volées opposées avec palier central et paliers raccordés
- [x] Assurer la continuité visuelle avec les planchers et poutres des niveaux
- [x] Conserver les charges, la sélection et l’aperçu semi-transparent
- [x] Ajouter les tests et vérifier le rendu Android

## Escalier de référence à deux volées perpendiculaires
- [x] Remplacer la géométrie actuelle par deux volées perpendiculaires à 90 degrés
- [x] Ajouter un palier de repos à l’angle et un palier d’arrivée au niveau supérieur
- [x] Régler la hauteur totale à 3,20 m et vérifier Blondel avec marches régulières
- [x] Afficher un volume monolithique en béton armé avec planchers inférieur et supérieur visibles
- [x] Nettoyer la vue isométrique et vérifier le plan, les charges et les tests

## Workflow RSA par ligne temporaire Z
- [x] Vérifier le principe de ligne temporaire/niveau intermédiaire utilisé pour construire les volées
- [x] Ajouter un paramètre Z de palier, par défaut à +1,60 m pour un étage de 3,20 m
- [x] Permettre la définition de la première volée par deux points bas et deux points sur la ligne Z
- [x] Permettre la définition de la seconde volée entre la ligne Z et le niveau supérieur
- [x] Adapter la géométrie 3D, le plan 2D, les charges et les tests

## Workflow RSA des escaliers — ligne temporaire Z

- [x] Ajouter une construction en six points : deux coins au niveau bas, deux coins sur la ligne temporaire Z et deux coins au niveau haut
- [x] Enregistrer les rectangles des deux volées et l’altitude intermédiaire dans la géométrie de l’escalier
- [x] Rendre les cibles tactiles 3D visibles aux altitudes bas, Z et haut
- [x] Dessiner deux volées inclinées pleines avec palier intermédiaire et palier d’arrivée
- [x] Prendre en compte les trois surfaces de l’escalier dans la charge permanente et d’exploitation
- [x] Vérifier compilation TypeScript et suite Vitest

> Note : la ligne temporaire est un repère de construction de l’interface, non un élément structurel persistant indépendant.

## Modification du workflow escalier — pose 2D uniquement

- [x] Désactiver la pose interactive des escaliers dans la vue 3D
- [x] Permettre la pose RSA en six points uniquement dans la vue 2D
- [x] Conserver la synchronisation automatique du modèle 3D et des charges
- [x] Ajouter et exécuter les tests du nouveau parcours 2D

## Reconfiguration des escaliers en dalles inclinées de 15 cm

- [x] Configurer le modèle Escaliers comme une dalle pleine de 15 cm
- [x] Remplacer la géométrie unique par deux volées indépendantes de quatre points
- [x] Permettre le changement de niveau entre les points 2 et 3 de chaque volée
- [x] Afficher les curseurs numérotés 1, 2, 3 et 4 pour chaque volée
- [x] Synchroniser la géométrie 2D, 3D et la charge propre de 15 cm
- [x] Ajouter les tests de géométrie et de charge des deux volées

## Correction géométrique de l’escalier

- [x] Limiter la paillasse de repos à l’intersection réelle des deux volées
- [x] Synchroniser la paillasse comme une seule entité sans débordement
- [x] Supprimer le palier d’arrivée indépendant du rendu 3D et 2D
- [x] Conserver uniquement la dalle inclinée de la seconde volée jusqu’au niveau haut
- [x] Ajouter les tests de géométrie et de régression visuelle

## Restauration de la paillasse monolithique

- [x] Rétablir une paillasse de repos de 1 m de large à l’intersection des volées
- [x] Supprimer tout débordement de la paillasse hors de la zone de raccordement
- [x] Unifier les deux volées et la paillasse dans une seule géométrie d’escalier
- [x] Conserver une charge et une sélection uniques pour l’escalier monolithique
- [x] Ajouter les tests de géométrie et de charge de la paillasse

## Schéma PDF de continuité monolithique de l’escalier

- [x] Créer un schéma technique montrant les deux volées et la paillasse de repos de 1 m
- [x] Illustrer la continuité monolithique comme une seule entité structurelle
- [x] Intégrer le schéma dans le rapport PDF avec légende et repères
- [x] Ajouter les tests de génération et de pagination du rapport

## Correction du palier intermédiaire selon la référence

- [x] Faire commencer le palier au coin supérieur de la première volée
- [x] Donner au palier une longueur de 2 m correspondant aux deux largeurs de volée
- [x] Donner au palier une largeur de 1 m
- [x] Faire naître la seconde volée sur le même palier
- [x] Synchroniser le rendu 3D, le plan 2D et la surface de charge
- [x] Ajouter les tests de raccordement du palier et des volées

## Reprise du palier selon la référence visuelle

- [x] Recalculer le palier horizontal comme un rectangle réel de 2 m × 1 m
- [x] Le raccorder au coin supérieur de la première volée sans décalage ni débordement
- [x] Faire démarrer la seconde volée sur le bord opposé du même palier
- [x] Unifier les trois volumes dans une seule géométrie monolithique
- [x] Aligner le plan 2D, les charges et la vérification visuelle

## Correction du coin opposé du palier pour la deuxième volée

- [x] Utiliser le 4e point de la première volée comme premier coin de la deuxième
- [x] Calculer le coin opposé à 1 m sur l’autre côté du palier
- [x] Former le rectangle incliné avec les deux points du niveau supérieur
- [x] Synchroniser le plan 2D, le rendu 3D et les charges
- [x] Ajouter une régression du coin opposé

## Correction des quatre appuis de la deuxième volée

- [x] Utiliser les deux coins du palier comme appuis inférieurs de la deuxième volée
- [x] Utiliser deux coins correspondants du niveau supérieur comme appuis supérieurs
- [x] Former une dalle inclinée rectangulaire complète, sans déformation ni débordement
- [x] Synchroniser le plan 2D, le volume 3D et les charges
- [x] Ajouter une régression garantissant les quatre appuis

## Stabilisation des escaliers après modification de grille

- [x] Enregistrer les coordonnées métriques absolues des points d’escalier à la création
- [x] Rendre les rendus 2D et 3D indépendants des indices et distances actuels des axes
- [x] Préserver la forme et la taille des escaliers après modification ou suppression d’axes
- [x] Valider la stabilité de la géométrie et des charges avec la suite Vitest existante

## Correction du débordement de la deuxième volée

- [x] Limiter la deuxième volée aux deux appuis inférieurs et aux deux appuis supérieurs sélectionnés
- [x] Supprimer tout prolongement automatique de la dalle inclinée en 2D et en 3D
- [x] Aligner la surface de charge sur le même quadrilatère limité
- [x] Valider la régression des quatre appuis avec la suite Vitest existante

## Correction des niveaux d’escalier RDC → R+1

- [x] Faire partir la volée 1 du niveau Fondations lorsque l’escalier est créé depuis le RDC
- [x] Placer le palier intermédiaire à mi-hauteur entre Fondations et R+1
- [x] Faire terminer la volée 2 au niveau R+1
- [x] Synchroniser les identifiants de niveaux, les hauteurs 3D et les charges transmises
- [x] Valider le cas RDC → R+1 avec la suite Vitest existante

## Audit de modélisation de l’escalier

- [x] Comparer la géométrie réellement affichée avec les quatre points et les niveaux attendus
- [x] Corriger le repère vertical : Fondations comme départ, palier intermédiaire, R+1 comme arrivée
- [x] Vérifier que le palier et les deux volées sont une géométrie continue sans translation implicite
- [x] Vérifier que les charges utilisent la même géométrie que le rendu
- [x] Valider la modélisation Fondations → R+1 avec la suite Vitest existante

## Recalage des sept points d’escalier

- [x] Corriger le mapping des points : Fondations pour le départ, RDC pour le palier et R+1 pour l’arrivée
- [x] Fixer la hauteur totale à 3,20 m et le palier à 1,60 m dans le cas RDC
- [x] Vérifier la cohérence du rendu 3D avec ces altitudes

## Correction géométrique confirmée par capture 3D

- [x] Supprimer le tracé en barres croisées qui dépasse les appuis de l’escalier
- [x] Rendre les faces supérieure et inférieure de chaque volée coplanaires avec les quatre points choisis
- [x] Fermer uniquement les côtés du quadrilatère sélectionné
- [x] Vérifier la deuxième volée sur le cas Fondations → R+1 avec la suite de validation

## Duplication 3D et bornage de la deuxième volée

- [x] Reproduire toute la géométrie de l’escalier source lors d’une copie RDC → R+1
- [x] Recaler les deux volées et le palier de la copie sur les niveaux cibles
- [x] Limiter l’extrémité haute de la deuxième volée aux deux points supérieurs choisis
- [x] Valider que la copie et l’escalier source sont visibles ensemble en vue 3D avec la suite Vitest existante

## Duplication réellement insérée dans le niveau cible

- [x] Insérer effectivement l’escalier copié dans le tableau d’éléments du niveau cible
- [x] Vérifier que le compteur d’éléments du niveau cible augmente après la copie
- [x] Rendre visible la géométrie complète de la copie en vue 3D
- [x] Vérifier la chaîne RDC → R+1 → R+2 et la nomenclature des copies

## Palier d’arrivée et continuité de l’escalier

- [x] Ajouter un palier d’arrivée identique au palier de repos
- [x] Rattacher le palier d’arrivée au niveau supérieur sans chevauchement
- [x] Borner la deuxième volée exactement entre le palier de repos et le niveau supérieur
- [x] Vérifier la continuité monolithique et le rendu 2D/3D

## Paliers pleins et dimensions corrigées

- [x] Remplacer le palier de repos en double plaque par un volume plein de 15 cm
- [x] Remplacer le palier d’arrivée en double plaque par un volume plein de 15 cm
- [x] Régler le palier d’arrivée à 2 m × 1 m
- [x] Garantir que les deux paliers restent strictement dans leurs niveaux

## Orientation latérale du palier d’arrivée

- [x] Orienter les 2 m du palier d’arrivée perpendiculairement à la deuxième volée
- [x] Conserver 1 m dans le sens de la volée
- [x] Maintenir le volume plein de 15 cm et l’altitude du niveau supérieur
- [x] Vérifier le rendu sans chevauchement

## Continuité vers l’escalier du niveau supérieur

- [x] Orienter le débordement de 2 m vers le côté de réception de la volée supérieure
- [x] Conserver l’appui de 1 m de la deuxième volée sur le palier
- [x] Vérifier la continuité géométrique et la transmission des charges entre niveaux
- [x] Garantir l’altitude du palier sans chevauchement du plancher

## Duplication multi-niveaux de tous les éléments

- [x] Rendre les escaliers duplicables avec géométrie, paliers, appuis, charges, section et couleur
- [x] Rendre semelles, poteaux, poutres et dalles duplicables avec toutes leurs propriétés
- [x] Permettre la sélection de plusieurs niveaux cibles dans une même opération
- [x] Préserver la nomenclature et empêcher les doublons d’emplacement
- [x] Tester la duplication vers plusieurs niveaux et vérifier les compteurs

## Sélection professionnelle pour duplication

- [x] Rendre fiable la sélection des éléments source à dupliquer
- [x] Remplacer le sélecteur natif des niveaux par des cases à cocher
- [x] Permettre de cocher un ou plusieurs niveaux cibles
- [x] Afficher clairement l’état sélectionné et le nombre de niveaux choisis
- [x] Vérifier que la duplication utilise exactement les cases cochées

## Duplication par translation verticale

- [x] Calculer le décalage d’altitude entre le niveau source et chaque niveau cible
- [x] Translater réellement semelles, poteaux, poutres et dalles vers les niveaux cibles
- [x] Translater toute la géométrie des escaliers, y compris les volées et paliers
- [x] Conserver X/Y, sections, couleurs, charges et configurations lors de la translation
- [x] Tester une copie vers plusieurs niveaux avec les altitudes attendues

## Correction de duplication RDC vers niveaux supérieurs

- [x] Conserver exactement les dimensions métriques de l’escalier source
- [x] Calculer chaque copie à partir du niveau source, sans cumul d’allongement
- [x] Exclure systématiquement le niveau source de la liste des destinations
- [x] Affecter une copie distincte à R+1 et R+2 avec la bonne altitude
- [x] Vérifier que les copies ne sont pas confondues avec l’escalier du RDC

## Régression persistante de duplication des escaliers

- [x] Reproduire le cas RDC → R+1 et R+2 avec les niveaux réellement cochés
- [x] Garantir que la géométrie métrique de chaque copie est strictement identique à la source
- [x] Garantir qu’aucune copie n’est ajoutée au niveau source ou à un niveau non coché
- [x] Ajouter des assertions ciblées sur les dimensions et les niveaux d’appui
- [x] Ne publier qu’après validation des deux défauts sur le rendu 3D

## Niveau d’arrivée et doublons d’escaliers

- [x] Faire correspondre le niveau cible choisi au niveau d’arrivée de l’escalier copié
- [x] Corriger le décalage vertical observé d’un étage vers le bas
- [x] Interdire deux escaliers au même emplacement sur un même niveau
- [x] Afficher une notification claire lorsqu’un doublon est refusé
- [x] Tester RDC→R+1 et RDC→R+2 avec les altitudes attendues

## Escalier comme entité structurelle unique

- [x] Agréger les deux volées et les paliers dans une seule charge d’escalier
- [x] Reporter la charge globale vers les appuis réels de l’escalier
- [x] Supprimer l’avertissement erroné « sans poutre réelle compatible » pour les escaliers
- [x] Appliquer la logique aux escaliers dupliqués sur tous les niveaux
- [x] Vérifier les valeurs de charges et le rapport PDF

## Lisibilité et sélection groupée

- [x] Rendre les escaliers semi-transparents dans la vue 3D sans masquer les éléments porteurs
- [x] Permettre de sélectionner plusieurs éléments d’une même nature avant duplication
- [x] Masquer la nomenclature indépendante des semelles dans la vue 2D/3D
- [x] Faire reprendre à chaque semelle le nom du poteau support associé
- [x] Tester l’affichage, la sélection groupée et la synchronisation des noms

## Flèche de portée des dalles

- [x] Remplacer la flèche simple de portée par une flèche à double sens en vue 2D
- [x] Conserver les valeurs, dimensions et propriétés des dalles inchangées
- [x] Vérifier le rendu sur dalle pleine et plancher à corps creux

## Niveaux modifiables et sous-sols

- [x] Permettre de modifier le nom affiché de chaque niveau
- [x] Conserver l’identifiant interne et l’ordre lors du changement de nom
- [x] Rendre le bouton moins fonctionnel pour ajouter un niveau de sous-sol
- [x] Autoriser plusieurs sous-sols avec altitudes négatives cohérentes
- [x] Propager les sous-sols dans la grille, la vue 3D, la duplication et les charges
- [x] Tester les noms personnalisés et la création de plusieurs sous-sols

## Intégration des voiles structurels
- [x] Permettre la pose linéaire d’un voile entre deux points en 2D
- [x] Afficher les voiles en 2D avec épaisseur et libellé
- [x] Afficher les voiles en 3D avec hauteur, épaisseur et sélection
- [x] Intégrer les voiles à l’édition, la suppression, la duplication et la détection des doublons
- [x] Intégrer le poids propre et la transmission des charges des voiles
- [x] Ajouter les tests Vitest et publier la fonctionnalité

## Rendu vertical des voiles en 3D
- [x] Remplacer la ligne 3D du voile par un mur vertical extrudé
- [x] Respecter la longueur entre les deux points et l’épaisseur du modèle
- [x] Respecter la hauteur et la cote du niveau actif
- [x] Conserver sélection, libellé et transmission des charges
- [x] Tester et publier la correction

## Transparence des voiles
- [x] Rendre les voiles semi-transparents en 2D et en 3D sans perdre leurs contours et libellés
- [x] Vérifier la sélection et la visibilité des éléments derrière le voile
- [x] Tester et publier la correction visuelle

## Longrines de redressement entre semelles
- [x] Autoriser la pose uniquement au niveau Fondation et des sous-sols
- [x] Exiger deux appuis correspondant à deux semelles existantes
- [x] Refuser la création si un appui n’est pas une semelle ou si les deux appuis sont identiques
- [x] Conserver le rendu 2D/3D et le niveau de fondation de la longrine
- [x] Intégrer le poids propre et la transmission des charges entre semelles
- [x] Ajouter les tests de pose et de dimensionnement puis publier

## Correction liaison longrine–poteaux–semelles
- [x] Autoriser une longrine entre deux poteaux implantés sur deux semelles
- [x] Conserver la restriction aux niveaux Fondation et Sous-sol
- [x] Corriger l’aperçu et la validation des deux points comme une poutre
- [x] Transférer les charges de la longrine vers les deux appuis réels
- [x] Ajouter les tests et publier la correction

## Fiabilisation de la pose des longrines
- [x] Accepter le clic sur le poteau ou la semelle d’un même appui fondé
- [x] Normaliser le point sélectionné vers le nœud commun poteau–semelle
- [x] Afficher un aperçu et une notification explicites entre les deux appuis
- [x] Vérifier la création et les charges de la longrine
- [x] Tester et publier la correction

## Sections réelles et volumes 3D
- [x] Rendre la longrine rectangulaire pleine selon sa section et à la cote des semelles
- [x] Appliquer les sections modifiées aux poutres et poteaux en 3D
- [x] Appliquer les dimensions modifiées aux semelles et voiles en 3D
- [x] Appliquer les épaisseurs des dalles en 3D
- [x] Vérifier l’actualisation immédiate après édition
- [x] Ajouter les tests et publier la correction

## Géométrie 3D fidèle aux sections
- [x] Corriger les poutres en barres horizontales extrudées selon largeur et hauteur
- [x] Appliquer la même géométrie paramétrique aux longrines de redressement
- [x] Vérifier les dimensions distinctes des poteaux et semelles
- [x] Vérifier les épaisseurs distinctes des voiles et dalles
- [x] Tester l’édition de sections et publier la correction

## Sections individuelles par élément
- [x] Vérifier que chaque élément conserve sa section propre
- [x] Corriger les volumes 3D individuels des poutres, poteaux, semelles, longrines, voiles et dalles
- [x] Rendre l’empreinte 2D des semelles proportionnelle à B×L
- [x] Tester deux éléments de même nature avec des sections différentes
- [x] Publier la correction des sections individuelles

## Normalisation en mètres et semelles
- [x] Auditer les formats de sections et la persistance des dimensions
- [x] Normaliser les sections, distances et altitudes en mètres avec affichage de l’unité
- [x] Corriger la fenêtre d’ajout et d’édition des semelles avec B, L et h en m
- [x] Garantir le rendu 3D propre à chaque section individuelle
- [x] Vérifier l’aperçu 2D des semelles selon B×L
- [x] Tester et publier la normalisation des unités

## Semelles à l’échelle réelle
- [x] Corriger la conversion des dimensions B/L/h selon les distances de grille
- [x] Centrer chaque semelle sur le nœud du poteau avec débord symétrique
- [x] Permettre la saisie libre de B, L et h en mètres
- [x] Tester une semelle 2.00 × 2.00 × 0.50 m en 2D et 3D
- [x] Publier la correction des semelles à l’échelle

## Saisie des semelles et altitudes indépendantes
- [x] Fiabiliser la saisie libre B/L/h en m lors de la création d’une semelle
- [x] Conserver une altitude propre à chaque niveau
- [x] Empêcher la suppression d’un niveau de recalculer les autres altitudes
- [x] Vérifier l’affichage 3D et la duplication après suppression intermédiaire
- [x] Tester et publier la correction

## Escaliers monolithiques — descente des charges
- [x] Auditer l’avertissement de poutre d’appui des escaliers
- [x] Consolider le calcul global G/Q des deux volées et paliers
- [x] Transmettre les charges vers les appuis géométriques réels
- [x] Supprimer l’exigence artificielle d’une poutre d’appui
- [x] Mettre à jour le rapport et ajouter les tests de régression
- [x] Publier la correction

## Appuis de paliers et semelles 3D
- [x] Détecter les poteaux aux extrémités réelles des paliers d’escalier
- [x] Répartir les charges de l’escalier vers ces appuis
- [x] Corriger la conversion individuelle des dimensions de semelles en 3D
- [x] Vérifier deux semelles de sections différentes
- [x] Ajouter les tests de régression et publier

## Correction active semelles identiques
- [x] Décorréler définitivement la taille de la semelle de l’index d’axe
- [x] Garantir un volume identique pour une section identique
- [x] Vérifier le centrage sur le nœud du poteau et l’échelle métrique de grille
- [x] Ajouter un test de régression multi-positions
- [x] Publier la correction

## Stabilité des éléments lors des changements d’axes
- [x] Conserver les coordonnées métriques absolues des éléments lors de l’ajout d’un axe
- [x] Conserver les coordonnées métriques absolues lors de la suppression d’un axe
- [x] Vérifier les poutres, dalles, poteaux, semelles, voiles, longrines et escaliers
- [x] Renforcer la visibilité des escaliers en 2D et 3D
- [x] Ajouter des tests de non-régression et publier
