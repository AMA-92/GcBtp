# Audit du modèle Bâtiment de GcBtp

**Date de l’audit : 2 octobre 2026**  
**Périmètre :** modèle Bâtiment uniquement — géométrie, niveaux, éléments, charges, descente de charges, résultats, rapport et préparation du dimensionnement.  
**Positionnement :** audit de conception réalisé avec une logique de bureau d’études structure. Ce document ne constitue pas une validation réglementaire du logiciel ni une note de calcul de projet.

## 1. Conclusion d’ingénierie

GcBtp possède aujourd’hui une base de modélisation bâtiment déjà riche. La grille 2D, les niveaux, les éléments courants, les semelles, les escaliers, les voiles, les longrines de redressement, la vue 3D et la synthèse des charges sont présents. Le moteur sait également conserver la géométrie métrique de nombreux éléments lors des modifications de trame et propager une partie des charges vers les poutres, poteaux et fondations.

Cependant, le produit n’est pas encore au niveau d’un logiciel d’analyse et de conception tel que Robot Structural Analysis, ETABS, SCIA Engineer ou RFEM. Le point critique est le suivant : **la descente de charges est actuellement une propagation géométrique et tributaire simplifiée ; elle n’est pas encore une analyse structurale par rigidité ou éléments finis**.

Le calcul doit donc être présenté comme **pré-étude / pré-dimensionnement indicatif** tant que les étapes suivantes ne sont pas développées :

- séparation stricte entre modèles physiques, cas de charges, cas d’analyse et combinaisons ;
- calcul des déplacements, réactions et efforts internes par un solveur ;
- prise en compte des moments biaxiaux, efforts tranchants, torsion, stabilité et second ordre ;
- dimensionnement réglementaire complet du béton armé, des fondations et des voiles ;
- traçabilité complète des hypothèses, formules, coefficients, unités et versions normatives ;
- validation par des cas de référence comparés à des résultats vérifiés.

## 2. Ce qui est déjà fait

### 2.1 Modélisation du bâtiment

Les fonctions suivantes sont déjà représentées dans le code du modèle Bâtiment :

- création et sélection de projets ;
- niveaux indépendants avec altitude et hauteur ;
- ajout de niveaux supérieurs et de sous-sols ;
- grille suivant X, Y et Z ;
- distances entre axes variables en mètres ;
- déplacement, zoom et interaction sur la grille 2D ;
- conservation des coordonnées métriques des éléments lors de l’ajout ou de la suppression d’axes ;
- nomenclature automatique des éléments ;
- undo/redo de plusieurs actions de projet ;
- sauvegarde locale par `sessionStorage` ;
- duplication d’éléments vers plusieurs niveaux avec sélection par cases à cocher ;
- sélection et édition d’éléments depuis les listes et la vue 3D.

### 2.2 Catalogue d’éléments

Le catalogue actuel couvre :

- poteaux rectangulaires et circulaires ;
- poutres ;
- dalles à corps creux ;
- dalles pleines ;
- semelles isolées ;
- semelles excentrées ;
- voiles ;
- longrines de redressement ;
- escaliers monolithiques à deux volées avec palier intermédiaire et palier d’arrivée.

Les sections et couleurs peuvent être associées aux modèles. Les dimensions métriques sont utilisées dans plusieurs rendus 2D et 3D. Les collisions simples entre éléments similaires sont également contrôlées.

### 2.3 Escaliers

Le modèle d’escalier contient une géométrie dédiée avec :

- deux volées ;
- une ligne de palier intermédiaire ;
- des points inférieurs, intermédiaires et supérieurs ;
- une hauteur de palier ;
- une géométrie absolue sauvegardée pour limiter l’effet des changements ultérieurs de trame ;
- un traitement comme entité monolithique pour la descente des charges ;
- détection d’appuis géométriques sur des poteaux situés aux extrémités des paliers ;
- rendu 3D avec paillasses et volumes de paliers ;
- duplication vers d’autres niveaux.

### 2.4 Vue 3D

La vue 3D dispose de :

