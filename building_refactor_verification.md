# Vérification de la refonte Bâtiment

La carte Bâtiment ouvre maintenant l’historique des projets enregistrés. Le bouton Nouveau projet ouvre une fenêtre indépendante avec validation du nom, Annuler et Créer. Après création, l’espace projet affiche les boutons Sauvegarde, 3D et menu trois points.

Le menu ouvre des fenêtres séparées pour Grille de trame, Mes modèles, Éléments du niveau, Dupliquer ce niveau vers…, Paramètres et Calculer la descente. La grille expose les axes X, Y et Z, la distance interlignes, l’ajout de lignes et la modification ou suppression des valeurs existantes. Les niveaux Fondation, RDC et R+N sont cliquables ; Ajouter un niveau crée et sélectionne un niveau supplémentaire.

Le sélecteur inférieur propose Semelle, Poteau, Poutre et Dalle avec des sections et planchers corps creux ou dalles pleines. Un clic sur la grille place un élément. Un clic sur un élément ouvre une fenêtre d’édition permettant de modifier type, section et positions X/Y, ou de supprimer l’élément.

La fenêtre Paramètres propose pays, ville, emplacement, nature de structure, norme et charges. Une proposition provisoire de sol, qadm et nappe varie selon la localisation saisie et indique clairement qu’une étude géotechnique reste nécessaire. Les projets, niveaux, éléments, paramètres de grille et charges sont sauvegardés en session.

Validation technique : TypeScript sans erreur et 28 tests Vitest réussis. La capture mobile 430 × 932 confirme le shell Android. La vérification métier automatisée couvre les propositions de sol, la persistance d’un projet et la restauration des paramètres.

## Préférences visuelles persistantes

La vue active est sauvegardée dans `gcbtp-building-view` avec les valeurs `2d` ou `3d`. Les préférences exposées dans la fenêtre Grille de trame sont sauvegardées dans `gcbtp-building-visual` : affichage des noms d’éléments, opacité de la grille et aimantation à la trame. À la réouverture du parcours Bâtiment, ces quatre préférences sont relues et réinjectées dans l’interface. Les axes X/Y/Z, la distance interlignes et les cas de charges sont sauvegardés séparément dans `gcbtp-building-config`.
