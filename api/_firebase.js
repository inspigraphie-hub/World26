let adminApp = null;
let firestore = null;

function serviceAccountFromEnv() {
    const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (rawBase64) {
        return JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8"));
    }

    if (rawJson) {
        return JSON.parse(rawJson);
    }

    return null;
}

function getFirestore() {
    if (firestore) return firestore;

    const serviceAccount = serviceAccountFromEnv();
    if (!serviceAccount) return null;

    const admin = require("firebase-admin");

    if (!adminApp) {
        adminApp = admin.apps.length
            ? admin.app()
            : admin.initializeApp({
                credential: admin.credential.cert({
                    ...serviceAccount,
                    private_key: String(serviceAccount.private_key || "").replace(/\\n/g, "\n")
                })
            });
    }

    firestore = admin.firestore();
    return firestore;
}

async function saveMatches(collectionName, matches) {
    const db = getFirestore();
    if (!db || !Array.isArray(matches) || matches.length === 0) return false;

    const batch = db.batch();
    const now = new Date().toISOString();

    matches.forEach(match => {
        const id = String(match.id || match.apiFixtureId || match.Date + "-" + match.Domicile + "-" + match.Exterieur);
        if (!id || id.includes("undefined")) return;
        const ref = db.collection(collectionName).doc(id);
        batch.set(ref, { ...match, updatedAt: now }, { merge: true });
    });

    await batch.commit();
    return true;
}

async function readMatches(collectionName) {
    const db = getFirestore();
    if (!db) return [];

    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function mergeMatches(baseMatches, storedMatches) {
    if (!Array.isArray(storedMatches) || storedMatches.length === 0) return baseMatches;

    const storedById = new Map(storedMatches.map(match => [String(match.id), match]));

    return baseMatches.map(match => {
        const stored = storedById.get(String(match.id));
        if (!stored) return match;
        return { ...match, ...stored };
    });
}

module.exports = {
    getFirestore,
    mergeMatches,
    readMatches,
    saveMatches
};
