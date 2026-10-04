# Plan explicite des 7 priorités du modèle Bâtiment GcBtp

**Version :** 1.0  
**Périmètre :** modèle Bâtiment uniquement  
**Objectif :** faire évoluer GcBtp d’un outil de modélisation et de descente de charges simplifiée vers une application de conception structurelle fiable, traçable et exploitable par un ingénieur.

## Position de départ

Le modèle Bâtiment dispose déjà d’une base fonctionnelle : grille 2D métrique, niveaux, poteaux, poutres, dalles, semelles, semelles excentrées, voiles, longrines de redressement, escaliers monolithiques, vue 3D, duplication, synthèse des charges, fiche Structural Passport, rapport PDF local et profils de pays.

La base technique est stable : le projet compile, le build passe et 119 tests Vitest sont actuellement validés.

La limite principale est que le moteur actuel réalise une **descente de charges tributaire simplifiée**. Il ne réalise pas encore une analyse globale par rigidité ou éléments finis. Les sept priorités ci-dessous doivent donc être développées dans l’ordre indiqué.

## Vue d’ensemble des 7 priorités

| Priorité | Fonction à réaliser | Résultat attendu |
|---|---|---|
| 1 | Modèle analytique et contrôle géométrique | Une géométrie graphique transformée en modèle calculable et connecté |
| 2 | Cas de charges, sources de masse et combinaisons | Des charges organisées et traçables selon le référentiel choisi |
| 3 | Solveur statique global | Déplacements, réactions et efforts internes calculés |
| 4 | Dalles, voiles, maillage et distribution surfacique | Des surfaces réellement analysables, avec charges et résultats vérifiables |
| 5 | Vent, neige et séisme | Actions horizontales et climatiques générées à partir de paramètres de projet |
| 6 | Dimensionnement béton armé et ferraillage | Vérifications réglementaires et propositions d’armatures traçables |
| 7 | Fondations, rapports et industrialisation | Vérifications géotechniques, rapport fiable et application Android durable |

---

# Priorité 1 — Créer le modèle analytique et contrôler la géométrie

## Objectif

Séparer clairement le modèle graphique utilisé pour dessiner le bâtiment du modèle analytique utilisé pour calculer. Chaque élément graphique doit produire des nœuds, des barres ou des surfaces analytiques avec une connectivité explicite.

Un logiciel de conception ne doit pas calculer uniquement à partir de la proximité visuelle des éléments. Il doit savoir si deux éléments sont réellement connectés, s’ils sont alignés, s’ils reposent sur un appui et si la structure est stable.

## Données nécessaires

L’application doit disposer des données suivantes :

- identifiant unique de chaque niveau ;
- altitude absolue de chaque niveau ;
- hauteur de chaque niveau ;
- coordonnées métriques absolues des axes X et Y ;
- coordonnées Z des niveaux et lignes temporaires ;
- coordonnées de chaque extrémité d’élément ;
- section et matériau de chaque élément ;
- type de liaison entre éléments ;
- type d’appui et degrés de liberté bloqués ;
- tolérance géométrique de fusion des nœuds ;
- éventuels excentrements et relâchements ;
- ouvertures et limites des dalles et voiles.

## Procédure à suivre

### Étape 1 — Définir un schéma analytique versionné

Créer des types distincts pour :

- `AnalyticalNode` ;
- `AnalyticalFrame` ;
- `AnalyticalSurface` ;
- `AnalyticalSupport` ;
- `MaterialProperty` ;
- `SectionProperty` ;
- `ReleaseProperty` ;
- `MeshProperty`.

Le schéma doit posséder une version. Toute modification ultérieure du format doit passer par une migration.

### Étape 2 — Générer les nœuds

Créer automatiquement les nœuds à partir :

- des poteaux ;
- des extrémités de poutres ;
- des intersections poutre-poutre ;
- des coins de dalles ;
- des coins de voiles ;
- des points d’appui d’escaliers ;
- des semelles et longrines.

Fusionner les nœuds qui sont à l’intérieur de la tolérance choisie. La tolérance doit être affichée et modifiable dans les paramètres avancés.

### Étape 3 — Générer les barres et surfaces

Convertir :

- les poutres en barres ;
- les poteaux en barres verticales ;
- les longrines en barres de fondation ;
- les voiles en surfaces verticales ;
- les dalles en surfaces horizontales ;
- les paillasses d’escalier en surfaces inclinées ;
- les semelles en surfaces ou solides de fondation selon le niveau d’analyse choisi.

