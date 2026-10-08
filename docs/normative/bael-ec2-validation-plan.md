# Plan de validation normative — BAEL 91 révisé 99 / Eurocode 2

**État au 8 octobre 2026 — note de cadrage logiciel, pas une attestation de conformité.**

## Décision de périmètre

- **Référentiel de calcul : français**, pour la France et les projets africains couverts par GcBtp, conformément au choix de l’utilisateur. Le pays du projet indique le lieu du chantier; il ne sélectionne pas un code national africain. L’application ne prétend pas que le référentiel français constitue la loi ou la norme nationale du pays concerné. Les actions et paramètres liés au site (vent, neige, séisme, sol, géotechnique) restent à justifier pour le lieu réel.
- **Valeur par défaut de l’application : BAEL 91 modifié/révisé 99**, conformément au choix demandé. C’est un défaut logiciel/historique, pas une conclusion juridique sur l’applicabilité du BAEL au projet. AFNOR marque DTU P18-702 et son modificatif A1 comme annulés. Le contrat, le CCTP, la juridiction, le type d’ouvrage et la date de référence restent déterminants.
- **Alternative sélectionnable : Eurocode 2 — France.** Il faut fixer une édition EN et une annexe nationale de même génération, vérifier leur statut au jour du projet et les dispositions de transition. Ne pas mélanger les paramètres de la première et de la deuxième génération.
- **Aucune “certification du moteur” n’est acquise.** Il faut les textes normatifs intégraux autorisés, une suite de calculs de référence, une vérification indépendante par un ingénieur compétent et, si une certification logicielle formelle est visée, un organisme et un protocole d’évaluation définis.

## État documentaire et implications

AFNOR indique que le DTU P18-702/A1 (modificatif de février 2000) est annulé et incorporé à l’édition correspondante; sa fiche le rattache à NF EN 1992-1-1. La fiche AFNOR consultée décrit le BAEL de base comme applicable à des bétons de granulats naturels normaux et exclut notamment le béton non armé, certains bétons légers/caverneux/cellulaires armés, le béton de résistance supérieure à 60 MPa et certains ouvrages ou ambiances spécifiques. Le document Cerema/DTRF sur le Fascicule 62 de 1999 précise que l’annexe F pour 40–80 MPa n’est pas automatiquement applicable et doit être prescrite au CCTP. Ces indications de périmètre ne remplacent pas la lecture de l’édition contractuelle complète.

Pour l’Eurocode 2, la fiche AFNOR consultée référence NF EN 1992-1-1:2005 (parenté EN 1992-1-1:2004) et affiche une annulation ultérieure en octobre 2026. La notice AFNOR du projet d’annexe nationale associée à l’EN ratifiée en novembre 2023 et mise à disposition en novembre 2025 indique une enquête clôturée le 20 janvier 2026 et une publication **prévue** le 12 mai 2027. Le JRC publie le calendrier de deuxième génération : disponibilité aux organismes nationaux au plus tard le 30 mars 2026, publication nationale au plus tard le 30 septembre 2027 et retrait des normes nationales contradictoires au plus tard le 30 mars 2028. Ces dates de calendrier ne remplacent pas la vérification du catalogue AFNOR ni les règles de transition du marché.

**Conséquence produit :** l’option Eurocode 2 reste une option de pré-étude; le couple EN+NA applicable doit être confirmé. Le statut d’édition ne doit jamais être déduit du seul intitulé « Eurocode 2 ».

## Contrôles normatifs à couvrir

### 1. Base du projet et actions

- Pays, commune/site, date de référence, type d’ouvrage, contrat/CCTP et référentiel contractuel explicite.
- Code, partie, édition, amendements, errata, annexe nationale/paramètres nationaux et statut documentaire, versionnés dans le dossier de calcul.
- Matériaux (béton, acier, classe/nuance, âge), géométrie cotée, enrobage, exposition, durée de vie, feu/séisme si applicables, conditions d’appui et modèle global.
- Charges permanentes et variables, vent, neige, séisme, situations accidentelles et combinaisons cohérentes avec le référentiel sélectionné; traçabilité de la source de chaque intensité et coefficient.
- Toute donnée essentielle absente doit produire un état **à confirmer/bloqué**, pas une conformité par défaut.

