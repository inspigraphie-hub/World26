import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "data", "live_scores.json");
const KNOCKOUT_OUT_FILE = path.join(ROOT, "data", "knockout_live.json");
const STATS_OUT_FILE = path.join(ROOT, "data", "live_stats.json");
const MANUAL_FILE = path.join(ROOT, "data", "manual_updates.json");
const CSV_FILE = path.join(ROOT, "data", "Resultats_Coupe_du_Monde.csv");
const KNOCKOUT_CSV_FILE = path.join(ROOT, "data", "Matchs_16es_Coupe_du_Monde_2026.csv");
const SCORERS_CSV_FILE = path.join(ROOT, "data", "meilleurs_buteurs.csv");
const ASSISTS_CSV_FILE = path.join(ROOT, "data", "meilleurs_passeurs.csv");
const API_KEY = process.env.APIFOOTBALL_KEY;
const LEAGUE_ID = process.env.APIFOOTBALL_LEAGUE || process.env.APIFOOTBALL_LEAGUE_ID || "";
const SEASON = process.env.APIFOOTBALL_SEASON || "2026";
const DATE_FROM = process.env.APIFOOTBALL_FROM || "2026-06-11";
const DATE_TO = process.env.APIFOOTBALL_TO || "2026-07-19";
const BASE_URL = "https://v3.football.api-sports.io/fixtures";

if (!API_KEY) {
    console.warn("APIFOOTBALL_KEY manquant: le script applique seulement data/manual_updates.json et conserve les CSV existants.");
}

const aliases = {
    "Algeria": "Algerie",
    "Argentina": "Argentine",
    "Australia": "Australie",
    "Austria": "Autriche",
    "Belgium": "Belgique",
    "Bosnia and Herzegovina": "Bosnie-Herzegovine",
    "Brazil": "Bresil",
    "Cameroon": "Cameroun",
    "Canada": "Canada",
    "Cape Verde": "Cap-Vert",
    "Chile": "Chili",
    "Colombia": "Colombie",
    "Costa Rica": "Costa Rica",
    "Croatia": "Croatie",
    "Czech Republic": "Tchequie",
    "Denmark": "Danemark",
    "Ecuador": "Equateur",
    "Egypt": "Egypte",
    "England": "Angleterre",
    "France": "France",
    "Germany": "Allemagne",
    "Ghana": "Ghana",
    "Greece": "Grece",
    "Haiti": "Haiti",
    "Iran": "Iran",
    "Iraq": "Irak",
    "Ivory Coast": "Cote d'Ivoire",
    "Japan": "Japon",
    "Mexico": "Mexique",
    "Morocco": "Maroc",
    "Netherlands": "Pays-Bas",
    "New Zealand": "Nouvelle-Zelande",
    "Nigeria": "Nigeria",
    "Norway": "Norvege",
    "Panama": "Panama",
    "Paraguay": "Paraguay",
    "Poland": "Pologne",
    "Portugal": "Portugal",
    "Qatar": "Qatar",
    "Saudi Arabia": "Arabie Saoudite",
    "Scotland": "Ecosse",
    "Senegal": "Senegal",
    "Serbia": "Serbie",
    "South Africa": "Afrique du Sud",
    "South Korea": "Coree du Sud",
    "Spain": "Espagne",
    "Sweden": "Suede",
    "Switzerland": "Suisse",
    "Tunisia": "Tunisie",
    "Ukraine": "Ukraine",
    "United States": "Etats-Unis",
    "USA": "Etats-Unis",
    "Uruguay": "Uruguay",
    "Uzbekistan": "Ouzbekistan",
    "Wales": "Pays de Galles"
};