### Étape 4 — Vérifier la connectivité

Avant tout calcul, produire une liste d’erreurs :

- barre sans nœud de départ ;
- barre sans nœud d’arrivée ;
- élément orphelin ;
- poteau non aligné avec son niveau inférieur ;
- poutre non reliée à un appui ;
- dalle sans appui ;
- voile non relié à la fondation ou au plancher ;
- escalier sans quatre appuis géométriques cohérents ;
- semelle sans poteau ou sans charge ;
- élément placé sur un axe supprimé mais sans coordonnées absolues valides.

### Étape 5 — Vérifier la stabilité minimale

Identifier les degrés de liberté non bloqués. Si le modèle possède un mécanisme évident, le calcul doit être bloqué et l’application doit expliquer où se trouve le problème.

## Tests nécessaires

- modèle simple : une poutre sur deux appuis ;
- portique à un niveau ;
- portique à deux niveaux ;
- poteaux désalignés ;
- poutre flottante ;
- dalle sans poutre ;
- voile connecté à une dalle ;
- escalier entre deux niveaux ;
- modification d’un axe après création d’éléments ;
- suppression d’un axe sans déplacement des éléments.

## Critères de réussite

La priorité est terminée lorsque :

1. chaque élément graphique possède un équivalent analytique ;
2. chaque nœud possède des coordonnées absolues en mètres ;
3. les éléments connectés sont identifiés sans ambiguïté ;
4. les erreurs de connectivité sont visibles avant calcul ;
5. les modèles instables sont bloqués ;
6. le modèle analytique est exportable en JSON et visualisable en 2D/3D.

## Livrables

- schéma analytique versionné ;
- générateur graphique → analytique ;
- pré-contrôle géométrique ;
- panneau des erreurs de modèle ;
- tests unitaires et scénarios d’intégration.

---

# Priorité 2 — Organiser les cas de charges, les sources de masse et les combinaisons

## Objectif

Remplacer la logique actuelle de charges globales par une organisation professionnelle en trois niveaux :

1. actions ou patterns de charges ;
2. cas d’analyse ;
3. combinaisons de calcul.

Cette séparation est indispensable pour éviter le double comptage du poids propre et pour identifier la combinaison qui gouverne chaque élément.

## Données nécessaires

Pour chaque action, enregistrer :

- identifiant ;
- nom ;
- catégorie ;
- unité ;
- valeur ;
- source ;
- statut : saisie, calculée, par défaut ou provisoire ;
- direction ;
- zone d’application ;
- multiplicateur de poids propre ;
- coefficient ψ ;
- coefficient partiel γ ;
- norme et annexe nationale associées.

Les cas minimaux sont :

- G — poids propre ;
- Gsup — charges permanentes ajoutées ;
- Q — exploitation ;
- cloisons ;
- toiture ;
- vent X ;
- vent Y ;
- neige ;
- séisme X ;
- séisme Y ;
- température ;
- tassement imposé ;
- accidentel ou incendie.

## Procédure à suivre

### Étape 1 — Créer le registre des actions

Chaque charge doit être créée dans un catalogue unique. Une charge ne doit pas être définie séparément dans plusieurs composants de l’application.

### Étape 2 — Définir le poids propre

Le poids propre doit être associé à un seul cas de charge avec un multiplicateur configurable, généralement égal à 1. Les autres cas doivent avoir un multiplicateur égal à 0 par défaut.

Afficher un avertissement si deux cas inclus dans une même combinaison possèdent chacun un multiplicateur de poids propre non nul.

### Étape 3 — Associer les charges aux éléments

Autoriser :

- charge surfacique sur dalle ;
- charge linéaire sur poutre ;
- charge ponctuelle sur nœud ;
- pression sur voile ;
- charge de toiture ;
- charge localisée d’équipement ;
- charge de mur sur poutre ;
- charge de garde-corps et acrotère.

Chaque charge doit conserver l’identifiant de l’élément auquel elle est associée.

### Étape 4 — Définir les cas d’analyse

Créer au minimum :

- statique linéaire par cas ;
- modale ;
- spectrale ;
- second ordre, dans une phase ultérieure ;
- construction par phases, dans une phase ultérieure.