- projection axonométrique SVG ;
- rotation par glissement ;
- mode panoramique ;
- zoom ;
- rotation inertielle après relâchement ;
- affichage des niveaux ;
- rendu distinct de plusieurs familles d’éléments ;
- sélection d’éléments ;
- affichage optionnel des valeurs de charges et moments ;
- échelle de couleurs des sollicitations ;
- mise en évidence du poteau et de la semelle critiques.

### 2.5 Descente de charges actuelle

Le moteur `building-load-propagation.ts` sait actuellement :

- créer des surfaces rectangulaires de dalles et d’escaliers ;
- différencier une dalle pleine et une dalle à corps creux ;
- calculer un poids propre géométrique pour certaines sections ;
- répartir une dalle sur des poutres compatibles ;
- répartir une partie des charges d’une poutre sur ses poteaux d’extrémité ;
- cumuler les charges des niveaux supérieurs sur les poteaux alignés ;
- transférer les charges des poteaux vers les semelles alignées ;
- transférer la moitié du poids propre d’une longrine vers ses deux semelles ;
- traiter les escaliers comme une entité monolithique et transmettre G/Q vers des appuis géométriques ;
- calculer Gk, Qk, Nu et Nser par élément ;
- produire des sources de contributions et des avertissements de discontinuité.

### 2.6 Synthèse des résultats

La phase de synthèse comporte maintenant :

- regroupement par famille : poteaux, semelles, poutres, dalles, escaliers, voiles, longrines ;
- classement du plus sollicité au moins sollicité ;
- regroupement par proximité de Nu ;
- fiche détaillée de type **Structural Passport** ;
- affichage de G, Q, Nu, Nser, moment indicatif, section, appuis et sources ;
- coloration progressive des éléments ;
- identification du poteau et de la semelle critiques ;
- export local d’un PDF sans authentification obligatoire ;
- schéma dédié pour les escaliers dans le PDF.

### 2.7 Normes, pays et sol

Le projet contient déjà :

- les 54 pays africains dans la liste ;
- des profils pour plusieurs pays et villes ;
- une proposition de référentiel selon le pays ;
- des champs de localisation, climat, vent, neige et séisme ;
- des avertissements lorsque les données sont provisoires ;
- une bibliothèque simplifiée de types de sols ;
- un calcul indicatif de portance et de surface de semelle.

### 2.8 Qualité actuelle vérifiée

Au moment de l’audit :

- `pnpm check` passe ;
- `pnpm test` passe ;
- **34 fichiers de tests et 119 tests passent** ;
- `pnpm build` passe ;
- le bundle est généré correctement.

Ces résultats démontrent une bonne stabilité de la base actuelle. Ils ne démontrent pas encore la validité d’un calcul de structure complet.

## 3. Ce qui manque ou doit être renforcé

## 3.1 Manque critique : séparation entre charges, analyse et dimensionnement

Le moteur utilise encore des formules globales telles que `1,35 Gk + 1,50 Qk`, une chaîne plancher → poutre → poteau → fondation, et un moment indicatif de type `qL²/8`. Cette logique est utile pour une première synthèse, mais elle ne remplace pas les trois niveaux que les logiciels professionnels séparent explicitement :

1. **Pattern ou action de charge** : poids propre, revêtements, cloisons, exploitation, vent, neige, séisme, température, tassement, accidentel.
2. **Cas d’analyse** : statique linéaire, modale, spectrale, non linéaire, construction par phases, etc.
3. **Combinaison de calcul** : ELU, ELS caractéristique, fréquente, quasi-permanente, accidentelle et sismique.

ETABS documente explicitement cette séparation entre load patterns, load cases et load combinations, ainsi que la nécessité d’une source de masse pour l’analyse modale [1] [2]. RFEM utilise également un assistant de classification et de combinaison par situations de projet et annexe nationale [3].

### À développer

- un registre de cas de charges avec identifiant, nature, catégorie, unité, source et coefficient de poids propre ;
- une source de masse par niveau ;
- des coefficients ψ propres à la norme sélectionnée ;
- des situations de projet ;
- des combinaisons automatiques et manuelles ;
- la possibilité de désactiver ou modifier une combinaison ;
- l’affichage de la combinaison gouvernante par élément ;
- la traçabilité de chaque valeur jusqu’au cas de charge d’origine.

