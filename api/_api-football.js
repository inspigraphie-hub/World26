const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://v3.football.api-sports.io/fixtures";
const FIXTURE_CACHE_MS = Number(process.env.APIFOOTBALL_CACHE_MS || 60000);

let fixtureCache = {};

const aliases = {
    "Algeria": "Algérie",
    "Argentina": "Argentine",
    "Australia": "Australie",
    "Austria": "Autriche",
    "Belgium": "Belgique",
    "Bosnia and Herzegovina": "Bosnie-Herzégovine",
    "Brazil": "Brésil",
    "Canada": "Canada",
    "Cape Verde": "Cap-Vert",
    "Colombia": "Colombie",
    "Congo DR": "RD Congo",
    "Croatia": "Croatie",
    "Czech Republic": "Tchéquie",
    "Ecuador": "Équateur",
    "Egypt": "Égypte",
    "England": "Angleterre",
    "France": "France",
    "Germany": "Allemagne",
    "Ghana": "Ghana",
    "Ivory Coast": "Côte d'Ivoire",
    "Japan": "Japon",
    "Mexico": "Mexique",
    "Morocco": "Maroc",
    "Netherlands": "Pays-Bas",
    "Norway": "Norvège",
    "Paraguay": "Paraguay",
    "Portugal": "Portugal",
    "South Africa": "Afrique du Sud",
    "Spain": "Espagne",
    "Sweden": "Suède",
    "Switzerland": "Suisse",
    "United States": "États-Unis",
    "USA": "États-Unis",
    "Uzbekistan": "Ouzbékistan"
};

const flagCodes = {
    "afrique-du-sud": "za.png",
    "algerie": "dz.png",
    "allemagne": "de.png",
    "angleterre": "gb-eng.png",
    "argentine": "ar.png",
    "australie": "au.png",
    "autriche": "at.png",
    "belgique": "be.png",
    "bosnie-herzegovine": "ba.png",
    "bresil": "br.png",
    "canada": "ca.png",
    "cap-vert": "cv.png",
    "colombie": "co.png",
    "cote-d-ivoire": "ci.png",
    "croatie": "hr.png",
    "egypte": "eg.png",
    "equateur": "ec.png",
    "espagne": "es.png",
    "etats-unis": "us.png",
    "france": "fr.png",
    "ghana": "gh.png",
    "japon": "jp.png",
    "maroc": "ma.png",
    "mexique": "mx.png",
    "norvege": "no.png",
    "ouzbekistan": "uz.png",
    "paraguay": "py.png",
    "pays-bas": "nl.png",
    "portugal": "pt.png",
    "rd-congo": "cd.png",
    "suede": "se.png",
    "suisse": "ch.png",
    "tchequie": "cz.png"
};