### Étape 5 — Générer les combinaisons

Générer automatiquement les combinaisons selon :

- ELU fondamental ;
- ELS caractéristique ;
- ELS fréquente ;
- ELS quasi-permanente ;
- accidentelle ;
- sismique ;
- vent dans les deux directions ;
- cas dissymétriques de neige si nécessaire.

Autoriser la modification manuelle d’une combinaison, avec conservation de l’origine automatique ou manuelle.

## Tests nécessaires

- poids propre présent dans un seul pattern ;
- charge d’exploitation absente lorsque le cas est désactivé ;
- changement de norme modifiant les coefficients ;
- combinaison manuelle conservée après sauvegarde ;
- charge localisée retrouvée dans le Structural Passport ;
- charge de dalle retransmise une seule fois ;
- comparaison Gk, Qk, Nu et Nser avec un cas calculé manuellement.

## Critères de réussite

La priorité est terminée lorsque :

1. chaque résultat cite son cas et sa combinaison ;
2. le double comptage du poids propre est impossible ou signalé ;
3. les coefficients ψ et γ sont liés à une norme ;
4. les charges sont visibles graphiquement ;
5. l’utilisateur peut créer, modifier, désactiver et documenter une combinaison.

## Livrables

- registre des actions ;
- éditeur de cas de charges ;
- générateur de combinaisons ;
- source de masse ;
- vérificateur de double comptage ;
- tests de combinaisons.

---

# Priorité 3 — Implémenter un solveur statique global

## Objectif

Calculer la réponse d’un modèle de barres par rigidité matricielle. La descente tributaire actuelle doit rester disponible comme mode rapide et comme outil de comparaison, mais elle ne doit plus être la seule méthode de calcul.

## Données nécessaires

Pour chaque matériau :

- poids volumique ;
- module d’élasticité ;
- coefficient de Poisson ;
- coefficient de dilatation ;
- résistance caractéristique ;
- classe de béton ou nuance d’acier.

Pour chaque section :

- aire ;
- inerties ;
- constante de torsion ;
- dimensions ;
- orientation locale ;
- poids propre.

Pour chaque barre :

- nœud initial ;
- nœud final ;
- section ;
- matériau ;
- orientation ;
- relâchements ;
- excentrements ;
- niveau et phase de construction.

## Procédure à suivre

### Étape 1 — Choisir le domaine du premier solveur

Commencer par un solveur de portique 2D ou 3D à comportement élastique linéaire. Ne pas commencer par un solveur non linéaire complet.

### Étape 2 — Calculer les matrices élémentaires

Pour chaque barre, calculer la matrice de rigidité locale puis la transformer dans le repère global.

### Étape 3 — Assembler la matrice globale

Assembler les matrices de toutes les barres sur les degrés de liberté des nœuds.

### Étape 4 — Appliquer les appuis

Traiter :

- encastrements ;
- articulations ;
- translations bloquées ;
- rotations bloquées ;
- ressorts ;
- appuis élastiques.

### Étape 5 — Résoudre les déplacements

Résoudre le système de rigidité pour chaque cas de charge. Détecter les matrices singulières et expliquer les degrés de liberté responsables.

### Étape 6 — Calculer les efforts

Restituer pour chaque barre :

- effort normal N ;
- effort tranchant Vx et Vy ;
- moment Mx et My ;
- torsion T ;
- déplacements et rotations aux extrémités ;
- diagrammes le long de la barre.

### Étape 7 — Combiner les résultats

Appliquer les combinaisons aux résultats des cas de charge et enregistrer la combinaison gouvernante pour chaque effort.

## Tests nécessaires

- poutre simplement appuyée avec charge uniforme ;
- console ;
- portique à un niveau ;
- portique à deux niveaux ;
- charge ponctuelle au milieu ;
- comparaison avec `qL²/8` dans le cas simple ;
- somme des réactions égale à la charge totale ;
- déplacement nul sur les appuis ;
- détection d’un mécanisme volontairement créé.

## Critères de réussite

La priorité est terminée lorsque :

1. les réactions équilibrent les charges ;
2. les déplacements respectent les conditions d’appui ;
3. les efforts sont calculés par cas et combinaison ;
4. un cas manuel simple est retrouvé avec une tolérance définie ;
5. les instabilités sont détectées et expliquées ;
6. les résultats sont affichables sur le modèle 3D.