## 3.2 Manque critique : solveur de structure

Le projet ne possède pas encore de solveur matriciel de structure. Il n’existe pas de calcul global de :

- rigidité des barres et surfaces ;
- déplacements nodaux ;
- rotations ;
- réactions d’appui ;
- efforts normaux, tranchants et moments aux stations ;
- torsion ;
- contraintes ;
- redistribution des efforts ;
- stabilité globale.

La distribution actuelle par proximité géométrique doit donc être conservée comme **mode simplifié**, mais un mode **Analyse structurale** doit ensuite être ajouté. Ce mode devra assembler une matrice globale, appliquer les conditions aux limites, résoudre les cas de charge et restituer les efforts par combinaison.

## 3.3 Modèle analytique insuffisamment explicite

Les éléments graphiques et les éléments analytiques ne sont pas encore séparés. Un logiciel professionnel distingue généralement :

- nœuds analytiques ;
- barres analytiques ;
- surfaces analytiques ;
- sections ;
- matériaux ;
- appuis ;
- releases ou articulations ;
- excentrements ;
- diaphragmes ;
- maillage ;
- groupes de calcul.

### À développer

- génération d’un modèle analytique à partir de la géométrie graphique ;
- fusion des nœuds coïncidents avec tolérance ;
- contrôle des nœuds presque coïncidents ;
- création de nœuds aux intersections poutre-poutre et poutre-voile ;
- appuis articulés, encastrés, ressorts et appuis élastiques ;
- releases de moments et efforts ;
- excentrements de barres ;
- diaphragmes rigides ou semi-rigides ;
- contrôle de connectivité avant calcul ;
- détection des mécanismes et degrés de liberté non bloqués.

## 3.4 Dalles et voiles : géométrie encore trop simplifiée pour l’analyse

La dalle est actuellement modélisée comme un rectangle de distribution. Le voile est encore traité dans le moteur de propagation comme un élément linéaire comparable à une poutre. Cela ne suffit pas pour une analyse réaliste de panneaux, voiles et planchers.

SCIA met en avant les panneaux de charge, la distribution unidirectionnelle ou bidirectionnelle, le maillage automatique avec raffinements locaux, les résultats de niveaux et les efforts de surface [4].

### À développer

- polygones de dalles non rectangulaires ;
- ouvertures dans les dalles ;
- trémies et réservations ;
- dalles avec portée réelle et appuis partiels ;
- sens de portée explicite ;
- diaphragmes ;
- maillage de dalles ;
- maillage des voiles ;
- ouvertures et linteaux dans les voiles ;
- efforts membranaires et de flexion des surfaces ;
- distribution de charge vérifiable graphiquement.

## 3.5 Charges encore incomplètes

Le catalogue contient plusieurs familles, mais leur application réelle au modèle reste incomplète. Les éléments suivants manquent ou sont seulement représentés par des valeurs de cadrage :

- poids des murs réellement associés à une poutre ou à une dalle ;
- charges linéaires de cloisons implantées sur une ligne ;
- charges ponctuelles d’équipements ;
- charges surfaciques localisées ;
- charges de garde-corps, acrotères et parapets ;
- charges de toiture par zones ;
- charges de pluie et accumulation d’eau ;
- charges thermiques ;
- tassements imposés ;
- charges accidentelles détaillées ;
- actions de chantier ;
- charges horizontales appliquées aux voiles et portiques ;
- excentricités et couples appliqués ;
- réduction de charge d’exploitation par niveaux ;
- poids propre contrôlé par un seul cas, pour éviter le double comptage.

Le modèle ETABS rappelle notamment que le poids propre doit être inclus dans un seul pattern avec un multiplicateur adapté, et qu’un pattern seul ne crée pas de réponse sans cas d’analyse [2]. Cette règle doit être reprise explicitement dans GcBtp.

## 3.6 Vent, neige et séisme : actuellement provisoires

Le code possède des profils climatiques et des facteurs par pays ou ville, mais ceux-ci restent principalement des coefficients de cadrage. Ils ne constituent pas encore une génération réglementaire complète.

