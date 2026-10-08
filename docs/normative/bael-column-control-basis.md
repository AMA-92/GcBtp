# Base de règles BAEL — contrôles de poteaux

Note d’implémentation, pas une attestation de conformité ni une reproduction du texte normatif.

## Sources

- Cerema / DTRF, *Fascicule 62, titre I, section I — BAEL 91 révisé 99* (PDF institutionnel) : <https://piles.cerema.fr/IMG/pdf/fascicule_62_titre_i_section_1_cctg_1999_regles_bael_91_revise_99_cle243fbc.pdf>.
- Copie consultée pour lecture des équations et tableaux : *DTU P18-702, BAEL 91 révisées 99 + amendement A1*, édition CSTB indiquée dans le document (2000/2007), notamment pages imprimées 27, 54–55 et 67 : <https://www.sodibet.com/telechargement/BAEL%2091%20R%2099.pdf>. À recouper avec l’édition contractuelle intégrale.

## Formules et contrôles retenus

### Flexion composée avec compression — A.4.3,5

- Excentricité additionnelle : `ea = max(20 mm, l/250)`, avec `l` la longueur de la pièce.
- Dans la fiche poteau, `l` est préremplie depuis la hauteur déclarée du niveau, et non depuis la longueur analytique entre nœuds qui peut inclure des prolongements de raccordement. La valeur reste modifiable.
- Excentricité de premier ordre `e1` : excentricité des sollicitations de premier ordre augmentée de `ea`.
- Domaine de la méthode forfaitaire : `f/h < max(15, 20·e1/h)`, avec `f` la longueur de flambement et `h` la dimension de la section dans le plan de flambement.
- Pour l’interface actuelle, `f` est posé égal à `l` en interne : c’est une hypothèse d’appui équivalent, pas une conséquence générale du BAEL. Le texte BAEL demande d’évaluer `f` à partir des liaisons en extrémité et des déplacements possibles; cette détermination n’est pas automatisée ici.
- Dans ce domaine, `e2 = (3·f²/(10⁴·h))·(2 + α·φ)` (longueurs en mêmes unités). Le moment de calcul est déterminé avec `e = e1 + e2`.
- `α` est le rapport du moment de premier ordre dû aux charges permanentes et quasi-permanentes au moment total de premier ordre, calculés avant facteurs de combinaison; il est compris entre 0 et 1. `φ` est le rapport de déformation différée par fluage à la déformation instantanée; la valeur usuelle donnée est 2.
- Si le critère de domaine n’est pas satisfait, A.4.3,5 n’est pas une justification suffisante : l’analyse de stabilité A.4.4 prend le relais. Le seul échec du critère ne signifie pas automatiquement que la section est résistante ou non résistante.
- Pour A.4.4,2–3, la fiche résout un équilibre non linéaire du poteau isolé dans un mode sinusoïdal articulé, avec `f=l` comme hypothèse actuelle. Les moments de premier ordre issus de l’analyse globale sont supposés constants sur la hauteur; l’imperfection initiale est `max(20 mm, l/250)`. Les courbures des deux axes et l’effort axial sont résolus ensemble à chaque palier de charge.
- La section est intégrée par fibres avec sections planes, béton tendu négligé, parabole-rectangle de calcul BAEL pour le béton, diagramme acier de calcul `Es=200 000 MPa` limité à `fyd`, limites de raccourcissement béton de `3,5 ‰` en flexion et `2 ‰` en compression simple, limite d’allongement acier `10 ‰`, et fluage `1+αφ` appliqué à l’axe des déformations du béton selon A.4.4,32. Les paramètres par défaut sont `α=1`, `φ=2`; la stabilité requiert une rigidité tangentielle positive après prise en compte de l’effort normal.
- Ce modèle est une pré-vérification du poteau isolé et de ses moments enveloppes. Il ne démontre pas la stabilité globale de l’ossature, ne recalcule pas la redistribution des efforts d’un modèle de structure dont la section candidate a changé, et ne remplace pas un diagramme normatif complet d’interaction N–Mx–My ni la vérification indépendante du projet par un ingénieur.

### Adhérence/ancrage droit — A.2.1,12 et A.6.1,21–221

- Pour `fcj ≤ 60 MPa`, `ftj = 0,6 + 0,06·fcj` (MPa).
- Pour une barre HA, `τsu = 0,6·ψs²·ftj`; `ψs` vaut généralement 1,5 pour une barre HA.
- Scellement droit : `ls = φbar·fe/(4·τsu)`. Pour `fc28 = 25 MPa`, `Fe E 500` et `ψs=1,5`, le tableau BAEL donne `ls/φbar = 44`; cela constitue un test de cohérence utile.
- La fiche demande la longueur droite disponible en tête et en pied et compare la plus petite à la longueur requise. Si une des mesures manque, le check est bloqué; si la longueur disponible est inférieure, il échoue.
- Cette comparaison ne vérifie pas encore la géométrie complète du nœud/fondation, le confinement local, les armatures de couture contre l’éclatement, ni les longueurs de recouvrement. Le statut satisfaisant porte uniquement sur l’inégalité de longueur de scellement droit A.6.1,221.

### Détails des pièces comprimées — A.8.1,21–3

- Armatures longitudinales minimales : au moins `4 cm²` par mètre de longueur de paroi mesurée perpendiculairement aux barres, et au moins `0,2 %` de la section de béton comprimé. Maximum `5 %` hors zones de recouvrement.
- Pour une section rectangulaire, distance maximale entre barres voisines sur une même face : le minimum entre `petit côté + 100 mm` et `400 mm`. Sections polygonales : au moins une barre à chaque angle; sections circulaires : six barres uniformément réparties sont recommandées.
- Cadres : ceinture continue sur le contour, sans angle rentrant ni recouvrement parallèle à la paroi; tenir les barres longitudinales de `20 mm` et plus. Les barres comprimées comptées en résistance doivent être maintenues à un espacement transversal n’excédant pas `15·φlong`.
- Diamètre des cadres : valeur normalisée la plus proche de `φlong,max/3`. Pas maximal : minimum de `15·φlong`, `400 mm` et `petite dimension de section + 100 mm`. Si plus de la moitié des barres sont recouvertes dans une zone, au moins trois cours de cadres doivent se trouver sur le recouvrement.

## Règle de prudence produit

Le moteur peut calculer les quantités ci-dessus et les tester numériquement. Un résultat de tests logiciel n’est pas une validation indépendante par cas de référence, et encore moins une certification du logiciel. Les méthodes BAEL antérieures, notamment `M0 + N·e2` calculé par courbure nominale Eurocode ou un seuil arbitraire `λ ≤ 15`, ne doivent pas être présentées comme le contrôle BAEL A.4.3,5.
