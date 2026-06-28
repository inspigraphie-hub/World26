const { apiConfigInfo, fetchFixtures, knockoutFixtureIds, safeReadJSON, toKnockoutLiveScores } = require("./_api-football");

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
        return res.status(200).json(toKnockoutLiveScores(fixtures));
    } catch (error) {
        return res.status(200).json({
            ...safeReadJSON("data/knockout_live.json", EMPTY_KNOCKOUT),
            source: "local-fallback-api-error",
            apiConfig: apiConfigInfo(),
            warning: error.message
        });
    }
};
