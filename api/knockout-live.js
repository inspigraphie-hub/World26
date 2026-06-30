const { apiConfigInfo, fetchFixtures, knockoutFixtureIds, safeReadJSON, toKnockoutLiveScores } = require("./_api-football");
const { mergeMatches, readMatches, saveMatches } = require("./_firebase");

const EMPTY_KNOCKOUT = {
    updatedAt: new Date().toISOString(),
    source: "empty-fallback",
    matches: []
};

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    try {
        if (!process.env.APIFOOTBALL_KEY) {
            return res.status(200).json({
                ...safeReadJSON("data/knockout_live.json", EMPTY_KNOCKOUT),
                source: "local-fallback-no-api-key",
                apiConfig: apiConfigInfo()
            });
        }

        const fixtures = await fetchFixtures({
            includeCompetitionFixtures: true,
            fixtureIds: knockoutFixtureIds()
        });
        const data = toKnockoutLiveScores(fixtures);
        const storedMatches = await readMatches("matches");
        data.matches = mergeMatches(data.matches, storedMatches);
        if (data.matchedCount > 0 || data.matches.some(match => match.winner || match.score1 || match.score2)) {
            await saveMatches("matches", data.matches);
        }
        data.firebase = { enabled: storedMatches.length > 0 || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64), storedMatches: storedMatches.length };
        return res.status(200).json(data);
    } catch (error) {
        const fallback = safeReadJSON("data/knockout_live.json", EMPTY_KNOCKOUT);
        const storedMatches = await readMatches("matches");
        fallback.matches = mergeMatches(fallback.matches || [], storedMatches);
        return res.status(200).json({
            ...fallback,
            source: "local-fallback-api-error",
            apiConfig: apiConfigInfo(),
            firebase: { enabled: storedMatches.length > 0 || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64), storedMatches: storedMatches.length },
            warning: error.message
        });
    }
};