const flagCodes = {
    "afghanistan": "af.png", "afrique-du-sud": "za.png", "albanie": "al.png", "algerie": "dz.png",
    "allemagne": "de.png", "angleterre": "gb-eng.png", "arabie-saoudite": "sa.png", "argentine": "ar.png",
    "australie": "au.png", "autriche": "at.png", "belgique": "be.png", "bolivie": "bo.png",
    "bosnie-herzegovine": "ba.png", "bosnie-et-herzegovine": "ba.png", "bresil": "br.png", "bulgarie": "bg.png",
    "cap-vert": "cv.png", "cameroun": "cm.png", "canada": "ca.png", "chili": "cl.png", "chine": "cn.png",
    "colombie": "co.png", "coree-du-sud": "kr.png", "costa-rica": "cr.png", "cote-d-ivoire": "ci.png",
    "croatie": "hr.png", "danemark": "dk.png", "egypte": "eg.png", "equateur": "ec.png",
    "espagne": "es.png", "etats-unis": "us.png", "france": "fr.png", "ghana": "gh.png",
    "grece": "gr.png", "haiti": "ht.png", "honduras": "hn.png", "iran": "ir.png", "irak": "iq.png",
    "irlande": "ie.png", "italie": "it.png", "japon": "jp.png", "jordanie": "jo.png", "maroc": "ma.png",
    "mexique": "mx.png", "nigeria": "ng.png", "norvege": "no.png", "nouvelle-zelande": "nz.png",
    "ouzbekistan": "uz.png", "panama": "pa.png", "paraguay": "py.png", "pays-bas": "nl.png",
    "pays-de-galles": "gb-wls.png", "pologne": "pl.png", "portugal": "pt.png", "qatar": "qa.png",
    "rd-congo": "cd.png", "senegal": "sn.png", "serbie": "rs.png", "suede": "se.png", "suisse": "ch.png",
    "tchequie": "cz.png", "tunisie": "tn.png", "turquie": "tr.png", "ukraine": "ua.png", "uruguay": "uy.png"
};

const [siteMatches, knockoutMatches, baseScorers, baseAssists, manualUpdates, fixtures] = await Promise.all([
    readSiteMatches(),
    readKnockoutMatches(),
    readCSV(SCORERS_CSV_FILE),
    readCSV(ASSISTS_CSV_FILE),
    readManualUpdates(),
    fetchFixtures()
]);

const events = LEAGUE_ID ? await fetchEvents(fixtures) : [];

const apiLiveMatches = fixtures
    .map(fixture => toSiteLiveScore(fixture, siteMatches))
    .filter(Boolean);
const liveMatches = mergeManualSiteScores(apiLiveMatches, manualUpdates.matches || [], siteMatches);

const apiKnockoutMatchesLive = knockoutMatches.map(match => {
    const fixture = findFixtureForKnockout(match, fixtures);
    return fixture ? toKnockoutLiveScore(match, fixture) : baseKnockoutLiveScore(match);
});
const knockoutMatchesLive = mergeManualKnockout(apiKnockoutMatchesLive, manualUpdates.knockout || []);

const apiScorers = buildPlayerRanking(events, "Goal");
const apiAssists = buildAssistsRanking(events);
const scorers = mergePlayerStats(baseScorers, apiScorers, manualUpdates.scorers || [], "Buts");
const assists = mergePlayerStats(baseAssists, apiAssists, manualUpdates.assists || [], "Passes D.");
const updatedSiteMatches = mergeSiteRows(siteMatches, liveMatches);

await fs.writeFile(OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: LEAGUE_ID ? "api-football-fixtures" : "api-football-live",
    matches: liveMatches
}, null, 2), "utf8");

await fs.writeFile(KNOCKOUT_OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: LEAGUE_ID ? "api-football-fixtures" : "csv-fallback",
    matches: knockoutMatchesLive
}, null, 2), "utf8");

await fs.writeFile(STATS_OUT_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: events.length ? "api-football-events" : "csv-fallback",
    scorers,
    assists
}, null, 2), "utf8");

await writeCSV(CSV_FILE, ["Date", "Groupe", "Domicile", "Score Domicile", "Score Exterieur", "Exterieur", "Statut"], updatedSiteMatches);
await writeCSV(SCORERS_CSV_FILE, ["Rang", "Joueurs", "Buts", "Photo"], scorers);
await writeCSV(ASSISTS_CSV_FILE, ["Rang", "Joueurs", "Passes D.", "Photo"], assists);