### Vent à développer

- vitesse de base et période de retour ;
- catégorie de terrain ;
- hauteur et forme du bâtiment ;
- coefficients de pression extérieure et intérieure ;
- zones de façade et toiture ;
- directions X et Y ;
- génération des charges par niveau ou par surface ;
- torsion accidentelle ;
- combinaisons vent avec les charges gravitaires.

### Neige à développer

- zone de neige ;
- altitude ;
- coefficient de forme ;
- accumulation et redistribution ;
- toiture accessible ou non ;
- cas dissymétriques ;
- combinaisons réglementaires.

### Séisme à développer

- zone sismique ;
- classe de sol ;
- spectre de réponse ;
- masse sismique ;
- facteur de comportement ;
- amortissement ;
- analyse modale ;
- participation massique ;
- combinaison modale ;
- torsion accidentelle ;
- dérives d’étage ;
- forces de niveau ;
- effets P-Delta ;
- critères de régularité.

## 3.7 Dimensionnement et ferraillage non encore professionnels

Le fichier `indicative-checks.ts` confirme que les contrôles actuels sont explicitement indicatifs : poutre simplement appuyée, compression centrée de poteau, bande unitaire de dalle, coefficients simplifiés et absence d’élancement ou de moments biaxiaux.

### Poutres

Il manque :

- flexion simple et composée ;
- effort tranchant ;
- torsion ;
- fissuration ;
- flèche instantanée et différée ;
- redistribution ;
- ancrages et recouvrements ;
- armatures minimales et maximales ;
- zones d’appui et de travée ;
- dispositions sismiques ;
- choix et proposition de barres réelles.

### Poteaux

Il manque :

- interaction N-Mx-My ;
- élancement ;
- flambement ;
- second ordre ;
- imperfections ;
- effets biaxiaux ;
- armatures longitudinales et transversales ;
- confinement ;
- vérification sismique ;
- continuité entre niveaux ;
- longueur de flambement configurable.

### Dalles

Il manque :

- méthode de calcul compatible avec la géométrie réelle ;
- flexion dans les deux directions ;
- poinçonnement ;
- cisaillement ;
- flèche ;
- fissuration ;
- armatures de nappe supérieure et inférieure ;
- renforts autour des poteaux et ouvertures ;
- poutrelles et entrevous réellement paramétrés pour les corps creux.

### Semelles et fondations

Le moteur actuel calcule surtout une surface et une pression moyenne. Il manque :

- pression sous semelle avec N, Mx et My ;
- aire efficace en cas d’excentricité ;
- décollement partiel ;
- glissement ;
- renversement ;
- poinçonnement ;
- cisaillement unidirectionnel ;
- flexion de la semelle ;
- vérification des attentes et ancrages ;
- tassement total et différentiel ;
- interaction entre semelles reliées par longrines ;
- semelles filantes réelles ;
- radier ;
- pieux et groupes de pieux ;
- sol stratifié et nappe réellement pris en compte.

## 3.8 Normes et données pays à fiabiliser

La liste des pays est présente, mais plusieurs fiches affichent correctement un statut « à confirmer ». Il ne faut pas transformer ces propositions en automatisation silencieuse.

À développer :

- registre versionné des normes ;
- annexe nationale sélectionnable ;
- date d’édition ;
- source officielle ;
- domaine de validité ;
- unité et coefficient par formule ;
- journal des changements normatifs ;
- blocage de l’export « note de calcul exécutoire » tant que le référentiel est provisoire ;
- validation manuelle par l’ingénieur ;
- import de paramètres de l’étude géotechnique ;
- distinction claire entre valeur saisie, valeur calculée, valeur par défaut et valeur provisoire.

## 3.9 Rapport PDF à unifier

Le flux récent de synthèse produit des groupes et une fiche détaillée, mais `shared/load-report.ts` contient encore une génération de rapport plate, basée sur des lignes textuelles et un total ELU indicatif. Il existe donc un risque de divergence entre :

- le moteur ;
- l’aperçu de synthèse ;
- le rapport texte ;
- le PDF local ;
- la fiche élément.