## Livrables

- solveur statique de barres ;
- assembleur matriciel ;
- calcul des réactions ;
- calcul des efforts internes ;
- diagrammes d’efforts ;
- comparaison tributaire/analytique ;
- suite de benchmarks numériques.

---

# Priorité 4 — Ajouter les dalles, voiles, maillage et charges surfaciques

## Objectif

Passer d’une dalle rectangulaire qui distribue une charge à une surface analytique pouvant être maillée et calculée. Les voiles doivent être traités comme surfaces verticales lorsqu’ils participent à la résistance latérale ou au transfert des charges.

## Données nécessaires

Pour chaque surface :

- contour polygonal ;
- ouvertures ;
- épaisseur ;
- matériau ;
- rigidité ;
- type de comportement : membrane, plaque ou coque ;
- maillage global ;
- raffinements locaux ;
- appuis et connexions ;
- sens de portée pour les dalles à corps creux ;
- charges surfaciques par cas.

## Procédure à suivre

### Étape 1 — Remplacer les rectangles par des polygones

Conserver les rectangles comme cas simple, mais permettre plusieurs sommets et des ouvertures.

### Étape 2 — Définir les propriétés de surface

Distinguer :

- dalle pleine ;
- dalle à corps creux ;
- paillasse d’escalier ;
- palier ;
- voile ;
- mur non porteur ;
- diaphragme rigide.

### Étape 3 — Mailler les surfaces

Commencer par un maillage triangulaire ou quadrangulaire simple, puis ajouter :

- taille globale ;
- raffinements autour des poteaux ;
- raffinements autour des ouvertures ;
- contrôle de qualité des éléments ;
- avertissement sur les éléments trop déformés.

### Étape 4 — Distribuer les charges

Pour chaque dalle, afficher :

- les surfaces tributaires ;
- le sens de portée ;
- les poutres recevant la charge ;
- la quantité transférée ;
- les charges non reprises.

### Étape 5 — Calculer les résultats de surface

Restituer :

- moments dans les deux directions ;
- efforts membranaires ;
- cisaillement ;
- réactions de bord ;
- déplacements ;
- concentrations autour des appuis.

## Tests nécessaires

- dalle simplement appuyée sur quatre côtés ;
- dalle portée dans une direction ;
- dalle portée dans deux directions ;
- dalle avec ouverture ;
- voile soumis à une pression ;
- escalier incliné entre deux niveaux ;
- dalle sans appui ;
- maillage trop grossier ;
- comparaison de la charge totale avant et après maillage.

## Critères de réussite

La priorité est terminée lorsque :

1. la charge totale appliquée à une surface est conservée après maillage ;
2. une dalle peut être non rectangulaire ;
3. les ouvertures sont exclues du calcul ;
4. le voile produit des efforts de surface ;
5. la distribution des charges est visible et vérifiable ;
6. les résultats de surface sont exportables dans le rapport.

## Livrables

- modèle de surface ;
- générateur de maillage ;
- contrôle qualité du maillage ;
- affichage des charges surfaciques ;
- résultats de surface ;
- tests de conservation des charges.

---

# Priorité 5 — Implémenter le vent, la neige et le séisme

## Objectif

Remplacer les facteurs climatiques provisoires par des actions calculées à partir des paramètres du projet, de la localisation et du référentiel choisi.

## Données nécessaires

### Données générales

- pays ;
- ville ;
- coordonnées ;
- altitude ;
- catégorie de terrain ;
- classe d’importance ;
- durée de vie de projet ;
- norme et annexe nationale ;
- type de bâtiment ;
- dimensions en plan et en hauteur.

### Données vent

- vitesse de base ;
- direction ;
- catégorie de terrain ;
- coefficient d’orographie ;
- coefficient de topographie ;
- pression intérieure ;
- coefficients de forme ;
- zones de façade et toiture.

### Données neige

- zone de neige ;
- charge au sol ;
- altitude ;
- coefficients de forme ;
- exposition ;
- thermique ;
- cas dissymétriques.

### Données séisme

- zone sismique ;
- classe de sol ;
- accélération de référence ;
- spectre ;
- facteur de comportement ;
- amortissement ;
- classe d’importance ;
- masse sismique ;
- directions X et Y.

## Procédure à suivre

### Étape 1 — Afficher le statut des données

Chaque donnée doit être marquée :