console.log(`API-Football: ${fixtures.length} fixture(s) recu(s), ${apiLiveMatches.length} reconnu(s) dans ton calendrier.`);
if (fixtures.length === 0) {
    console.log("Aucun match recu: verifie APIFOOTBALL_LEAGUE, APIFOOTBALL_SEASON ou ton abonnement API-Football.");
} else if (apiLiveMatches.length === 0) {
    console.log("Aucun match API ne correspond aux equipes/dates de ton CSV. Utilise data/manual_updates.json pour forcer les scores de ton calendrier.");
    console.log("Exemples API recus:");
    fixtures.slice(0, 8).forEach(fixture => {
        console.log(`- ${fixture.fixture?.date || ""} | ${fixture.teams?.home?.name || "?"} - ${fixture.teams?.away?.name || "?"} | ${fixture.fixture?.status?.short || ""}`);
    });
}
console.log(`${liveMatches.length} match(s) calendrier/live ecrit(s) dans data/live_scores.json`);
console.log(`${knockoutMatchesLive.length} match(s) tableau ecrit(s) dans data/knockout_live.json`);
console.log(`${events.length} evenement(s), ${scorers.length} buteur(s), ${assists.length} passeur(s) ecrit(s) dans data/live_stats.json`);
console.log("CSV Resultats / buteurs / passeurs mis a jour sans supprimer les anciennes lignes.");

async function fetchFixtures() {
    if (!API_KEY) return [];

    const urls = [];

    if (LEAGUE_ID) {
        urls.push(`${BASE_URL}?league=${encodeURIComponent(LEAGUE_ID)}&season=${encodeURIComponent(SEASON)}&from=${DATE_FROM}&to=${DATE_TO}`);
    } else {
        urls.push(`${BASE_URL}?live=all`);
    }

    const allFixtures = [];
    for (const url of urls) {
        const response = await fetch(url, {
            headers: { "x-apisports-key": API_KEY }
        });

        if (!response.ok) {
            throw new Error(`API-Football a repondu ${response.status}: ${await response.text()}`);
        }

        const payload = await response.json();
        if (Array.isArray(payload.response)) allFixtures.push(...payload.response);
    }

    return allFixtures;
}

async function fetchEvents(fixtures) {
    const usableFixtures = fixtures
        .filter(item => item.fixture?.id)
        .filter(item => ["FT", "AET", "PEN", "1H", "2H", "HT", "ET", "BT", "P"].includes(item.fixture?.status?.short || ""));

    const allEvents = [];
    for (const fixture of usableFixtures) {
        const response = await fetch(`${BASE_URL}/events?fixture=${fixture.fixture.id}`, {
            headers: { "x-apisports-key": API_KEY }
        });

        if (!response.ok) continue;
        const payload = await response.json();
        if (Array.isArray(payload.response)) {
            payload.response.forEach(event => allEvents.push({ ...event, fixtureId: fixture.fixture.id }));
        }
    }

    return allEvents;
}

async function readSiteMatches() {
    return readCSV(CSV_FILE);
}

async function readKnockoutMatches() {
    const matches = await readCSV(KNOCKOUT_CSV_FILE);
    return matches.map((match, index) => ({
        ...match,
        Id: match.Id || match.Numero || match.Match || String(73 + index)
    }));
}

async function readManualUpdates() {
    try {
        return JSON.parse(await fs.readFile(MANUAL_FILE, "utf8"));
    } catch(error) {
        return { matches: [], knockout: [], scorers: [], assists: [] };
    }
}

async function readCSV(file) {
    const csv = fixEncoding(await fs.readFile(file, "utf8"));
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map(item => item.replace(/^\uFEFF/, "").trim());

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        const row = {};
        headers.forEach((header, index) => row[header] = values[index] ? values[index].trim() : "");
        return row;
    });
}

function toSiteLiveScore(fixture, siteMatches) {
    const home = translateTeam(fixture.teams?.home?.name || "");
    const away = translateTeam(fixture.teams?.away?.name || "");
    const found = findSiteMatch(home, away, siteMatches);

    if (!found) return null;

    const { match: siteMatch, reversed } = found;
    const scoreHome = scoreValue(fixture.goals?.home);
    const scoreAway = scoreValue(fixture.goals?.away);

    return {
        Date: siteMatch.Date,
        Groupe: siteMatch.Groupe,
        Domicile: siteMatch.Domicile,
        Exterieur: siteMatch.Exterieur,
        "Score Domicile": reversed ? scoreAway : scoreHome,
        "Score Exterieur": reversed ? scoreHome : scoreAway,
        Statut: statusLabel(fixture.fixture?.status?.short || ""),
        Minute: String(fixture.fixture?.status?.elapsed ?? "")
    };
}

