# Scores live

Le site lit automatiquement `data/live_scores.json` toutes les 30 secondes.

## Solution recommandee

1. Creer une cle API chez un fournisseur de scores live.
2. Mettre la cle dans une variable d'environnement.
3. Lancer un script toutes les 30 secondes ou toutes les minutes.
4. Le script ecrit `data/live_scores.json`.
5. Le navigateur detecte les changements et met les cartes a jour.

## Le plus simple avec API-Football

PowerShell :

```powershell
$env:APIFOOTBALL_KEY="ta_cle_api"
node scripts/update-live-scores-apifootball.mjs
```

Pour lancer en boucle pendant que le site est ouvert :

```powershell
while ($true) {
  node scripts/update-live-scores-apifootball.mjs
  Start-Sleep -Seconds 30
}
```

Par defaut, API-Football utilise l'endpoint `https://v3.football.api-sports.io/fixtures?live=all`.
La cle est envoyee dans le header `x-apisports-key`.

Pour mettre a jour tout le calendrier, les matchs a venir, le tableau final et les stats joueurs, ajoute aussi l'id de la competition API-Football :

```powershell
$env:APIFOOTBALL_KEY="ta_cle_api"
$env:APIFOOTBALL_LEAGUE="ID_DE_LA_COUPE_DU_MONDE"
$env:APIFOOTBALL_SEASON="2026"
node scripts/update-live-scores-apifootball.mjs
```

Le script ecrit maintenant :

- `data/live_scores.json` pour les cartes de matchs ;
- `data/knockout_live.json` pour le tableau final ;
- `data/live_stats.json` pour les buteurs/passeurs.

Si `APIFOOTBALL_LEAGUE` n'est pas renseigne, le script reste en mode simple et ne recupere que les matchs en direct.

## Si l'API ne reconnait pas ton calendrier

Si le terminal affiche `0 reconnu(s) dans ton calendrier`, c'est que les matchs de ton CSV ne correspondent pas exactement aux fixtures API-Football. Dans ce cas, remplis `data/manual_updates.json`.

Exemple :

```json
{
  "matches": [
    {
      "Date": "28-juin",
      "Groupe": "Groupe K",
      "Domicile": "Colombie",
      "Exterieur": "Portugal",
      "Score Domicile": "2",
      "Score Exterieur": "1",
      "Statut": "Termine"
    },
    {
      "Date": "28-juin",
      "Groupe": "Groupe J",
      "Domicile": "Jordanie",
      "Exterieur": "Argentine",
      "Score Domicile": "0",
      "Score Exterieur": "3",
      "Statut": "Termine"
    }
  ],
  "knockout": [],
  "scorers": [
    {
      "Joueurs": "Lionel Messi",
      "Buts": 6,
      "Photo": "messi.png"
    }
  ],
  "assists": []
}
```

Puis relance :

```powershell
node scripts/update-live-scores-apifootball.mjs
```

## Exemple avec Sportmonks

PowerShell :

```powershell
$env:SPORTMONKS_TOKEN="ta_cle_api"
node scripts/update-live-scores-sportmonks.mjs
```

Pour lancer en boucle pendant que le site est ouvert :

```powershell
while ($true) {
  node scripts/update-live-scores-sportmonks.mjs
  Start-Sleep -Seconds 30
}
```

## Format attendu par le site

```json
{
  "updatedAt": "2026-06-27T18:42:00+02:00",
  "matches": [
    {
      "Date": "27-juin",
      "Groupe": "Groupe L",
      "Domicile": "Panama",
      "Exterieur": "Angleterre",
      "Score Domicile": "1",
      "Score Exterieur": "2",
      "Statut": "En cours",
      "Minute": "67"
    }
  ]
}
```

Ne mets jamais une cle API directement dans le JavaScript du site : elle serait visible par tout le monde dans le navigateur.