function readJSON(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function safeReadJSON(relativePath, fallback) {
    try {
        return readJSON(relativePath);
    } catch (error) {
        return fallback;
    }
}

function readCSV(relativePath) {
    const csv = fixEncoding(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map(header => header.replace(/^\uFEFF/, "").trim());

    return lines.slice(1).map(line => {
        const values = line.split(separator);
        const row = {};
        headers.forEach((header, index) => row[header] = values[index] ? values[index].trim() : "");
        return row;
    });
}

async function fetchFixtures(options = {}) {
    const apiKey = process.env.APIFOOTBALL_KEY;
    if (!apiKey) return [];

    const cacheKey = options.includeCompetitionFixtures ? "competition" : "live";
    const now = Date.now();
    if (fixtureCache[cacheKey]?.expiresAt > now) return fixtureCache[cacheKey].fixtures;

    const league = process.env.APIFOOTBALL_LEAGUE || process.env.APIFOOTBALL_LEAGUE_ID || "1";
    const season = process.env.APIFOOTBALL_SEASON || "2026";
    const from = process.env.APIFOOTBALL_FROM || "2026-06-11";
    const to = process.env.APIFOOTBALL_TO || "2026-07-19";
    const includeFullFixtures = options.includeCompetitionFixtures || process.env.APIFOOTBALL_INCLUDE_FULL_FIXTURES === "1";
    const fixtureIds = Array.isArray(options.fixtureIds) ? options.fixtureIds.filter(Boolean) : [];
    const fixtureDates = Array.isArray(options.dates) ? options.dates.filter(Boolean) : [];
    const urls = [
        `${BASE_URL}?live=all`
    ];

    if (league && includeFullFixtures) {
        urls.push(`${BASE_URL}?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}&from=${from}&to=${to}`);
    }

    fixtureDates.forEach(date => {
        urls.push(`${BASE_URL}?date=${encodeURIComponent(date)}`);
        if (league && season) {
            urls.push(`${BASE_URL}?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}&date=${encodeURIComponent(date)}`);
        }
    });

    fixtureIds.forEach(id => {
        urls.push(`${BASE_URL}?id=${encodeURIComponent(id)}`);
    });

    const fixtures = [];
    const seen = new Set();

    for (const url of urls) {
        const response = await fetch(url, {
            headers: { "x-apisports-key": apiKey }
        });

        if (!response.ok) {
            throw new Error(`API-Football ${response.status}: ${await response.text()}`);
        }

        const payload = await response.json();
        const rows = Array.isArray(payload.response) ? payload.response : [];

        rows.forEach(fixture => {
            const id = fixture.fixture?.id || `${fixture.fixture?.date || ""}-${fixture.teams?.home?.name || ""}-${fixture.teams?.away?.name || ""}`;
            if (seen.has(id)) return;
            seen.add(id);
            fixtures.push(fixture);
        });
    }

    fixtureCache[cacheKey] = {
        expiresAt: now + FIXTURE_CACHE_MS,
        fixtures
    };

    return fixtures;
}

function apiConfigInfo() {
    let fixtureIds = [];
    try {
        fixtureIds = knockoutFixtureIds();
    } catch (error) {
        fixtureIds = [];
    }

    return {
        hasApiKey: Boolean(process.env.APIFOOTBALL_KEY),
        league: process.env.APIFOOTBALL_LEAGUE || process.env.APIFOOTBALL_LEAGUE_ID || "1",
        season: process.env.APIFOOTBALL_SEASON || "2026",
        from: process.env.APIFOOTBALL_FROM || "2026-06-11",
        to: process.env.APIFOOTBALL_TO || "2026-07-19",
        knockoutFixtureIds: fixtureIds,
        knockoutFixtureDates: knockoutFixtureDates()
    };
}

function toSiteLiveScores(fixtures) {
    const siteMatches = readCSV("data/Resultats_Coupe_du_Monde.csv");
    const mapped = fixtures
        .map(fixture => toSiteLiveScore(fixture, siteMatches))
        .filter(Boolean);

    return {
        updatedAt: new Date().toISOString(),
        source: "vercel-api-football",
        fixtureCount: fixtures.length,
        matchedCount: mapped.length,
        mode: "live",
        apiConfig: apiConfigInfo(),
        matches: mapped
    };
}

function toKnockoutLiveScores(fixtures) {
    const knockoutMatches = readCSV("data/Matchs_16es_Coupe_du_Monde_2026.csv")
        .map((match, index) => ({ ...match, Id: String(73 + index) }));

    const matches = knockoutMatches.map(match => {
        const found = findFixture(match.Equipe1, match.Equipe2, fixtures);
        return found ? toKnockoutLiveScore(match, found.fixture, found.reversed) : baseKnockoutLiveScore(match);
    });

    return {
        updatedAt: new Date().toISOString(),
        source: "vercel-api-football",
        fixtureCount: fixtures.length,
        matchedCount: matches.filter(match => match.apiFixtureId).length,
        mode: "competition",
        apiConfig: apiConfigInfo(),
        matches
    };
}

function knockoutFixtureIds() {
    return readCSV("data/Matchs_16es_Coupe_du_Monde_2026.csv")
        .map(match => match.ApiFixtureId || match.apiFixtureId || "")
        .filter(Boolean);
}

function knockoutFixtureDates() {
    return [...new Set(readCSV("data/Matchs_16es_Coupe_du_Monde_2026.csv")
        .map(match => csvDateToApiDate(match.Date))
        .filter(Boolean))];
}

function csvDateToApiDate(value) {
    const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return "";
    return match[3] + "-" + match[2].padStart(2, "0") + "-" + match[1].padStart(2, "0");
}

function toSiteLiveScore(fixture, siteMatches) {
    const home = translateTeam(fixture.teams?.home?.name || "");
    const away = translateTeam(fixture.teams?.away?.name || "");
    const found = findSiteMatch(home, away, siteMatches);
    if (!found) return null;

    const scoreHome = scoreValue(fixture.goals?.home);
    const scoreAway = scoreValue(fixture.goals?.away);

    return {
        Date: found.match.Date,
        Groupe: found.match.Groupe,
        Domicile: found.match.Domicile,
        Exterieur: found.match.Exterieur,
        "Score Domicile": found.reversed ? scoreAway : scoreHome,
        "Score Exterieur": found.reversed ? scoreHome : scoreAway,
        Statut: statusLabel(fixture.fixture?.status?.short || ""),
        Minute: String(fixture.fixture?.status?.elapsed ?? "")
    };
}

function toKnockoutLiveScore(match, fixture, reversed = false) {
    const home = translateTeam(fixture.teams?.home?.name || match.Equipe1 || "");
    const away = translateTeam(fixture.teams?.away?.name || match.Equipe2 || "");
    const scoreHome = scoreValue(fixture.goals?.home);
    const scoreAway = scoreValue(fixture.goals?.away);
    const score1 = reversed ? scoreAway : scoreHome;
    const score2 = reversed ? scoreHome : scoreAway;
    const status = statusLabel(fixture.fixture?.status?.short || match.Statut || "");
    const team1 = reversed ? away : home;
    const team2 = reversed ? home : away;

    return {
        id: "M" + match.Id,
        phase: match.Phase || "16es-de-finale",
        date: apiDate(fixture.fixture?.date) || match.Date,
        jour: match.Jour,
        heure: apiTime(fixture.fixture?.date) || match.Heure,
        equipe1: team1 || match.Equipe1,
        equipe2: team2 || match.Equipe2,
        drapeau1: flagFor(team1 || match.Equipe1) || match.Drapeau1,
        drapeau2: flagFor(team2 || match.Equipe2) || match.Drapeau2,
        score1,
        score2,
        statut: status,
        minute: String(fixture.fixture?.status?.elapsed ?? ""),
        winner: winnerName(team1, team2, score1, score2, status),
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
        statut: match.Statut || "À venir",
        minute: "",
        winner: match.Vainqueur || match.Winner || ""
    };
}

function findSiteMatch(home, away, siteMatches) {
    const direct = siteMatches.find(match => sameTeam(match.Domicile, home) && sameTeam(match.Exterieur, away));
    if (direct) return { match: direct, reversed: false };

    const reversed = siteMatches.find(match => sameTeam(match.Domicile, away) && sameTeam(match.Exterieur, home));
    return reversed ? { match: reversed, reversed: true } : null;
}

function findFixture(home, away, fixtures) {
    const direct = fixtures.find(fixture => {
        const fixtureHome = translateTeam(fixture.teams?.home?.name || "");
        const fixtureAway = translateTeam(fixture.teams?.away?.name || "");
        return sameTeam(home, fixtureHome) && sameTeam(away, fixtureAway);
    });

    if (direct) return { fixture: direct, reversed: false };

    const reversed = fixtures.find(fixture => {
        const fixtureHome = translateTeam(fixture.teams?.home?.name || "");
        const fixtureAway = translateTeam(fixture.teams?.away?.name || "");
        return sameTeam(home, fixtureAway) && sameTeam(away, fixtureHome);
    });

    return reversed ? { fixture: reversed, reversed: true } : null;
}

function statusLabel(short) {
    const status = String(short || "").toUpperCase();
    if (["1H", "2H", "ET", "BT", "P", "HT"].includes(status)) return "En cours";
    if (["FT", "AET", "PEN"].includes(status)) return "Terminé";
    if (["NS", "TBD"].includes(status)) return "À venir";
    if (["PST", "CANC", "ABD"].includes(status)) return "Reporté";
    return short || "À venir";
}

function winnerName(home, away, score1, score2, status) {
    if (status !== "Terminé") return "";
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
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
}

function apiTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

function translateTeam(name) {
    return aliases[name] || name;
}

function flagFor(name) {
    return flagCodes[normalize(name)] || "";
}

function sameTeam(left, right) {
    return normalize(left) === normalize(right);
}

function normalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function fixEncoding(text) {
    return text
        .replace(/^\uFEFF/, "")
        .replace(/Ãƒâ€°|Ã‰/g, "É")
        .replace(/ÃƒÂ©|Ã©/g, "é")
        .replace(/ÃƒÂ¨|Ã¨/g, "è")
        .replace(/ÃƒÂª|Ãª/g, "ê")
        .replace(/ÃƒÂ«|Ã«/g, "ë")
        .replace(/Ãƒ |Ã /g, "à")
        .replace(/ÃƒÂ¢|Ã¢/g, "â")
        .replace(/ÃƒÂ®|Ã®/g, "î")
        .replace(/ÃƒÂ¯|Ã¯/g, "ï")
        .replace(/ÃƒÂ´|Ã´/g, "ô")
        .replace(/ÃƒÂ¶|Ã¶/g, "ö")
        .replace(/ÃƒÂ¹|Ã¹/g, "ù")
        .replace(/ÃƒÂ»|Ã»/g, "û")
        .replace(/ÃƒÂ¼|Ã¼/g, "ü")
        .replace(/ÃƒÂ§|Ã§/g, "ç");
}

module.exports = {
    fetchFixtures,
    apiConfigInfo,
    knockoutFixtureIds,
    knockoutFixtureDates,
    readJSON,
    safeReadJSON,
    toKnockoutLiveScores,
    toSiteLiveScores
};
