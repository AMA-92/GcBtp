# API du moteur professionnel

Le point d'entrée est `shared/engineering-engine.ts`.

Il réexporte les moteurs avancés afin que l'interface, un futur serveur de calcul ou un export batch puissent utiliser une API commune.

`shared/professional-capabilities.ts` fournit également une liste machine-readable des 15 capacités et de leur statut.
