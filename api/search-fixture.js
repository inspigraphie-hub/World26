const BASE_URL = "https://v3.football.api-sports.io";

const aliases = {
    "france": ["France"],
    "suede": ["Sweden", "Suede", "Suède"],
    "suède": ["Sweden", "Suede", "Suède"]
};

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    try {
        const apiKey = process.env.APIFOOTBALL_KEY;
        if (!apiKey) return res.status(200).json({ ok: false, error: "APIFOOTBALL_KEY manquante" });

        const home = String(req.query.home || "France");
        const away = String(req.query.away || "Sweden");
        const date = String(req.query.date || "2026-06-30");
        const season = String(req.query.season || process.env.APIFOOTBALL_SEASON || "2026");
        const league = String(req.query.league || process.env.APIFOOTBALL_LEAGUE || process.env.APIFOOTBALL_LEAGUE_ID || "");

        const homeTeams = await searchTeams(home, apiKey);
        const awayTeams = await searchTeams(away, apiKey);
        const teamIds = [...homeTeams, ...awayTeams].map(row => row.team?.id).filter(Boolean);
        const fixtures = [];
        const diagnostics = [];
        const seen = new Set();

        for (const teamId of teamIds) {
            const queries = [
                { team: teamId, season, date },
                { team: teamId, date }
            ];
            if (league) queries.push({ team: teamId, league, season, date });

            for (const query of queries) {
                const result = await apiGet("/fixtures", query, apiKey);
                diagnostics.push({ query, count: result.response.length, errors: result.errors });
                result.response.forEach(fixture => {
                    const id = fixture.fixture?.id;
                    if (seen.has(id)) return;
                    seen.add(id);
                    fixtures.push(fixture);
                });
            }
        }

        const wantedHome = normalize(home);
        const wantedAway = normalize(away);
        const matches = fixtures.filter(fixture => {
            const a = normalize(fixture.teams?.home?.name || "");
            const b = normalize(fixture.teams?.away?.name || "");
            return (a.includes(wantedHome) || wantedHome.includes(a) || b.includes(wantedHome) || wantedHome.includes(b))
                && (a.includes(wantedAway) || wantedAway.includes(a) || b.includes(wantedAway) || wantedAway.includes(b));
        });

        return res.status(200).json({
            ok: true,
            search: { home, away, date, league, season },
            homeTeams: homeTeams.map(formatTeam),
            awayTeams: awayTeams.map(formatTeam),
            fixtureCount: fixtures.length,
            matchedCount: matches.length,
            diagnostics,
            matches: matches.map(formatFixture),
            candidates: fixtures.map(formatFixture).slice(0, 30)
        });
    } catch (error) {
        return res.status(200).json({ ok: false, error: error.message });
    }
};

async function searchTeams(name, apiKey) {
    const names = aliases[normalize(name)] || [name];
    const all = [];
    const seen = new Set();
    for (const search of names) {
        const result = await apiGet("/teams", { search }, apiKey);
        result.response.forEach(row => {
            const id = row.team?.id;
            if (seen.has(id)) return;
            seen.add(id);
            all.push(row);
        });
    }
    return all.slice(0, 8);
}

async function apiGet(path, params, apiKey) {
    const url = new URL(BASE_URL + path);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
    });
    const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    if (!response.ok) throw new Error("API-Football " + response.status + ": " + await response.text());
    const payload = await response.json();
    return { ...payload, response: Array.isArray(payload.response) ? payload.response : [] };
}

function formatTeam(row) {
    return {
        id: row.team?.id,
        name: row.team?.name,
        country: row.team?.country,
        national: row.team?.national
    };
}

function formatFixture(row) {
    return {
        id: row.fixture?.id,
        date: row.fixture?.date,
        status: row.fixture?.status,
        league: row.league ? { id: row.league.id, name: row.league.name, country: row.league.country, season: row.league.season } : null,
        home: row.teams?.home?.name,
        away: row.teams?.away?.name,
        goals: row.goals,
        score: row.score
    };
}

function normalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
