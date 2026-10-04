# Regroupement des plans A4 de ferraillage

## Règle de production

Après chaque calcul/recalcul du béton armé, les éléments sont regroupés automatiquement pour la production des plans A4.

Le regroupement primaire est effectué par :

1. type d'élément (poteau, poutre, longrine, dalle, voile, semelle) ;
2. section / géométrie constructive.

La longueur, la portée et la hauteur globale de l'élément ne créent donc pas à elles seules un nouveau plan lorsqu'elles ne font pas partie de la section constructive.

## Exemple poteaux

Si P1, P5, P8 et P10 sont tous des poteaux 15 × 15 cm, le dossier produit un seul plan A4 pour la section 15 × 15 cm et indique :

- Nombre : 4 poteaux
- Repères : P1, P5, P8, P10

Si dix poteaux sont concernés, le cartouche et le tableau indiquent 10 éléments et listent les dix repères.

## Ferraillage différent

Deux éléments de même section restent dans le même plan A4 même si leurs armatures diffèrent. Le plan est alors marqué **VARIANTES** et le tableau associe chaque ligne de ferraillage à son repère.

Si le ferraillage est strictement identique, le plan porte la mention **FERRAILLAGE COMMUN** et une nomenclature unique peut être utilisée pour l'ensemble des repères.

Cette règle est appliquée aux poteaux mais également aux semelles, poutres, longrines, dalles et voiles.

## Après optimisation

Lorsqu'une section optimisée est validée et appliquée à la maquette, le recalcul global est relancé. Les groupes A4 sont alors reconstruits à partir du nouveau résultat : les anciens groupes ne sont pas conservés artificiellement.
