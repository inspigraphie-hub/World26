const BASE_URL = "https://v3.football.api-sports.io";
const ALLOWED_ENDPOINTS = new Set(["leagues", "teams", "fixtures"]);

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    try {
        const apiKey = process.env.APIFOOTBALL_KEY;
        if (!apiKey) return res.status(200).json({ ok: false, error: "APIFOOTBALL_KEY manquante" });

        const endpoint = String(req.query.endpoint || "leagues").replace(/^\/+/, "");
        if (!ALLOWED_ENDPOINTS.has(endpoint)) {
            return res.status(200).json({ ok: false, error: "Endpoint interdit", allowed: [...ALLOWED_ENDPOINTS] });
        }

        const params = { ...req.query };
        delete params.endpoint;

        const payload = await apiGet("/" + endpoint, params, apiKey);
        return res.status(200).json({
            ok: true,
            endpoint,
            params,
            count: payload.response.length,
            errors: payload.errors || null,
            paging: payload.paging || null,
            results: payload.results ?? payload.response.length,
            sample: payload.response.slice(0, 25).map(item => simplify(endpoint, item))
        });
    } catch (error) {
        return res.status(200).json({ ok: false, error: error.message });
    }
};

async function apiGet(path, params, apiKey) {
    const url = new URL(BASE_URL + path);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
    });
    const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const text = await response.text();
    if (!response.ok) throw new Error("API-Football " + response.status + ": " + text);
    return JSON.parse(text);
}

function simplify(endpoint, item) {
    if (endpoint === "leagues") {
        return {
            leagueId: item.league?.id,
            leagueName: item.league?.name,
            type: item.league?.type,
            country: item.country?.name,
            seasons: Array.isArray(item.seasons) ? item.seasons.map(season => season.year).slice(-6) : []
        };
    }

    if (endpoint === "teams") {
        return {
            teamId: item.team?.id,
            teamName: item.team?.name,
            country: item.team?.country,
            national: item.team?.national
        };
    }

    return {
        fixtureId: item.fixture?.id,
        date: item.fixture?.date,
        status: item.fixture?.status,
        league: item.league ? { id: item.league.id, name: item.league.name, country: item.league.country, season: item.league.season } : null,
        home: item.teams?.home?.name,
        away: item.teams?.away?.name,
        goals: item.goals,
        score: item.score
    };
}