### À développer

- une seule structure de données de rapport ;
- rendu identique entre aperçu et PDF ;
- page de garde ;
- hypothèses et limites ;
- nomenclature des éléments ;
- plans 2D par niveau ;
- vue 3D ;
- diagrammes de charges ;
- tableaux triables ;
- combinaisons gouvernantes ;
- passeport de chaque élément ;
- unités et décimales configurables ;
- pagination et marges professionnelles ;
- historique de version du modèle ;
- signature et validation de l’ingénieur ;
- distinction visible entre résultat indicatif et résultat réglementaire.

SCIA met en avant des rapports avec tableaux, images, formules, références normatives, niveaux de détail et mise à jour après modification du modèle [4]. C’est le niveau de traçabilité à viser.

## 3.10 Persistance et architecture applicative

Le modèle Bâtiment est concentré dans un composant de plus de 3 400 lignes. Cette organisation accélère le prototype, mais elle devient risquée pour une application professionnelle.

À développer :

- séparation `BuildingModel`, `GridEditor`, `ElementPlacement`, `ElementProperties`, `Building3DView`, `AnalysisSetup`, `ResultsSynthesis`, `ReportPreview` ;
- schéma de données versionné ;
- migrations de modèle ;
- sauvegarde serveur durable ;
- synchronisation et reprise après erreur ;
- autosave ;
- journal d’actions ;
- import/export de modèle ;
- validation de schéma avant calcul ;
- gestion de conflits ;
- mode hors ligne Android si nécessaire.

La sauvegarde actuelle par `sessionStorage` est suffisante pour une maquette locale, mais pas pour un projet d’ingénierie durable.

## 3.11 Interopérabilité absente

Les logiciels professionnels proposent des échanges de modèle et des tableaux d’exploitation. SCIA mentionne notamment IFC, DWG, SAF et l’échange avec des outils BIM [4].

À prévoir :

- export/import JSON versionné ;
- CSV des niveaux, éléments, sections, charges et résultats ;
- export IFC structure ;
- import de fond de plan DXF/DWG si possible ;
- SAF pour échange analytique ;
- export vers Excel ;
- import de rapport géotechnique sous forme de paramètres vérifiés ;
- API interne pour les futurs modules de devis et ferraillage.

## 3.12 Contrôle qualité insuffisant pour un logiciel de calcul

Les 119 tests actuels sont une base positive, mais ils couvrent surtout des fonctions unitaires et des scénarios ciblés. Il manque :

- tests E2E du parcours complet Android ;
- tests de non-régression visuelle 2D/3D ;
- tests de conservation d’énergie et de charge ;
- tests de conservation de la géométrie après modification d’axes ;
- tests de duplication multi-niveaux ;
- tests de connectivité analytique ;
- benchmarks connus avec solution manuelle ;
- comparaison de cas de référence avec RSA/ETABS ou calcul manuel ;
- tests de cohérence des unités ;
- tests de double comptage du poids propre ;
- tests de combinaison ;
- tests de stabilité et de mécanismes ;
- tests de génération de PDF et de cohérence aperçu/PDF.

## 4. Feuille de route recommandée

### Phase 0 — Stabilisation et périmètre

**Objectif :** empêcher le produit de donner une fausse impression de calcul réglementaire.

1. Afficher clairement le statut « Pré-étude » pour les fonctions non solveur.
2. Ajouter une page de pré-vérification avant calcul.
3. Bloquer le calcul si la géométrie est incomplète ou déconnectée.
4. Unifier les unités internes en SI : m, kN, kN/m, kN/m², kN·m.
5. Écrire un schéma de données versionné.
6. Séparer rapport indicatif et rapport réglementaire.
7. Conserver les 119 tests comme seuil de non-régression.

**Critères de sortie :** aucun résultat ne peut être interprété comme une note exécutoire si le référentiel, le sol ou le modèle analytique est incomplet.

### Phase 1 — Modèle analytique et qualité géométrique

**Objectif :** transformer la géométrie graphique en modèle calculable.