function mergeManualSiteScores(apiMatches, manualMatches, siteMatches) {
    const map = new Map();
    apiMatches.forEach(match => map.set(siteMatchKey(match), match));

    manualMatches.forEach(manual => {
        const siteMatch = findManualSiteMatch(manual, siteMatches);
        if (!siteMatch) return;

        map.set(siteMatchKey(siteMatch), {
            Date: siteMatch.Date,
            Groupe: siteMatch.Groupe,
            Domicile: siteMatch.Domicile,
            Exterieur: siteMatch.Exterieur,
            "Score Domicile": scoreValue(manual.scoreHome ?? manual.score1 ?? manual["Score Domicile"]),
            "Score Exterieur": scoreValue(manual.scoreAway ?? manual.score2 ?? manual["Score Exterieur"]),
            Statut: manual.status || manual.Statut || "Termine",
            Minute: String(manual.minute ?? manual.Minute ?? "")
        });
    });

    return [...map.values()];
}

function mergeManualKnockout(apiMatches, manualMatches) {
    const map = new Map(apiMatches.map(match => [match.id, match]));

    manualMatches.forEach(manual => {
        const id = manual.id ? String(manual.id).toUpperCase().replace(/^([^M])/, "M$1") : "";
        const existing = map.get(id);
        if (!existing) return;

        const next = {
            ...existing,
            score1: scoreValue(manual.score1 ?? manual.scoreHome ?? existing.score1),
            score2: scoreValue(manual.score2 ?? manual.scoreAway ?? existing.score2),
            statut: manual.status || manual.statut || existing.statut,
            minute: String(manual.minute ?? existing.minute ?? ""),
            winner: manual.winner || existing.winner
        };

        if (!next.winner) {
            next.winner = winnerName(next.equipe1, next.equipe2, next.score1, next.score2, next.statut, null);
        }

        map.set(existing.id, next);
    });

    return [...map.values()];
}

function mergePlayerStats(baseRows, apiRows, manualRows, statKey) {
    const map = new Map();

    baseRows.forEach(row => {
        const name = row.Joueurs || row.name || row.player;
        if (!name) return;
        map.set(normalize(name), { ...row });
    });

    apiRows.forEach(row => {
        const name = row.Joueurs || row.name || row.player;
        if (!name) return;
        const key = normalize(name);
        const existing = map.get(key) || {};
        map.set(key, {
            ...existing,
            ...row,
            Joueurs: name,
            Photo: row.Photo || existing.Photo || playerPhoto(name),
            [statKey]: Number(row[statKey] ?? row.value ?? existing[statKey] ?? 0)
        });
    });

    manualRows.forEach(row => {
        const name = row.Joueurs || row.name || row.player;
        if (!name) return;
        const key = normalize(name);
        const existing = map.get(key) || {
            Rang: 0,
            Joueurs: name,
            Equipe: row.Equipe || row.team || "",
            Photo: row.Photo || playerPhoto(name),
            [statKey]: 0
        };

        map.set(key, {
            ...existing,
            ...row,
            Joueurs: name,
            Photo: row.Photo || existing.Photo || playerPhoto(name),
            [statKey]: Number(row[statKey] ?? row.value ?? existing[statKey] ?? 0)
        });
    });

    return [...map.values()]
        .sort((a, b) => Number(b[statKey] || 0) - Number(a[statKey] || 0) || a.Joueurs.localeCompare(b.Joueurs, "fr"))
        .slice(0, 20)
        .map((row, index) => ({ ...row, Rang: index + 1 }));
}

function mergeSiteRows(siteMatches, liveMatches) {
    const liveMap = new Map();
    liveMatches.forEach(match => liveMap.set(siteMatchKey(match), match));

    return siteMatches.map(match => {
        const live = liveMap.get(siteMatchKey(match));
        if (!live) return match;

        return {
            ...match,
            "Score Domicile": scoreValue(live["Score Domicile"] ?? match["Score Domicile"]),
            "Score Exterieur": scoreValue(live["Score Exterieur"] ?? match["Score Exterieur"]),
            Statut: live.Statut || match.Statut
        };
    });
}

async function writeCSV(file, headers, rows) {
    const lines = [
        headers.join(";"),
        ...rows.map(row => headers.map(header => csvValue(row[header] ?? "")).join(";"))
    ];

    await fs.writeFile(file, lines.join("\n") + "\n", "utf8");
}

