# GcBtp — optimisation itérative et géométrie 3D

## Optimisation

Après validation d'une proposition de section dans le module de ferraillage :

1. la section est appliquée à l'élément de la maquette ;
2. une section personnalisée est créée dans le catalogue si nécessaire ;
3. le modèle 3D utilise immédiatement ses nouvelles dimensions ;
4. les résultats de ferraillage précédents sont invalidés ;
5. un recalcul global de la descente de charges/analyse est relancé ;
6. le module de ferraillage peut ensuite proposer une nouvelle réduction.

Le cycle peut donc être répété jusqu'à stabilisation. Aucune modification n'est appliquée sans validation explicite de l'utilisateur.

## Échelle 3D

La vue 3D utilise désormais les positions cumulées réelles des axes X/Y. Une distance de trame de 4,00 m correspond à une séparation visuelle de 4,00 m à l'échelle choisie ; des trames irrégulières conservent leurs proportions.

Les sections sont dessinées à partir de leurs dimensions métriques :
- poutres : largeur × hauteur ;
- poteaux : largeur × profondeur × hauteur ;
- voiles : épaisseur × longueur × hauteur ;
- semelles : largeur × longueur × épaisseur ;
- dalles : épaisseur réelle ;
- longrines : largeur × hauteur.

Les éléments de l'escalier utilisent également la géométrie métrique de la trame pour leurs largeurs et épaisseurs.

## Validation

La vérification TypeScript complète reste dépendante des dépendances de développement absentes/incomplètes dans l'environnement d'exécution (`@types/node`, `vite/client`, React et alias du projet). Une vérification de parsing TypeScript via le compilateur global a été effectuée sans erreur de syntaxe sur les fichiers modifiés ; les erreurs restantes sont des résolutions de modules/types liées à l'environnement incomplet.

## Fiches A4 de ferraillage — gabarit type Robot

Le module de béton armé produit désormais un dossier A4 de ferraillage par élément, avec une présentation technique inspirée des sorties de plans de ferraillage de Robot Structural Analysis :

- cartouche entreprise / bureau d'études ;
- projet, client, adresse et références ;
- numéro de plan et indice ;
- élément et combinaison gouvernante ;
- géométrie / section issue des demandes de calcul ;
- schéma de principe de la disposition des armatures ;
- nomenclature des barres (désignation, diamètre, quantité, As, longueur totale, masse) ;
- contrôles gouvernants Ed/Rd et taux d'utilisation ;
- limites et réserves de calcul ;
- note de bas de page personnalisable.

Les informations du cartouche sont enregistrées dans les paramètres de l'application et sont réutilisées lors des exports PDF A4. Le bouton `A4 / PDF` permet d'exporter une fiche élémentaire ; `Générer le dossier A4 type Robot` exporte l'ensemble des éléments calculés.