- officielle ;
- saisie par l’utilisateur ;
- calculée ;
- provisoire ;
- à confirmer.

Aucune valeur provisoire ne doit être présentée comme une valeur réglementaire définitive.

### Étape 2 — Générer le vent

Calculer les pressions par niveau et par zone. Distribuer ces pressions sur les voiles, façades ou diaphragmes. Générer au minimum les directions X et Y et les cas de signe opposé.

### Étape 3 — Générer la neige et la pluie

Associer les charges à la toiture et générer les cas symétriques et dissymétriques nécessaires.

### Étape 4 — Générer le séisme

Créer la source de masse à partir :

- du poids propre ;
- des charges permanentes ;
- d’une fraction réglementaire des charges d’exploitation ;
- de la toiture selon le cas.

Calculer les modes propres, la participation massique et les forces de niveau. Ajouter une analyse spectrale lorsque le solveur est prêt.

### Étape 5 — Calculer les résultats d’étage

Afficher :

- déplacement du centre de masse ;
- rotation ;
- force tranchante d’étage ;
- dérive inter-étage ;
- accélération ;
- effort dans les poteaux et voiles.

## Tests nécessaires

- vent nul si le cas est désactivé ;
- vent différent entre X et Y ;
- charge neige appliquée uniquement à la toiture ;
- masse sismique contrôlée ;
- participation massique cumulée ;
- dérive d’un modèle régulier ;
- changement de classe de sol ;
- modification de l’annexe nationale ;
- avertissement lorsque les paramètres sont provisoires.

## Critères de réussite

La priorité est terminée lorsque :

1. les charges climatiques sont générées par direction et niveau ;
2. le séisme utilise une masse explicitement documentée ;
3. les dérives inter-étages sont calculées ;
4. les combinaisons latérales sont visibles ;
5. l’origine de chaque paramètre est affichée ;
6. les données incomplètes bloquent le rapport réglementaire.

## Livrables

- générateur de vent ;
- générateur de neige et pluie ;
- source de masse ;
- spectre sismique ;
- analyse modale ;
- tableau des résultats par niveau ;
- contrôles de dérive et de régularité.

---

# Priorité 6 — Développer le dimensionnement béton armé et le ferraillage

## Objectif

Remplacer les contrôles indicatifs par des vérifications utilisant les efforts issus du solveur, les combinaisons gouvernantes, les matériaux, l’enrobage et les règles de détail du référentiel choisi.

Le ferraillage ne doit pas être développé avant que les efforts internes, combinaisons et unités soient fiables.

## Données nécessaires

- norme de béton armé ;
- annexe nationale ;
- classe de béton ;
- nuance d’acier ;
- diamètre disponibles ;
- enrobage nominal ;
- exposition ;
- durée de vie ;
- limites de fissuration ;
- feu si nécessaire ;
- règles d’espacement ;
- longueurs d’ancrage ;
- recouvrements ;
- dispositions sismiques ;
- efforts N, V, Mx, My, T et déplacements ;
- combinaisons ELU et ELS.

## Procédure à suivre

### Étape 1 — Dimensionner les poutres

Vérifier :

- flexion ;
- effort tranchant ;
- torsion ;
- armatures minimales ;
- armatures maximales ;
- flèche ;
- fissuration ;
- ancrage et recouvrement ;
- zones d’appui et de travée.

### Étape 2 — Dimensionner les poteaux

Vérifier :

- compression ;
- flexion simple ;
- flexion biaxiale ;
- interaction N-Mx-My ;
- élancement ;
- second ordre ;
- armatures longitudinales ;
- cadres ;
- confinement ;
- continuité entre niveaux.

### Étape 3 — Dimensionner les dalles

Vérifier :

- flexion dans X et Y ;
- cisaillement ;
- poinçonnement ;
- flèche ;
- fissuration ;
- armatures supérieures et inférieures ;
- zones autour des poteaux ;
- trémies et ouvertures.

### Étape 4 — Dimensionner les voiles

Vérifier :

- effort normal ;
- flexion ;
- cisaillement ;
- traction dans les chaînages ;
- armatures verticales et horizontales ;
- zones frontières ;
- ouvertures et linteaux.

### Étape 5 — Générer le ferraillage

Proposer :

- diamètre ;
- nombre de barres ;
- espacement ;
- longueur ;
- zones d’armatures ;
- cadres et étriers ;
- schéma de placement ;
- nomenclature ;
- poids d’acier.

