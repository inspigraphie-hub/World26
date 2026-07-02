import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "data", "live_scores.json");
const CSV_FILE = path.join(ROOT, "data", "Resultats_Coupe_du_Monde.csv");
const TOKEN = process.env.SPORTMONKS_TOKEN;
const ENDPOINT = "https://api.sportmonks.com/v3/football/livescores/inplay";

if (!TOKEN) {
    console.error("SPORTMONKS_TOKEN manquant. Exemple PowerShell : $env:SPORTMONKS_TOKEN='ta_cle_api'");
    process.exit(1);
}

const aliases = {
    "Algeria": "Algérie",
    "Argentina": "Argentine",
    "Australia": "Australie",
    "Austria": "Autriche",
    "Belgium": "Belgique",
    "Bosnia and Herzegovina": "Bosnie-Herzégovine",
    "Brazil": "Brésil",
    "Cameroon": "Cameroun",
    "Canada": "Canada",
    "Cape Verde": "Cap-Vert",
    "Chile": "Chili",
    "Colombia": "Colombie",
    "Costa Rica": "Costa Rica",
    "Croatia": "Croatie",
    "Czech Republic": "Tchéquie",
    "Denmark": "Danemark",
    "Ecuador": "Équateur",
    "Egypt": "Égypte",
    "England": "Angleterre",
    "France": "France",
    "Germany": "Allemagne",
    "Ghana": "Ghana",
    "Greece": "Grèce",
    "Haiti": "Haïti",
    "Iran": "Iran",
    "Iraq": "Irak",
    "Ivory Coast": "Côte d'Ivoire",
    "Japan": "Japon",
    "Mexico": "Mexique",
    "Morocco": "Maroc",
    "Netherlands": "Pays-Bas",
    "New Zealand": "Nouvelle-Zélande",
    "Nigeria": "Nigeria",
    "Norway": "Norvège",
    "Panama": "Panama",
    "Paraguay": "Paraguay",
    "Poland": "Pologne",
    "Portugal": "Portugal",
    "Qatar": "Qatar",
    "Saudi Arabia": "Arabie saoudite",
    "Scotland": "Écosse",
    "Senegal": "Sénégal",
    "Serbia": "Serbie",
    "South Africa": "Afrique du Sud",
    "South Korea": "Corée du Sud",
    "Spain": "Espagne",
    "Sweden": "Suède",
    "Switzerland": "Suisse",
    "Tunisia": "Tunisie",
    "Ukraine": "Ukraine",
    "United States": "États-Unis",
    "USA": "États-Unis",
    "Uruguay": "Uruguay",
    "Uzbekistan": "Ouzbékistan",
    "Wales": "Pays de Galles"
};

const siteMatches = await readSiteMatches();
const url = `${ENDPOINT}?api_token=${encodeURIComponent(TOKEN)}&include=participants;scores;state;periods`;
const response = await fetch(url, { headers: { "Accept": "application/json" } });

if (!response.ok) {
    throw new Error(`Sportmonks a répondu ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const fixtures = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
const liveMatches = fixtures
    .map(toLiveScore)
    .filter(Boolean);

await fs.writeFile(OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    matches: liveMatches
}, null, 2), "utf8");

console.log(`${liveMatches.length} match(s) live écrit(s) dans ${path.relative(ROOT, OUT_FILE)}`);

async function readSiteMatches() {
    const csv = await fs.readFile(CSV_FILE, "utf8");
    const lines = csv.trim().split(/\r?\n/);
    const headers = lines[0].split(";").map(item => item.trim());

    return lines.slice(1).map(line => {
        const values = line.split(";");
        const row = {};
        headers.forEach((header, index) => row[header] = values[index] || "");
        return row;
    });
}

function toLiveScore(fixture) {
    const participants = fixture.participants || [];
    const home = participantName(participants, "home");
    const away = participantName(participants, "away");

    if (!home || !away) return null;

    const homeFr = translateTeam(home);
    const awayFr = translateTeam(away);
    const siteMatch = findSiteMatch(homeFr, awayFr);

    if (!siteMatch) return null;

    const score = scoreFromFixture(fixture, participants);

    return {
        Date: siteMatch.Date,
        Groupe: siteMatch.Groupe,
        Domicile: siteMatch.Domicile,
        Exterieur: siteMatch.Exterieur,
        "Score Domicile": String(score.home ?? ""),
        "Score Exterieur": String(score.away ?? ""),
        Statut: statusFromFixture(fixture),
        Minute: minuteFromFixture(fixture)
    };
}

function participantName(participants, location) {
    const item = participants.find(participant =>
        participant.meta?.location === location ||
        participant.location === location ||
        participant.pivot?.location === location
    );
    return item?.name || item?.participant?.name || "";
}

function translateTeam(name) {
    return aliases[name] || name;
}

function findSiteMatch(home, away) {
    return siteMatches.find(match =>
        sameTeam(match.Domicile, home) &&
        sameTeam(match.Exterieur, away)
    );
}

function sameTeam(left, right) {
    return normalize(left) === normalize(right);
}

function normalize(value) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function scoreFromFixture(fixture, participants) {
    const scores = fixture.scores || [];
    const homeParticipant = participants.find(participant => participant.meta?.location === "home" || participant.location === "home" || participant.pivot?.location === "home");
    const awayParticipant = participants.find(participant => participant.meta?.location === "away" || participant.location === "away" || participant.pivot?.location === "away");

    return {
        home: scoreForParticipant(scores, homeParticipant?.id, "home"),
        away: scoreForParticipant(scores, awayParticipant?.id, "away")
    };
}

function scoreForParticipant(scores, participantId, location) {
    const candidates = scores.filter(score =>
        score.participant_id === participantId ||
        score.score?.participant === location
    );
    const current = candidates.find(score => /current|2nd-half|1st-half|regular/i.test(score.description || score.type?.name || ""));
    const item = current || candidates.at(-1);
    return item?.score?.goals ?? item?.goals ?? 0;
}

function statusFromFixture(fixture) {
    const state = fixture.state?.name || fixture.state?.short_name || fixture.state || "";
    if (/finished|ended|ft|full/i.test(state)) return "Terminé";
    return "En cours";
}

function minuteFromFixture(fixture) {
    if (fixture.minute) return String(fixture.minute);
    if (fixture.time?.minute) return String(fixture.time.minute);
    const period = Array.isArray(fixture.periods) ? fixture.periods.at(-1) : null;
    return period?.minutes ? String(period.minutes) : "";
}
