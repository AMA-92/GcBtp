# Notes de recherche — modélisation d’escaliers dans Robot Structural Analysis

La documentation publique Autodesk consultée sur les panneaux et planchers confirme que les panneaux servent à représenter les surfaces structurales, y compris des surfaces inclinées. Dans l’échange Autodesk Community « Slabless Stairs Design - Modelling & Meshing », l’exemple de modélisation décrit les volées comme des panneaux et le palier comme un panneau séparé ; une autre variante représente les marches et contremarches comme panneaux séparés. La discussion souligne également que le maillage doit suivre la géométrie réelle et qu’une modélisation en panneaux distincts peut être nécessaire lorsque l’on veut conserver les marches et les risers.

Conséquence pour GcBtp : le workflow demandé sera représenté par une ligne/niveau temporaire Z à +1,60 m, deux surfaces inclinées de volée et des surfaces horizontales séparées pour le palier de repos et le palier d’arrivée. La ligne temporaire est un repère de construction, pas une charge ni un élément permanent. La géométrie doit conserver les coordonnées d’altitude des niveaux et les surfaces doivent rester raccordées aux appuis structuraux.

Source consultée : https://forums.autodesk.com/t5/robot-structural-analysis-forum/slabless-stairs-design-modelling-amp-meshing/td-p/9962850
Source Autodesk connexe : https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/What-is-the-difference-between-Panel-and-Floor-elements-in-Robot-Structural-Analysis.html