### 2. Poteaux

- Enveloppes simultanées de N, Mx et My par combinaison, avec conventions de signe, sections critiques et sollicitations d’extrémité.
- Résistance de section en flexion composée déviée par équilibre/compatibilité ou méthode normative documentée; ne pas réduire la vérification à une capacité axiale ou à des moments indépendants G/Q.
- Élancement dans les deux axes, longueur efficace, stabilité globale (structure contreventée/non contreventée), imperfections et justification de toute négligence du second ordre.
- Si nécessaire : effets du second ordre, fissuration/rigidité, fluage et effets de durée, selon la méthode et le domaine d’application du texte retenu.
- Minimum/maximum d’armatures, disposition, barres longitudinales, cadres, maintien des barres comprimées, espacement, enrobage et constructibilité.

### 3. Poutres et longrines

- Flexion positive/négative, effort normal, armatures longitudinales et sections critiques aux appuis/charges concentrées.
- Cisaillement, besoin et disposition des armatures transversales, limite des bielles comprimées et ancrage des étriers.
- Torsion lorsqu’elle ne peut être négligée, interaction torsion–cisaillement et armatures associées.
- ELS : fissuration, contraintes/flèche instantanée et différée, fluage/retrait lorsque requis.
- Ancrages, recouvrements, arrêts/relevés, enrobage, espacements et faisabilité du bétonnage.
- Une longrine participant à une fondation requiert en plus le contrôle de l’interaction sol–structure; le calcul BA seul ne valide ni la portance ni les tassements.

### 4. Dalles, escaliers et poinçonnement

- Modèle unidirectionnel/bidirectionnel adapté, appuis, continuités, trémies, portées et charges; moments positifs/négatifs dans chaque direction.
- Flexion ELU, cisaillement unidirectionnel près des appuis, et poinçonnement aux poteaux/charges concentrées (géométrie des périmètres, excentricités, ouvertures, armatures nécessaires et périmètre extérieur).
- ELS fissuration et flèche, rigidité fissurée/effets différés lorsque requis.
- Armatures principales/de répartition, ancrage et recouvrement des volées, paliers, appuis et abouts.

### 5. Semelles et géotechnique

- Côté béton : flexion dans les deux directions, cisaillement, mécanisme local/poinçonnement applicable, transfert poteau-semelle, attentes/ancrages, armatures et dispositions d’exécution.
- Côté sol, dans un module et un référentiel géotechnique distincts : excentricité et surface efficace, portance ELU, glissement, stabilité/renversement lorsqu’applicable, tassements total/différentiel et rotations ELS.
- Une étude de sol et ses paramètres (stratigraphie, nappe, résistance, déformabilité, agressivité et critères de déplacement admissible) sont indispensables; une contrainte admissible générique ne suffit pas.

## Exemples de référence pour la validation

### Poinçonnement EC2 — exemple pédagogique JRC (première génération, 2011)

Le support JRC/CEN « Limit state design and verification » présente un exemple de poteau B2 : charge verticale annoncée 705 kN, poteau 500 × 500 mm, dalle 210 mm, enrobage illustratif 30 mm, barres Ø16, profondeur utile moyenne 164 mm et facteur d’excentricité simplifié β = 1,15. Il donne vEd = 1,22 MPa et vRd,c = 0,67 MPa, d’où un besoin d’armatures de poinçonnement dans l’exemple. Ce cas est un **candidat de test de non-régression pédagogique**, pas une règle actuelle ni une preuve de conformité française. Le support comporte une incohérence typographique/OCR dans une expression de coefficient; vérifier visuellement le document et recalculer depuis le texte EN+NA exact avant d’enregistrer un résultat de référence.

### BAEL 91 révisé 99

Le PDF institutionnel Cerema/DTRF du Fascicule 62, titre I, section I, reproduit le BAEL 91 révisé 99 et son rapport de présentation. Il sert à retracer le corpus historique et à préparer un jeu d’exemples BAEL; il ne constitue pas à lui seul une suite de résultats attendus, ni une certification du logiciel. Aucun cas numérique BAEL complet avec résultat indépendant n’est déclaré validé dans ce dépôt à ce stade.

