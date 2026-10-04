# Vérification structurée — parcours Bâtiment

## Parcours contrôlé

| Étape | Action | Comportement attendu | Vérification disponible |
|---|---|---|---|
| 1 | Depuis Calculs DSRCAD, appuyer sur la carte Bâtiment | Ouverture de l’écran Bâtiments | `CalculsScreen` appelle `onNavigate("Bâtiments")`, relayé par `AndroidHome` |
| 2 | Appuyer sur Nouveau bâtiment | Ouverture du dialogue Nouveau bâtiment | `BuildingCreateFlow` affiche le dialogue et le champ Nom du projet |
| 3 | Valider sans nom | Message d’erreur et création bloquée | `createBuilding()` refuse une valeur vide et appelle `toast.error` |
| 4 | Appuyer sur Annuler | Fermeture du dialogue sans création | `setDialogOpen(false)` |
| 5 | Saisir un nom puis appuyer sur Créer | Passage vers l’espace bâtiment | `setCreated(true)` et `toast.success` |
| 6 | Naviguer dans RDC, Fondations et + Niveau | Onglet actif conservé | `activeLevel` est mis à jour et sauvegardé |
| 7 | Modifier les paramètres | Les paramètres restent disponibles à la réouverture de session | `sessionStorage` sauvegarde nom, niveau, hauteur, aimantation, affichage, charges, norme, pays et réglages de visualisation |
| 8 | Revenir puis rouvrir Bâtiment | Nom et paramètres restaurés | L’effet d’initialisation relit et réinjecte toutes les valeurs sauvegardées |

## Validation technique

La compilation TypeScript et la suite Vitest passent avec 24 tests. Une capture responsive au viewport 430 × 932 confirme le shell Android. La vidéo fournie a été examinée par extraction de frames locales ; l’analyse audio automatique a été indisponible à cause d’une réponse 403, ce qui est signalé comme limite de preuve pour les informations exclusivement orales.
