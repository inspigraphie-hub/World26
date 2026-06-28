const { fetchFixtures, readJSON, toKnockoutLiveScores } = require("./_api-football");

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

    try {
        if (!process.env.APIFOOTBALL_KEY) {
            return res.status(200).json({
                ...readJSON("data/knockout_live.json"),
                source: "local-fallback-no-api-key"
            });
        }

        const fixtures = await fetchFixtures();
        return res.status(200).json(toKnockoutLiveScores(fixtures));
    } catch (error) {
        return res.status(200).json({
            ...readJSON("data/knockout_live.json"),
            source: "local-fallback-api-error",
            warning: error.message
        });
    }
};