function csvValue(value) {
    return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function findManualSiteMatch(manual, siteMatches) {
    return siteMatches.find(match => {
        if (manual.Date && manual.Date !== match.Date) return false;
        if (manual.Groupe && manual.Groupe !== match.Groupe) return false;
        return sameTeam(match.Domicile, manual.home || manual.Domicile || manual.equipe1)
            && sameTeam(match.Exterieur, manual.away || manual.Exterieur || manual.equipe2);
    });
}

function siteMatchKey(match) {
    return [
        match.Date || "",
        match.Groupe || "",
        match.Domicile || "",
        match.Exterieur || ""
    ].map(value => normalize(value)).join("|");
}

function toKnockoutLiveScore(match, fixture) {
    const home = translateTeam(fixture.teams?.home?.name || match.Equipe1 || "");
    const away = translateTeam(fixture.teams?.away?.name || match.Equipe2 || "");
    const score1 = scoreValue(fixture.goals?.home);
    const score2 = scoreValue(fixture.goals?.away);
    const status = statusLabel(fixture.fixture?.status?.short || match.Statut || "");

    return {
        id: "M" + match.Id,
        phase: match.Phase || "16es-de-finale",
        date: apiDate(fixture.fixture?.date) || match.Date,
        jour: match.Jour,
        heure: apiTime(fixture.fixture?.date) || match.Heure,
        equipe1: home || match.Equipe1,
        equipe2: away || match.Equipe2,
        drapeau1: flagFor(home || match.Equipe1) || match.Drapeau1,
        drapeau2: flagFor(away || match.Equipe2) || match.Drapeau2,
        score1,
        score2,
        statut: status,
        minute: String(fixture.fixture?.status?.elapsed ?? ""),
        winner: winnerName(home, away, score1, score2, status, fixture.teams),
        apiFixtureId: fixture.fixture?.id || ""
    };
}

function baseKnockoutLiveScore(match) {
    return {
        id: "M" + match.Id,
        phase: match.Phase || "16es-de-finale",
        date: match.Date,
        jour: match.Jour,
        heure: match.Heure,
        equipe1: match.Equipe1,
        equipe2: match.Equipe2,
        drapeau1: match.Drapeau1,
        drapeau2: match.Drapeau2,
        score1: match.Score1 || "",
        score2: match.Score2 || "",
        statut: match.Statut || "A venir",
        minute: "",
        winner: ""
    };
}

function findSiteMatch(home, away, siteMatches) {
    const direct = siteMatches.find(match =>
        sameTeam(match.Domicile, home) &&
        sameTeam(match.Exterieur, away)
    );

    if (direct) return { match: direct, reversed: false };

    const reversed = siteMatches.find(match =>
        sameTeam(match.Domicile, away) &&
        sameTeam(match.Exterieur, home)
    );

    return reversed ? { match: reversed, reversed: true } : null;
}

function findFixtureForKnockout(match, fixtures) {
    const home = match.Equipe1 || "";
    const away = match.Equipe2 || "";

    const byTeams = fixtures.find(fixture =>
        (
            sameTeam(translateTeam(fixture.teams?.home?.name || ""), home) &&
            sameTeam(translateTeam(fixture.teams?.away?.name || ""), away)
        ) ||
        (
            sameTeam(translateTeam(fixture.teams?.home?.name || ""), away) &&
            sameTeam(translateTeam(fixture.teams?.away?.name || ""), home)
        )
    );

    if (byTeams) return byTeams;

    return fixtures.find(fixture => {
        const fixtureDate = apiDate(fixture.fixture?.date);
        const fixtureTime = apiTime(fixture.fixture?.date);
        if (!fixtureDate || fixtureDate !== match.Date) return false;
        if (!match.Heure || !fixtureTime) return true;
        return fixtureTime.slice(0, 2) === match.Heure.slice(0, 2);
    });
}

function translateTeam(name) {
    return aliases[name] || name;
}

function statusLabel(shortStatus) {
    if (["FT", "AET", "PEN"].includes(shortStatus)) return "Termine";
    if (["NS", "TBD", "PST", "CANC"].includes(shortStatus)) return "A venir";
    if (normalize(shortStatus).includes("venir")) return "A venir";
    if (normalize(shortStatus).includes("termin")) return "Termine";
    return "En cours";
}

function winnerName(home, away, score1, score2, status, teams) {
    if (normalize(status) !== "termine") return "";

    if (teams?.home?.winner === true) return home;
    if (teams?.away?.winner === true) return away;

    const homeScore = Number(score1);
    const awayScore = Number(score2);
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || homeScore === awayScore) return "";
    return homeScore > awayScore ? home : away;
}

