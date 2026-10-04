# Ferraillage A4 — logique de représentation technique intégrée

La sortie A4 ne dessine plus un schéma générique identique pour tous les éléments. Le dessin est choisi selon le type de l'élément et alimenté par les armatures réellement présentes dans `RCElementDesign.reinforcement`.

## Poutre / longrine
- élévation longitudinale ;
- armatures longitudinales inférieures et supérieures ;
- cadres/étriers avec leur diamètre et espacement issus du résultat ;
- deux coupes représentatives (appui / travée) ;
- cotation de longueur et hauteur ;
- nomenclature avec code et forme graphique.

## Poteau
- élévation verticale ;
- barres longitudinales ;
- cadres avec diamètre et espacement ;
- coupe A-A ;
- cotation section et hauteur ;
- nomenclature.

## Semelle
- vue en plan des nappes X/Y ;
- position du poteau ;
- coupes X-X/Y-Y ;
- épaisseur ;
- diamètres et quantités X/Y ;
- nomenclature.

## Dalle
- plan des nappes orthogonales ;
- coupe d'épaisseur ;
- armatures X/Y et leurs espacements calculés ;
- nomenclature.

## Voile
- élévation avec armatures verticales et horizontales ;
- zones de rive ;
- coupe d'épaisseur ;
- nomenclature.

## Regroupement
Une fiche représente un seul élément type. Les éléments identiques restent regroupés par type + géométrie + ferraillage. La fiche affiche un seul représentant, la quantité et les repères associés.

## Important
Les détails graphiques sont générés à partir des résultats de ferraillage disponibles. Les ancrages, recouvrements, formes complexes et dispositions sismiques ne sont pas inventés : ils restent signalés comme limites lorsque le moteur de calcul ne fournit pas encore ces données normatives.
