import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "data", "live_scores.json");
const KNOCKOUT_OUT_FILE = path.join(ROOT, "data", "knockout_live.json");
const CSV_FILE = path.join(ROOT, "data", "Resultats_Coupe_du_Monde.csv");
const KNOCKOUT_CSV_FILE = path.join(ROOT, "data", "Matchs_16es_Coupe_du_Monde_2026.csv");
const API_KEY = process.env.APIFOOTBALL_KEY;
const LEAGUE_ID = process.env.APIFOOTBALL_LEAGUE || process.env.APIFOOTBALL_LEAGUE_ID || "";
const SEASON = process.env.APIFOOTBALL_SEASON || "2026";
const DATE_FROM = process.env.APIFOOTBALL_FROM || "2026-06-11";
const DATE_TO = process.env.APIFOOTBALL_TO || "2026-07-19";
const BASE_URL = "https://v3.football.api-sports.io/fixtures";

if (!API_KEY) {
    console.error("APIFOOTBALL_KEY manquant. Exemple PowerShell : $env:APIFOOTBALL_KEY='ta_cle_api'");
    process.exit(1);
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

const [siteMatches, knockoutMatches, fixtures] = await Promise.all([
    readSiteMatches(),
    readKnockoutMatches(),
    fetchFixtures()
]);

const liveMatches = fixtures
    .map(fixture => toSiteLiveScore(fixture, siteMatches))
    .filter(Boolean);

const knockoutMatchesLive = knockoutMatches.map(match => {
    const fixture = findFixtureForKnockout(match, fixtures);
    return fixture ? toKnockoutLiveScore(match, fixture) : baseKnockoutLiveScore(match);
});

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

console.log(`${liveMatches.length} match(s) calendrier/live ecrit(s) dans data/live_scores.json`);
console.log(`${knockoutMatchesLive.length} match(s) tableau ecrit(s) dans data/knockout_live.json`);

async function fetchFixtures() {
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

async function readSiteMatches() {
    return readCSV(CSV_FILE);
}

async function readKnockoutMatches() {
    return readCSV(KNOCKOUT_CSV_FILE).map((match, index) => ({
        ...match,
        Id: match.Id || match.Numero || match.Match || String(73 + index)
    }));
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
    const siteMatch = findSiteMatch(home, away, siteMatches);

    if (!siteMatch) return null;

    return {
        Date: siteMatch.Date,
        Groupe: siteMatch.Groupe,
        Domicile: siteMatch.Domicile,
        Exterieur: siteMatch.Exterieur,
        "Score Domicile": scoreValue(fixture.goals?.home),
        "Score Exterieur": scoreValue(fixture.goals?.away),
        Statut: statusLabel(fixture.fixture?.status?.short || ""),
        Minute: String(fixture.fixture?.status?.elapsed ?? "")
    };
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
    return siteMatches.find(match =>
        sameTeam(match.Domicile, home) &&
        sameTeam(match.Exterieur, away)
    );
}

function findFixtureForKnockout(match, fixtures) {
    const home = match.Equipe1 || "";
    const away = match.Equipe2 || "";

    const byTeams = fixtures.find(fixture =>
        sameTeam(translateTeam(fixture.teams?.home?.name || ""), home) &&
        sameTeam(translateTeam(fixture.teams?.away?.name || ""), away)
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
        .replace(/Ã©/g, "e").replace(/Ã¨/g, "e").replace(/Ãª/g, "e").replace(/Ã«/g, "e")
        .replace(/Ã /g, "a").replace(/Ã¢/g, "a").replace(/Ã®/g, "i").replace(/Ã¯/g, "i")
        .replace(/Ã´/g, "o").replace(/Ã¶/g, "o").replace(/Ã»/g, "u").replace(/Ã¹/g, "u")
        .replace(/Ã§/g, "c").replace(/Ã‰/g, "E").replace(/Ã/g, "E").replace(/Ã/g, "E");
}
