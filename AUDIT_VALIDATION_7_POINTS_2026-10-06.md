# Audit de validation des 7 points — GcBtp

**Date :** 2026-10-06  
**Référentiel déclaré :** Eurocodes structuraux avec annexes nationales françaises  
**Portée :** audit du code et des tests présents dans le dépôt, pas certification réglementaire.

## Verdict global

| Point | Verdict | Conclusion |
|---|---|---|
| 1. Éditions et annexes nationales françaises | **Partiellement validé** | Le code exige une annexe et une source, mais aucune édition précise ni table de clauses française n’est vérifiée. |
| 2. Coefficients et paramètres du projet | **Partiellement validé** | Les paramètres sont saisis, contrôlés numériquement et utilisés, mais restent génériques/provisoires et non rattachés clause par clause. |
| 3. Ancrages et recouvrements | **Partiellement validé** | Les contrôles sont explicitement bloqués ou remplacés par des proxys ; `l_b,rqd`, `l_bd` et `l_0` ne sont pas calculés. |
| 4. Zones critiques et confinement sismique | **Partiellement validé** | Un contrôle paramétrique DCL/DCM/DCH existe, mais les zones critiques, crochets, cadres, nœuds, voiles et capacité design ne sont pas complètement traités. |
| 5. Interaction torsion–cisaillement | **Non validable** | Les résistances au cisaillement et à la torsion sont calculées séparément ; aucune interaction `V–T` n’est implémentée ni testée. |
| 6. Second ordre et interactions avancées | **Partiellement validé** | Un contrôle de courbure nominale et un P-Delta simplifié existent, mais l’interaction PMM, le fluage, les imperfections et la rigidité fissurée ne sont pas complets. |
| 7. Cas de référence et validation indépendante | **Partiellement validé** | Les tests internes réussissent, mais aucun benchmark externe rattaché à une édition/annexe et aucun contre-calcul signé ne sont fournis. |

## Détail des vérifications

### 1. Éditions et annexes nationales françaises — partiellement validé

**Constaté dans le code :**

- `validateRCNormSelection` exige une annexe/règle locale et une référence textuelle ;
- le profil France affiche désormais NF EN 1990/1991/1992/1997/1998 ;
- `regulatoryReady` reste fixé à `false` et le résultat est « calculé numériquement — non certifié » ;
- les tests de résolution Eurocode/BAEL et de profil France réussissent.

**Blocage :**

- aucune édition exacte et datée n’est sélectionnée ;
- aucune annexe nationale française publiée n’est confrontée clause par clause ;
- les chaînes « France », « NF EN » et « éditions à confirmer » ne constituent pas une preuve documentaire.

**Action nécessaire :** fournir les éditions exactes, les annexes nationales utilisées, les clauses/pages applicables et construire une table de correspondance norme → paramètre → contrôle.

### 2. Coefficients et paramètres — partiellement validé

**Constaté dans le code :**

- les valeurs `fck`, `fyk`, `γc`, `γs`, `αcc`, enrobage, taux d’armatures, adhérence, espacements, flèche, élancement et `wk,max` sont saisissables ;
- des contrôles de présence, positivité et cohérence sont réalisés ;
- ces paramètres alimentent effectivement les calculs de flexion, cisaillement, poteaux, torsion et fissuration.

**Blocage :**

- plusieurs valeurs restent des valeurs de pré-étude : `γc=1,50`, `γs=1,15`, `αcc=0,85`, `wk,max=0,30 mm`, etc. ;
- certaines formules utilisent des coefficients internes par défaut (`cotθ`, `ν`, `αcw`, `Es`, facteurs de courbure) ;
- `bondStressMpa` est demandé mais n’est pas utilisé pour calculer un ancrage ;
- les valeurs ne sont pas prouvées comme étant celles de l’édition/annexe française du projet.

**Action nécessaire :** rattacher chaque paramètre à une clause, une édition, une annexe, une classe d’exposition ou un document projet, puis bloquer les valeurs non sourcées.

### 3. Ancrages et recouvrements — partiellement validé

**Constaté dans le code :**

- les poutres, semelles et escaliers produisent explicitement des contrôles bloqués ;
- les voiles utilisent un proxy `40ϕ`, non relié à l’adhérence réelle ;
- les tests vérifient principalement que le blocage est conservé.

**Non couvert :**

- `l_b,rqd` ;
- `l_bd` ;
- longueur de recouvrement `l_0` ;
- position d’adhérence ;
- confinement ;
- crochets et formes ;
- pourcentage de barres recouvertes ;
- décalage des recouvrements ;
- continuité réelle et zones de détail.

