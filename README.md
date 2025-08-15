# Fourmizzz — Export messagerie (style Zzzelp)

UserScript Tampermonkey qui exporte une conversation Fourmizzz en 3 formats :
- Texte brut
- BBCode Fourmizzz (mêmes balises que Zzzelp)
- BBCode classique

## Fonctions
- Titre par conversation
- Participants depuis la ligne officielle (`#liste_participants_*`) + “Afficher tous les participants”
- Ouvre “Voir les messages précédents” et déplie les messages longs
- UI style Zzzelp (bouton + zones d’export au clic)

## Installation
1. Installer l’extension **Tampermonkey**.
2. Ouvrir :  
   `https://raw.githubusercontent.com/LeTristoune81/Messagerie/main/export-messagerie.user.js`
3. Cliquer **Installer**.

## Mise à jour
Automatique (entêtes `@updateURL` / `@downloadURL`).  
Version actuelle : `7.10`.

## Licence
GPL-3.0-or-later

- Ce script inclut `ze_HTML_to_BBcode` issue de ZzzelpScript (GPL-3.0).
- Projet original Zzzelp : https://github.com/flaviendelangle/ZzzelpScript