1. Créer les nœuds analytiques et les tolérances de fusion.
2. Créer les barres, surfaces et appuis analytiques.
3. Ajouter les intersections automatiques.
4. Ajouter les relâchements et excentrements.
5. Ajouter le contrôle de connectivité.
6. Ajouter un explorateur du modèle : niveaux, nœuds, barres, surfaces, appuis.
7. Afficher les erreurs directement dans la vue 2D/3D.
8. Stabiliser les escaliers comme surfaces inclinées reliées aux niveaux inférieur et supérieur.

**Critères de sortie :** chaque élément possède une représentation graphique, une représentation analytique et une liste d’appuis vérifiables.

### Phase 2 — Cas de charges et combinaisons

**Objectif :** reprendre la logique professionnelle de patterns, cas et combinaisons.

1. Créer les cas G, Q, cloisons, toiture, vent X, vent Y, neige, séisme X, séisme Y, thermique, tassement et accidentel.
2. Ajouter le multiplicateur de poids propre et interdire le double comptage.
3. Ajouter les sources de masse.
4. Ajouter les ψ et coefficients partiels selon la norme.
5. Générer les situations ELU, ELS et accidentelles.
6. Autoriser la création manuelle de combinaisons.
7. Afficher pour chaque résultat la combinaison gouvernante.
8. Afficher les charges appliquées graphiquement.

**Critères de sortie :** toute valeur G, Q, Nu, Nser, M ou V est traçable jusqu’à un cas de charge et une combinaison.

### Phase 3 — Descente de charges et solveur statique

**Objectif :** proposer un vrai calcul global, avec conservation du mode simplifié pour comparaison.

1. Conserver la descente tributaire comme mode rapide.
2. Ajouter un solveur de portiques 2D/3D pour les barres.
3. Ajouter la rigidité des sections et matériaux.
4. Résoudre déplacements et réactions.
5. Calculer N, V, M et T aux extrémités et stations.
6. Ajouter les surfaces avec maillage de base.
7. Comparer les résultats « tributaire » et « analytique ».
8. Afficher les écarts et leurs causes.

**Critères de sortie :** le même cas test produit des réactions équilibrées et des efforts internes cohérents avec une solution manuelle de référence.

### Phase 4 — Actions climatiques et sismiques

**Objectif :** remplacer les facteurs provisoires par des paramètres de calcul traçables.

1. Implémenter la génération du vent selon le référentiel choisi.
2. Implémenter la neige et la pluie selon la situation de toiture.
3. Implémenter le spectre sismique et la masse.
4. Ajouter l’analyse modale et la participation massique.
5. Ajouter les dérives inter-étages.
6. Ajouter les torsions accidentelles.
7. Ajouter P-Delta et les contrôles de régularité.
8. Documenter chaque paramètre et sa source.

**Critères de sortie :** les charges latérales sont visualisables par niveau, direction, zone et combinaison.

### Phase 5 — Dimensionnement béton armé

**Objectif :** préparer le module Ferraillage sans réutiliser les contrôles indicatifs actuels.

1. Définir matériaux, classes de béton, acier, enrobage et exposition.
2. Dimensionner les poutres en flexion, cisaillement et torsion.
3. Dimensionner les poteaux en N-Mx-My et second ordre.
4. Dimensionner les dalles en flexion, cisaillement, poinçonnement, flèche et fissuration.
5. Dimensionner les voiles en efforts membranaires, flexion et cisaillement.
6. Dimensionner les semelles sous N-Mx-My, pression, poinçonnement, cisaillement et flexion.
7. Dimensionner les longrines et semelles excentrées.
8. Générer les armatures proposées, vérifiables et modifiables.
9. Générer les plans de ferraillage et nomenclatures.

**Critères de sortie :** chaque ferraillage provient d’un effort de calcul identifié, d’une combinaison et d’une formule réglementaire documentée.

### Phase 6 — Géotechnique et fondations avancées

**Objectif :** sortir du simple calcul de pression moyenne.

1. Importer les paramètres de l’étude géotechnique.
2. Gérer les couches de sol.
3. Calculer portance ultime et admissible selon la méthode choisie.
4. Vérifier tassements et tassements différentiels.
5. Gérer nappe, drainage et profondeur d’assise.
6. Vérifier glissement et renversement.
7. Ajouter radier et pieux dans le catalogue de calcul.
8. Relier les réactions du solveur aux vérifications de fondation.