L’utilisateur doit pouvoir modifier une proposition, mais chaque modification doit relancer les vérifications.

## Tests nécessaires

- poutre de référence en flexion ;
- poutre en cisaillement ;
- poteau centré ;
- poteau biaxial ;
- dalle sur quatre côtés ;
- poinçonnement autour d’un poteau ;
- voile sous effort horizontal ;
- minimum et maximum d’armatures ;
- fissuration ;
- flèche ;
- ancrage et recouvrement ;
- comparaison avec exemples manuels vérifiés.

## Critères de réussite

La priorité est terminée lorsque :

1. chaque vérification cite sa combinaison gouvernante ;
2. chaque formule affiche ses données d’entrée ;
3. les résultats montrent demande, résistance et taux d’utilisation ;
4. les armatures proposées respectent les minima et maxima ;
5. toute modification du modèle invalide les résultats précédents ;
6. le rapport distingue clairement calcul automatique, proposition et validation de l’ingénieur.

## Livrables

- module matériaux et règles de détail ;
- vérification poutres ;
- vérification poteaux ;
- vérification dalles ;
- vérification voiles ;
- propositions de ferraillage ;
- plans de ferraillage ;
- nomenclature d’acier.

---

# Priorité 7 — Fondations, rapports et industrialisation

## Objectif

Finaliser la chaîne entre les réactions du modèle, le sol, les fondations, le rapport et l’utilisation durable sur Android.

Cette priorité rassemble les fonctions qui rendent l’application exploitable dans un projet réel après la fiabilisation du calcul.

## Données nécessaires

### Géotechnique

- type et couches de sol ;
- poids volumique ;
- cohésion ;
- angle de frottement ;
- module de déformation ;
- portance ultime ;
- portance admissible ;
- profondeur d’assise ;
- niveau de nappe ;
- coefficient de frottement ;
- tassement admissible ;
- paramètres de retrait-gonflement ;
- pente et proximité des ouvrages.

### Fondation

- type de fondation ;
- dimensions ;
- épaisseur ;
- débords ;
- excentricité ;
- liaison par longrine ;
- béton et acier ;
- enrobage ;
- profondeur ;
- charges N, Mx, My, Vx, Vy.

### Rapport

- nom du projet ;
- version du modèle ;
- auteur ;
- date ;
- norme ;
- annexe ;
- hypothèses ;
- résultats ;
- avertissements ;
- validation et signature.

## Procédure à suivre

### Étape 1 — Calculer les fondations à partir des réactions

Ne plus utiliser uniquement une charge axiale isolée. Utiliser les réactions complètes issues du solveur : N, Mx, My, Vx et Vy.

### Étape 2 — Vérifier la pression sous semelle

Calculer :

- pression maximale ;
- pression minimale ;
- aire comprimée ;
- décollement éventuel ;
- effet de l’excentricité ;
- glissement ;
- renversement.

### Étape 3 — Vérifier le béton de fondation

Vérifier :

- flexion ;
- cisaillement ;
- poinçonnement ;
- ancrage des poteaux ;
- armatures inférieures ;
- armatures de répartition.

### Étape 4 — Vérifier le sol

Calculer :

- portance selon la méthode choisie ;
- pression de calcul ;
- tassement ;
- tassement différentiel ;
- influence de la nappe ;
- interaction entre fondations proches.

### Étape 5 — Unifier le rapport

Créer un seul modèle de rapport partagé par :

- aperçu dans l’application ;
- fiche Structural Passport ;
- PDF ;
- export CSV ;
- export JSON.

Le rapport doit contenir :

1. page de garde ;
2. informations du projet ;
3. référentiel et statut de validation ;
4. géométrie par niveau ;
5. matériaux et sections ;
6. cas de charges ;
7. combinaisons ;
8. résultats par niveau ;
9. groupes d’éléments ;
10. Structural Passport ;
11. fondations ;
12. ferraillage si disponible ;
13. avertissements ;
14. limites du calcul ;
15. validation de l’ingénieur.

### Étape 6 — Industrialiser la sauvegarde

Remplacer progressivement `sessionStorage` par :

- sauvegarde serveur ;
- autosave ;
- historique des versions ;
- récupération après erreur ;
- export du projet complet ;
- import d’un projet ;
- contrôle de conflits.

