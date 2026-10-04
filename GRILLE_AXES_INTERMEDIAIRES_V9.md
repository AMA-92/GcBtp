# Grille de trame — axes intermédiaires v9

## Règles

- L'insertion se fait dans l'intervalle choisi, à une distance **saisie par l'utilisateur** depuis l'axe de gauche/de départ.
- La distance doit être strictement comprise entre 0 et la portée de l'intervalle.
- Exemple : entre 1 et 2, portée 4,00 m : 1,00 / 2,00 / 3,00 m sont possibles.
- Les axes existants ne sont pas renumérotés et ne sont pas déplacés par l'insertion.
- Un axe intermédiaire ne prend jamais le numéro de l'axe suivant : entre 1 et 2, les noms sont 1′, 1″, 1‴, etc.
- Pour une trame alphabétique : A′, A″, A‴, etc.
- La suppression retire uniquement l'axe choisi ; les noms des autres axes restent inchangés.
- La géométrie des éléments est conservée en coordonnées métriques (`xM/yM/x2M/y2M/...`) lors des modifications de trame.
- Les axes intermédiaires restent de vraies intersections de grille : le placement des poteaux, semelles, poutres, voiles, longrines et escaliers peut les utiliser comme les axes d'origine.

## Exemple

`1 -------- 2` sur 4,00 m

Insertion à 1,00 m : `1 -- 1′ -------- 2`

Insertion supplémentaire dans le même intervalle : `1 -- 1′ -- 1″ ---- 2`

La suppression de `1′` redonne `1 -------- 2` sans renommer `2`.
