# Constats publics pour la vue 3D GcBtp

La page officielle Autodesk présente Robot Structural Analysis comme un logiciel d’analyse structurale 3D intégré aux flux BIM, avec des modèles coordonnés et des données de conception reliées [1]. La documentation publique de navigation RSA indique des modes distincts pour la rotation 3D, la rotation 2D, le zoom et le pan, ainsi qu’un mode multifonction [2].

Une ressource de modélisation consacrée à Robot recommande de définir les lignes de grille et les niveaux avant les éléments. Elle décrit le placement des poutres par clic dans l’espace avec accrochage aux intersections de grille, le placement des poteaux avec orientation et hauteur explicites, et les planchers par définition de leur contour [3].

## Conséquence pour GcBtp

La correction doit donc afficher une structure analytique continue : les semelles sous les poteaux de fondation, les poteaux de chaque niveau alignés verticalement lorsque les coordonnées XY correspondent, les poutres au sommet du niveau concerné et les dalles au-dessus des poutres. La navigation doit conserver des commandes séparées et prévisibles pour pan, rotation, zoom et recentrage, avec un pivot visuel centré sur l’emprise de la structure plutôt qu’un point de fuite fixe.

## Références

[1]: https://www.autodesk.com/products/robot-structural-analysis/overview — Autodesk, Robot Structural Analysis Professional.
[2]: https://help.autodesk.com/view/RSAPRO/2020/DEU/?guid=GUID-3C6750B2-2D29-4168-AAFB-E3946330CEE4 — Autodesk Help, 3D View - Work Modes.
[3]: https://mgfx.co.za/blog/autodesk/modeling-101-in-robot-structural-analysis/ — Micrographics, Modeling 101 in Robot Structural Analysis.
