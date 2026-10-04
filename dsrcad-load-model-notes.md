# Références de logique de chargement

La page officielle DSRCAD présente l’application comme un outil de dimensionnement des poteaux, poutres, semelles et planchers, avec export de notes de calcul et dimensionnement d’escaliers. La recherche du 22 août 2026 a également identifié la présentation DSRCAD v1.3.0 indiquant une descente automatique des charges des planchers vers les fondations.

Pour GcBtp, la logique à reproduire est donc une descente verticale par niveaux : poids propres et charges permanentes (G), charges d’exploitation (Q), combinaison ELU (Nu = 1,35 G + 1,50 Q par défaut lorsque le référentiel sélectionné le justifie) et combinaison de service (Nser = G + Q). Chaque niveau doit transmettre au niveau inférieur ses réactions cumulées, sans réinitialiser les charges à la fondation ou au RDC.

Source consultée : https://www.dsrcad.com/ — présentation officielle DSRCAD et fonctionnalités de l’application mobile.