function scoreValue(value) {
    return value === null || value === undefined ? "" : String(value);
}

function apiDate(value) {
    if (!value) return "";
    return value.slice(0, 10).split("-").reverse().join("/");
}

function apiTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

function flagFor(team) {
    return flagCodes[normalize(team)] || "";
}

function buildPlayerRanking(events, detailType) {
    const map = new Map();

    events
        .filter(event => event.type === detailType || event.detail === detailType || (detailType === "Goal" && event.type === "Goal"))
        .filter(event => event.player?.name)
        .forEach(event => {
            const key = normalize(event.player.name);
            const current = map.get(key) || {
                Rang: 0,
                Joueurs: event.player.name,
                Equipe: translateTeam(event.team?.name || ""),
                Photo: playerPhoto(event.player.name),
                Buts: 0
            };
            current.Buts += 1;
            map.set(key, current);
        });

    return [...map.values()]
        .sort((a, b) => b.Buts - a.Buts || a.Joueurs.localeCompare(b.Joueurs, "fr"))
        .slice(0, 20)
        .map((player, index) => ({ ...player, Rang: index + 1 }));
}

function buildAssistsRanking(events) {
    const map = new Map();

    events
        .filter(event => event.type === "Goal")
        .filter(event => event.assist?.name)
        .forEach(event => {
            const key = normalize(event.assist.name);
            const current = map.get(key) || {
                Rang: 0,
                Joueurs: event.assist.name,
                Equipe: translateTeam(event.team?.name || ""),
                Photo: playerPhoto(event.assist.name),
                "Passes D.": 0
            };
            current["Passes D."] += 1;
            map.set(key, current);
        });

    return [...map.values()]
        .sort((a, b) => b["Passes D."] - a["Passes D."] || a.Joueurs.localeCompare(b.Joueurs, "fr"))
        .slice(0, 20)
        .map((player, index) => ({ ...player, Rang: index + 1 }));
}

function playerPhoto(name) {
    return `${normalize(name)}.png`;
}

function sameTeam(left, right) {
    const normalizedLeft = normalize(left);
    const normalizedRight = normalize(right);
    return normalizedLeft !== "" && normalizedLeft === normalizedRight;
}

function normalize(value) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function fixEncoding(text) {
    return text
        .replace(/^\uFEFF/, "")
        .replace(/Ãƒâ€°|ÃƒÂ‰|Ã‰/g, "É")
        .replace(/ÃƒÂ©|Ã©/g, "é").replace(/ÃƒÂ¨|Ã¨/g, "è").replace(/ÃƒÂª|Ãª/g, "ê").replace(/ÃƒÂ«|Ã«/g, "ë")
        .replace(/ÃƒÂ­|Ã­/g, "í").replace(/ÃƒÂ¡|Ã¡/g, "á").replace(/ÃƒÂ£|Ã£/g, "ã")
        .replace(/Ãƒ |Ã /g, "à").replace(/ÃƒÂ¢|Ã¢/g, "â").replace(/ÃƒÂ®|Ã®/g, "î").replace(/ÃƒÂ¯|Ã¯/g, "ï")
        .replace(/ÃƒÂ´|Ã´/g, "ô").replace(/ÃƒÂ¶|Ã¶/g, "ö").replace(/ÃƒÂ»|Ã»/g, "û").replace(/ÃƒÂ¹|Ã¹/g, "ù")
        .replace(/ÃƒÂ§|Ã§/g, "ç")
        .replace(/Ã©/g, "é").replace(/Ã¨/g, "è").replace(/Ãª/g, "ê").replace(/Ã«/g, "ë")
        .replace(/Ã­/g, "í").replace(/Ã¡/g, "á").replace(/Ã£/g, "ã")
        .replace(/Ã´/g, "ô").replace(/Ã¹/g, "ù").replace(/Ã§/g, "ç").replace(/Ã‰/g, "É");
}