### Étape 7 — Préparer Android

Vérifier :

- viewport 430 × 932 ;
- saisie numérique tactile ;
- clavier décimal ;
- gestes de zoom, pan et rotation ;
- partage du PDF ;
- fonctionnement hors ligne si nécessaire ;
- performance avec plusieurs niveaux et centaines d’éléments ;
- accessibilité et tailles de boutons.

## Tests nécessaires

- semelle centrée ;
- semelle excentrée ;
- semelle sous moment ;
- semelle sous charge horizontale ;
- sol insuffisant ;
- nappe proche ;
- longrine reliant deux semelles ;
- tassement différentiel ;
- rapport aperçu/PDF identique ;
- sauvegarde puis restauration ;
- export/import de modèle ;
- projet lourd sur appareil Android ;
- interruption pendant une sauvegarde.

## Critères de réussite

La priorité est terminée lorsque :

1. les fondations utilisent les réactions complètes du calcul ;
2. l’excentricité, le décollement, le glissement et le poinçonnement sont vérifiés ;
3. les paramètres géotechniques sont identifiés et traçables ;
4. le rapport PDF correspond exactement à l’aperçu ;
5. le projet peut être sauvegardé, restauré, exporté et importé ;
6. l’application reste utilisable sur Android avec des projets multi-niveaux.

## Livrables

- vérifications géotechniques ;
- dimensionnement des semelles ;
- rapport unifié ;
- export/import de projet ;
- sauvegarde serveur et historique ;
- tests de performance Android.

---

# Ordre de réalisation conseillé

## Étape A — Avant toute nouvelle fonctionnalité

1. Créer un checkpoint du projet.
2. Conserver les 119 tests comme seuil minimal.
3. Ajouter un fichier de schéma du modèle analytique.
4. Documenter les unités internes.
5. Afficher le statut « pré-étude » dans l’interface.

## Étape B — Première livraison technique

Réaliser les priorités 1 et 2 ensemble. Il est inutile de développer un solveur si les éléments ne sont pas connectés et si les charges ne sont pas organisées.

## Étape C — Première livraison de calcul

Développer la priorité 3 avec un solveur statique simple, puis comparer ses résultats au moteur tributaire actuel.

## Étape D — Extension du modèle

Ajouter la priorité 4 pour les dalles, voiles, escaliers et surfaces maillées.

## Étape E — Actions latérales

Ajouter la priorité 5 une fois le solveur gravitaire stabilisé.

## Étape F — Dimensionnement

Commencer la priorité 6 uniquement lorsque les efforts internes et combinaisons sont validés par des benchmarks.

## Étape G — Mise en production

Terminer par la priorité 7, l’unification du rapport, la persistance durable et les tests Android.

---

# Informations que l’utilisateur devra fournir pour une étude réelle

Pour obtenir un résultat exploitable, l’utilisateur devra renseigner :

- pays et ville du projet ;
- coordonnées et altitude ;
- norme et annexe nationale ;
- type de bâtiment et usage de chaque niveau ;
- nombre de niveaux, hauteurs et sous-sols ;
- matériaux et classes de résistance ;
- sections de tous les éléments ;
- type de plancher et épaisseurs ;
- charges permanentes ajoutées ;
- charges d’exploitation par usage ;
- charges de murs et cloisons ;
- charges de toiture ;
- vent ;
- neige ou pluie si applicable ;
- zone sismique et classe de sol ;
- étude géotechnique ;
- niveau de nappe ;
- type de fondation ;
- enrobage et exposition ;
- exigences de feu ;
- limites de flèche et de fissuration ;
- contraintes architecturales ;
- contraintes d’exécution ;
- niveau de détail attendu pour le rapport et le ferraillage.

Si une donnée est inconnue, l’application doit proposer une valeur de pré-étude clairement marquée, mais elle ne doit pas la présenter comme une donnée validée.

# Règle finale de conception

La logique à respecter est :

> **Géométrie fiable → modèle analytique connecté → cas de charges traçables → combinaisons normatives → analyse globale → efforts internes → dimensionnement → ferraillage → rapport validé.**

Il ne faut pas inverser cet ordre. En particulier, le ferraillage ne doit pas être produit à partir d’un simple classement de charges ou d’un moment indicatif si les appuis, la rigidité, les combinaisons et les efforts globaux ne sont pas encore calculés.