### Phase 7 — Résultats, rapports et interopérabilité

**Objectif :** produire une documentation professionnelle cohérente.

1. Utiliser une seule structure de rapport partagée par l’aperçu et le PDF.
2. Ajouter plans 2D, vue 3D, cartes de charges et diagrammes.
3. Ajouter tableaux par niveau, famille, combinaison et élément.
4. Ajouter les formules, hypothèses, coefficients et avertissements.
5. Ajouter export CSV, Excel, JSON et IFC.
6. Ajouter une version du modèle dans chaque rapport.
7. Ajouter une validation et une signature de l’ingénieur.
8. Ajouter un comparateur de versions et de résultats.

### Phase 8 — Industrialisation Android

**Objectif :** rendre le produit réellement exploitable sur Android.

1. Choisir une stratégie native ou hybride : PWA installable, Capacitor ou application Android dédiée.
2. Tester viewport 430 × 932 et tablettes Android.
3. Ajouter stockage local robuste et synchronisation serveur.
4. Ajouter export et partage de rapports depuis Android.
5. Gérer clavier numérique, saisie décimale, gestes tactiles et mode hors ligne.
6. Ajouter reprise après interruption et sauvegarde automatique.
7. Tester les performances sur appareils intermédiaires.

## 5. Prompt maître recommandé pour la suite

> **Rôle**  
> Agis comme un ingénieur structure senior et architecte logiciel spécialisé dans les logiciels de conception tels que Robot Structural Analysis, ETABS, SCIA Engineer et RFEM. Travaille uniquement sur le module **Bâtiment** de GcBtp. Ne modifie pas les autres modules et ne supprime aucune fonctionnalité déjà validée sans créer un point de restauration.
>
> **État de référence**  
> Le module possède déjà une modélisation 2D/3D d’un bâtiment Android-first avec niveaux, grille métrique, poteaux, poutres, dalles, semelles, semelles excentrées, voiles, longrines de redressement et escaliers monolithiques. Il possède une descente de charges simplifiée, une synthèse par familles et proximité de Nu, une fiche Structural Passport, une échelle de couleurs et un export PDF local. Le projet compile et 119 tests passent.
>
> **Limite actuelle à respecter**  
> La propagation actuelle est une descente tributaire simplifiée. Les contrôles de `indicative-checks.ts` sont indicatifs. Tant qu’un solveur et des vérifications réglementaires complètes ne sont pas implémentés, afficher clairement « pré-étude » et ne jamais présenter les résultats comme une note de calcul exécutoire.
>
> **Objectif général**  
> Faire évoluer le modèle Bâtiment vers un workflow professionnel en cinq couches :
>
> 1. modèle graphique ;
> 2. modèle analytique ;
> 3. cas de charges et combinaisons ;
> 4. analyse structurale ;
> 5. dimensionnement, ferraillage et rapport.
>
> **Règles d’ingénierie obligatoires**
>
> - Utiliser un système interne cohérent en m, kN, kN/m, kN/m² et kN·m.
> - Séparer poids propre, charges permanentes, charges variables, actions climatiques, actions accidentelles et séisme.
> - Séparer patterns de charge, cas d’analyse et combinaisons.
> - Inclure le poids propre dans un seul cas avec un multiplicateur explicite.
> - Générer et afficher les combinaisons ELU, ELS caractéristique, ELS fréquente, ELS quasi-permanente et accidentelle selon la norme choisie.
> - Conserver la source de chaque contribution de charge.
> - Générer un modèle analytique avec nœuds, barres, surfaces, appuis, relâchements, excentrements et maillage.
> - Contrôler la connectivité, les mécanismes, les éléments orphelins, les axes supprimés et les niveaux non alignés avant tout calcul.
> - Ne jamais inventer silencieusement un appui ou une charge manquante.
> - Afficher les avertissements à l’utilisateur avec une correction suggérée.
> - Conserver le mode tributaire rapide pour comparaison avec le solveur.
> - Ajouter les résultats N, V, Mx, My, T, déplacements, réactions, contraintes et combinaisons gouvernantes.
> - Prévoir les effets de second ordre, le flambement, les dérives, le poinçonnement, la fissuration, les flèches, les tassements, le glissement et le renversement.
> - Utiliser les profils de pays uniquement comme proposition tant que la norme et l’annexe nationale ne sont pas confirmées.
>
> **Ordre d’implémentation obligatoire**
>
> 1. stabiliser le schéma de données et sauvegarder le point de restauration ;
> 2. créer le modèle analytique et le pré-contrôle géométrique ;
> 3. créer les cas de charges, sources de masse et combinaisons ;
> 4. implémenter le solveur statique de barres ;
> 5. implémenter les surfaces et le maillage ;
> 6. implémenter vent, neige et séisme ;
> 7. implémenter le dimensionnement béton armé ;
> 8. implémenter les fondations et la géotechnique ;
> 9. unifier aperçu, passeport et PDF ;
> 10. ajouter les exports JSON, CSV, Excel, IFC et les tests Android.
>
> **Exigences de chaque livraison**
>
> - commencer par un audit des fichiers concernés ;
> - proposer les invariants physiques et géométriques ;
> - modifier seulement les fichiers nécessaires ;
> - ajouter des tests unitaires et des tests d’intégration ;
> - vérifier `pnpm check`, `pnpm test` et `pnpm build` ;
> - fournir un cas numérique de référence avec équilibre des charges ;
> - expliquer les hypothèses, unités, normes et limites ;
> - mettre à jour le rapport et la fiche Structural Passport ;
> - créer un checkpoint après chaque phase terminée ;
> - ne pas passer au ferraillage tant que les efforts internes et combinaisons ne sont pas fiables.
>
> **Critères d’acceptation finaux**
>
> - une modification d’axe ne déplace jamais un élément déjà créé ;
> - une duplication traduit réellement la géométrie au niveau choisi ;
> - une charge ne peut être comptée deux fois ;
> - la somme des réactions équilibre la somme des charges pour chaque cas ;
> - tout élément discontinu ou instable est signalé ;
> - les résultats 2D, 3D, Structural Passport et PDF sont identiques ;
> - chaque effort est relié à une combinaison ;
> - chaque ferraillage est relié à un effort et à une formule ;
> - tout résultat provisoire est identifié comme tel ;
> - aucun résultat n’est présenté comme exécutoire sans référentiel et validation appropriés.

