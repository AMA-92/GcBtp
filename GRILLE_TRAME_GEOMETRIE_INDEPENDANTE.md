# Grille de trame — insertion/suppression sans déplacement de la structure

## Règles implémentées

- « Insérer un axe ici » ajoute le nouvel axe **au milieu exact de la travée sélectionnée**, entre les deux axes existants.
- Les positions physiques des axes existants ne sont pas déplacées lors de l'insertion.
- La suppression d'un axe retire uniquement la ligne de trame ; les éléments du bâtiment conservent leurs coordonnées physiques en mètres.
- La modification d'une portée/distance de trame ne déplace pas les éléments déjà construits.
- Les éléments peuvent donc rester **entre deux axes** après une suppression ou un déplacement d'axes.
- La géométrie canonique des éléments est conservée dans `xM/yM/x2M/y2M/xMidM/yMidM`.
- Les coordonnées `x/y/x2/y2` restent des coordonnées d'affichage/interaction dans la trame courante et sont recalculées à partir des coordonnées métriques.
- Le modèle analytique utilise les coordonnées métriques canoniques pour les nœuds, poutres, voiles, dalles et semelles.
- Les vues 2D/3D interpolent maintenant les positions fractionnaires : un élément situé à 4,00 m reste à 4,00 m même si l'axe qui était à cette position a été supprimé.

## Exemple

Trame X : 1 — 2 — 3, avec positions 0 — 4 — 8 m.

Une pièce placée de 0 à 4 m reste de **4,00 m** après suppression de l'axe 2. Elle devient simplement située entre les axes 1 et 3 ; elle n'est pas comprimée ou déplacée vers l'axe 1.

Si un axe est inséré entre 1 et 2, il est créé à 2,00 m sans déplacer les axes 1 et 2.