**Action nécessaire :** implémenter ces règles par élément et par cas de détail, avec paramètres normatifs et tests numériques de cas limites.

### 4. Zones critiques et confinement sismique — partiellement validé

**Constaté dans le code :**

- un contrôle paramétrique de classe `DCL`, `DCM` ou `DCH` existe ;
- le taux longitudinal minimal, l’espacement limite et une longueur indicative de confinement sont calculés ;
- le contrôle est raccordé aux poutres et poteaux lorsque l’option sismique est activée ;
- les tests paramétriques passent.

**Blocage :**

- `column-ties` reste explicitement bloqué ;
- les zones critiques ne sont pas localisées ni détaillées ;
- les crochets, branches, ancrages, recouvrements, maintien des barres, nœuds poutre-poteau et hiérarchie des résistances ne sont pas vérifiés ;
- les voiles et éléments de rive restent simplifiés ;
- l’analyse globale ne traite pas complètement diaphragme, torsion, couplage et P-Delta sismique.

**Action nécessaire :** appliquer l’édition EN 1998 et l’annexe française aux zones critiques, au confinement, aux nœuds, aux voiles et aux contrôles de capacité design.

### 5. Interaction torsion–cisaillement — non validable

**Constaté dans le code :**

- `VEd` est vérifié séparément ;
- `TEd` est vérifié séparément par `TRd,max`, `TRd,s` et `Asl` ;
- les deux résultats peuvent être simultanément satisfaisants sans qu’aucun critère combiné ne soit produit ;
- les tests ne contiennent aucun cas `VEd + TEd` de référence.

**Manque critique :**

- aucune interaction `V–T` ;
- aucune réduction croisée des résistances ;
- aucune compatibilité des bielles comprimées sous actions combinées ;
- aucun dimensionnement conjoint des cadres fermés ;
- aucune enveloppe d’interaction testée.

**Action nécessaire :** implémenter explicitement l’interaction normative torsion–cisaillement de l’édition retenue, puis ajouter des tests combinés et des cas limites. Ce point ne peut pas être déclaré validé dans l’état actuel.

### 6. Second ordre et interactions avancées — partiellement validé

**Constaté dans le code :**

- un calcul de courbure nominale produit `e₂`, `M₂Ed`, `MEd` et un facteur d’amplification ;
- le solveur spatial possède une itération P-Delta et un indice de stabilité ;
- les tests unitaires vérifient des valeurs finies et une amplification positive.

**Blocage :**

- le moment amplifié n’est pas réinjecté complètement dans le ferraillage et l’interaction PMM ;
- l’interaction `N–Mx–My` reste une somme linéaire simplifiée ;
- la compatibilité des déformations et la surface d’interaction complète ne sont pas implémentées ;
- fluage, imperfections, rigidité fissurée, longueur de flambement et conditions d’extrémité ne sont pas justifiés de manière normative ;
- aucun benchmark P-Delta indépendant n’est fourni.

**Action nécessaire :** figer la méthode EN 1992 applicable, implémenter l’interaction PMM par compatibilité et rattacher tous les paramètres à l’édition/annexe concernée.

### 7. Cas de référence et validation indépendante — partiellement validé

**Constaté dans le code :**

- la suite complète réussit : **59 fichiers de tests et 285 tests** ;
- des cas analytiques internes existent pour portiques, plaques, charges, séisme, torsion et contrôles BA ;
- les garde-fous et statuts bloqués sont testés.

**Limite :**

Les tests prouvent la cohérence interne du logiciel, mais pas la conformité réglementaire. Il manque :

- un cas publié et traçable par norme, édition et annexe ;
- un résultat attendu indépendant et une tolérance d’acceptation ;
- un contre-calcul indépendant ;
- une validation par un tiers ou un ingénieur structure ;
- un dossier de matériaux, charges, sol et prescriptions locales correspondant à un projet réel.

**Action nécessaire :** créer une bibliothèque de benchmarks externes documentés et faire vérifier les résultats par un ingénieur structure qualifié.

## Conclusion exécutoire

Le dépôt est **techniquement cohérent comme moteur de pré-étude paramétrique**, mais les 7 points ne sont pas tous validés réglementairement :

- **6 partiellement validés** ;
- **1 non validable : l’interaction torsion–cisaillement** ;
- **aucune certification réglementaire** ;
- `regulatoryReady` doit rester `false`.

L’audit n’a modifié aucun fichier de calcul. Il confirme que les contrôles non démontrés restent bloquants, ce qui est le comportement correct pour éviter une fausse déclaration de conformité.
