# Cadrage de la descente de charges contextualisée

## Sources publiques consultées

1. SkyCiv, « EN 1990:2002 Load Combinations », https://skyciv.com/docs/tech-notes/load-combinations/en-1990-2002/ — source pédagogique sur la combinaison des actions permanentes, variables et actions climatiques selon les principes de l’EN 1990.
2. EN 1991-1-1, « Actions on structures — General actions — Densities, self-weight, imposed loads for buildings », https://www.phd.eng.br/wp-content/uploads/2015/12/en.1991.1.1.2002.pdf — document public consulté pour le cadrage des charges d’exploitation des planchers, escaliers et zones de circulation.

## Décisions de conception

Le moteur doit distinguer les actions permanentes Gk, les actions variables Qk et les actions environnementales W, S et E. Les charges d’escalier doivent inclure le poids propre de la paillasse ou des marches, les finitions, les garde-corps et la charge d’exploitation correspondant à l’usage ; les paliers doivent transmettre leurs réactions à leurs appuis.

Le modèle doit calculer les surfaces tributaires à partir de la géométrie réellement dessinée, propager les charges dalle/escalier vers les poutres, puis vers les poteaux et semelles, et conserver la provenance de chaque contribution. Les combinaisons doivent dépendre du référentiel sélectionné et ne pas être universellement codées comme une constante.

Les valeurs proposées par pays, ville, zone climatique, sol ou sismicité doivent être affichées avec leur source et leur statut « à confirmer ». Une donnée absente ne doit pas être inventée ; l’utilisateur doit pouvoir la remplacer par une valeur issue d’une étude ou d’un document réglementaire.

## Limite professionnelle

Les résultats doivent rester des résultats d’aide au calcul tant qu’ils ne sont pas contrôlés par un ingénieur structure habilité. La note PDF doit exposer les hypothèses, unités, actions activées/désactivées, facteurs, combinaisons, contributions et avertissements.
