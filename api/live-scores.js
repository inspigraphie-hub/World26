const { apiConfigInfo, fetchFixtures, safeReadJSON, toSiteLiveScores } = require("./_api-football");

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
        return res.status(200).json(toSiteLiveScores(fixtures));
    } catch (error) {
        return res.status(200).json({
            ...safeReadJSON("data/live_scores.json", EMPTY_LIVE_SCORES),
            source: "local-fallback-api-error",
            apiConfig: apiConfigInfo(),
            warning: error.message
        });
    }
};
