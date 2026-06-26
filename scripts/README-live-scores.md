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

API-Football utilise l'endpoint `https://v3.football.api-sports.io/fixtures?live=all`.
La cle est envoyee dans le header `x-apisports-key`.

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