### Protocole de validation avant toute revendication de conformité

1. Obtenir et identifier légalement les éditions intégrales et annexes nationales retenues; relever pour chaque formule/paramètre la clause, le symbole, l’unité, l’édition et la source.
2. Construire des cas de référence avec résultats indépendants publiés ou revus/calculés indépendamment par un ingénieur; documenter toutes les hypothèses et arrondis.
3. Ajouter des tests limites et de sensibilité : N pur, flexion uniaxiale/biaxiale, inversion d’axes, changements de section, cas proche de la résistance, franchissement du domaine de négligence du second ordre, ancrage/recouvrement insuffisant, cisaillement/torsion, poinçonnement avec bord/ouverture/excentricité, semelle excentrée et tassement.
4. Comparer les résultats numériques et l’armature sélectionnée aux références; justifier tout écart avant de publier une version.
5. Faire relire les sorties, les détails et le registre de clauses par un ingénieur indépendant; consigner la version du moteur, les entrées et le visa externe éventuel.

## Écarts constatés dans le dépôt avant validation complète

- Le sélecteur BAEL par défaut et l’option Eurocode 2 existaient, mais ne démontraient pas deux moteurs normatifs indépendamment validés.
- Le programme de charges utilise le catalogue français d’actions et de coefficients lorsque BAEL est sélectionné. Cette base de combinaisons est **validée pour le projet** et affichée comme telle; cela ne vaut pas certification globale du moteur BAEL ni validation automatique des contrôles distincts de résistance, de second ordre, d’ancrage ou de détail.
- Les contrôles de détails, ancrages, second ordre, torsion, poinçonnement et géotechnique doivent être couverts et testés par familles; un écran vert ne doit pas masquer un contrôle non implémenté ou une donnée manquante.
- Les profils pays utilisent désormais explicitement les références françaises pour la France et les pays africains, sans les présenter comme codes nationaux africains; les projets hors périmètre restent à confirmer.

## Sources consultées

1. AFNOR, [DTU P18-702/A1 — BAEL 91, modificatif n° 1](https://www.boutique.afnor.org/fr-fr/norme/dtu-p18702-a1/regles-bael-91-regles-techniques-de-conception-et-de-calcul-des-ouvrages-et/fa107335/60838) — statut et historique du modificatif.
2. AFNOR, [NF EN 1992-1-1](https://www.boutique.afnor.org/fr-fr/norme/nf-en-199211/eurocode-2-calcul-des-structures-en-beton-partie-11-regles-generales-et-reg/fa039724/25784) — édition affichée, annexe nationale nécessaire et échéance d’annulation publiée.
3. AFNOR Norm’Info, [projet NF EN 1992-1-1/NA](https://norminfo.afnor.org/norme/pr-nf-en-1992-1-1na/eurocode-2-calcul-des-structures-en-beton-partie-1-1-regles-generales-et-regles-pour-les-batiments-annexe-nationale-a/214424) — état du projet français et date prévisionnelle de publication.
4. Commission européenne/JRC, [Second Generation of the Eurocodes](https://eurocodes.jrc.ec.europa.eu/second-generation-eurocodes) — calendrier européen de disponibilité, publication nationale et retrait.
5. Cerema/DTRF, [Fascicule 62, titre I, section I — BAEL 91 révisé 99 (PDF)](https://piles.cerema.fr/IMG/pdf/fascicule_62_titre_i_section_1_cctg_1999_regles_bael_91_revise_99_cle243fbc.pdf) — reproduction historique institutionnelle et rapport de présentation.
6. Commission européenne/JRC, [Limit state design and verification — support Eurocode 2](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/04_EC2WS_Walraven_ULSSLS.pdf) — exemple pédagogique de poinçonnement décrit ci-dessus.

> Cette note ne certifie ni GcBtp, ni un projet, ni le choix d’un référentiel. Toute utilisation de conception réelle doit être cadrée par le marché et revue par un professionnel compétent, avec les textes normatifs intégraux applicables.