## 6. Priorité immédiate recommandée

La prochaine étape ne devrait pas être le ferraillage. La priorité est :

1. **modèle analytique et pré-contrôle de connectivité ;**
2. **cas de charges et combinaisons ;**
3. **solveur statique de portiques ;**
4. **comparaison mode tributaire / mode analytique ;**
5. **puis seulement dimensionnement béton armé.**

Cette séquence évite de produire des armatures à partir de moments simplifiés qui ne tiennent pas compte de la rigidité réelle, des conditions d’appui, des redistributions, des efforts biaxiaux ou des combinaisons gouvernantes.

## Références de comparaison

[1]: https://docs.csiamerica.com/help-files/etabs/Getting_Started/Modeling_Process.htm "ETABS — Modeling Process"

[2]: https://docs.csiamerica.com/help-files/etabs/Menus/Define/Load_Patterns/Load_Patterns.htm "ETABS — Define Load Patterns"

[3]: https://www.dlubal.com/en/downloads-and-information/documents/online-manuals/rfem-6/000245 "RFEM 6 — Load Case Classification and Combination Wizard"

[4]: https://www.scia.net/en/scia-engineer/features "SCIA Engineer — Features, analysis, design and reporting"

Les références [1] et [2] documentent la séparation entre géométrie, propriétés, patterns, cas de charges, combinaisons, source de masse et contrôle des objets. La référence [3] documente la classification automatique des cas, les situations de projet, les annexes nationales et les combinaisons de résultats. La référence [4] documente les panneaux de charge, le maillage, les résultats par niveau, les contrôles non linéaires, le dimensionnement transparent et le rapport technique.
