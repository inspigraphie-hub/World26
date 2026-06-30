const { apiConfigInfo, fetchFixtures, safeReadJSON, toSiteLiveScores } = require("./_api-football");
const { mergeMatches, readMatches, saveMatches } = require("./_firebase");

const EMPTY_LIVE_SCORES = {
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
                ...safeReadJSON("data/live_scores.json", EMPTY_LIVE_SCORES),
                source: "local-fallback-no-api-key",
                apiConfig: apiConfigInfo()
            });
        }

        const fixtures = await fetchFixtures();
        const data = toSiteLiveScores(fixtures);
        const storedMatches = await readMatches("groupMatches");
        data.matches = mergeMatches(data.matches, storedMatches);
        if (data.matchedCount > 0) {
            await saveMatches("groupMatches", data.matches);
        }
        data.firebase = { enabled: storedMatches.length > 0 || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64), storedMatches: storedMatches.length };
        return res.status(200).json(data);
    } catch (error) {
        const fallback = safeReadJSON("data/live_scores.json", EMPTY_LIVE_SCORES);
        const storedMatches = await readMatches("groupMatches");
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
