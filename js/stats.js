class StatsManager {

    constructor() {
        this.scorersContainer = document.getElementById("scorersContainer");
        this.assistsContainer = document.getElementById("assistsContainer");
        this.pollMs = 30000;
    }

    async init() {
        try {
            await this.renderStats();
            this.startLiveRefresh();
        } catch(error) {
            console.error(error);
            this.scorersContainer.innerHTML = "<p>Impossible de charger les meilleurs buteurs.</p>";
            this.assistsContainer.innerHTML = "<p>Impossible de charger les meilleurs passeurs.</p>";
        }
    }

    async renderStats() {
        const [fallbackScorers, fallbackAssists, live] = await Promise.all([
            this.loadCSV("data/meilleurs_buteurs.csv"),
            this.loadCSV("data/meilleurs_passeurs.csv"),
            this.loadLiveStats()
        ]);

        const scorers = this.mergePlayers(fallbackScorers, live.scorers || [], "Buts");
        const assists = this.mergePlayers(fallbackAssists, live.assists || [], "Passes D.");

        this.displayPlayers(scorers.slice(0, 8), this.scorersContainer, "Buts", "buts");
        this.displayPlayers(assists.slice(0, 8), this.assistsContainer, "Passes D.", "passes");
    }

    async loadLiveStats() {
        try {
            const response = await fetch("data/live_stats.json?t=" + Date.now(), { cache: "no-store" });
            if(!response.ok) return { scorers: [], assists: [] };
            return await response.json();
        } catch(error) {
            return { scorers: [], assists: [] };
        }
    }

    async loadCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder("utf-8");

        let csv = decoder.decode(buffer);
        csv = this.fixEncoding(csv);

        return this.parseCSV(csv);
    }

    fixEncoding(text) {
        return text
            .replace(/^\uFEFF/, "")
            .replace(/Ãƒâ€°/g, "É")
            .replace(/ÃƒÂ©/g, "é")
            .replace(/ÃƒÂ¨/g, "è")
            .replace(/ÃƒÂª/g, "ê")
            .replace(/ÃƒÂ«/g, "ë")
            .replace(/Ãƒ /g, "à")
            .replace(/ÃƒÂ¢/g, "â")
            .replace(/ÃƒÂ®/g, "î")
            .replace(/ÃƒÂ¯/g, "ï")
            .replace(/ÃƒÂ´/g, "ô")
            .replace(/ÃƒÂ¶/g, "ö")
            .replace(/ÃƒÂ¹/g, "ù")
            .replace(/ÃƒÂ»/g, "û")
            .replace(/ÃƒÂ¼/g, "ü")
            .replace(/ÃƒÂ§/g, "ç");
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/);
        const separator = lines[0].includes(";") ? ";" : ",";

        const headers = lines[0]
            .split(separator)
            .map(header => header.replace(/^\uFEFF/, "").trim());

        return lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const values = line.split(separator);
            const obj = {};

            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : "";
            });

            return obj;
        });
    }

    displayPlayers(players, container, statColumn, label) {
        container.innerHTML = "";

        players.forEach((player, index) => {
            const rank = Number(player.Rang || index + 1);
            const name = player.Joueurs || player.name || "Joueur";
            const photo = player.Photo || this.playerPhoto(name);
            const value = player[statColumn] || 0;

            const html = `
<div class="player-card" style="animation-delay:${index * 0.12}s">
    <div class="player-rank ${this.getRankClass(rank)}">${rank}</div>

    <div class="player-photo-wrap">
        <img
            src="assets/players/${photo}"
            data-base="${this.slug(name)}"
            data-step="0"
            alt="${this.escape(name)}"
            class="player-photo"
            onerror="window.handlePlayerImageError && window.handlePlayerImageError(this)"
        >
        <span>${this.initials(name)}</span>
    </div>

    <div class="player-content">
        <div class="player-name">${this.escape(name)}</div>
        <div class="player-stat">${value}<span>${label}</span></div>
    </div>
</div>`;

            container.insertAdjacentHTML("beforeend", html);
        });
    }

    mergePlayers(fallbackRows, liveRows, statColumn) {
        const map = new Map();

        fallbackRows.forEach(row => {
            const name = row.Joueurs || row.name;
            if(!name) return;
            map.set(this.slug(name), { ...row });
        });

        liveRows.forEach(row => {
            const name = row.Joueurs || row.name || row.player;
            if(!name) return;
            const key = this.slug(name);
            const existing = map.get(key) || {};
            map.set(key, {
                ...existing,
                ...row,
                Joueurs: name,
                Photo: row.Photo || existing.Photo || this.playerPhoto(name),
                [statColumn]: String(row[statColumn] ?? row.value ?? existing[statColumn] ?? 0)
            });
        });

        return [...map.values()]
            .sort((a, b) => Number(b[statColumn] || 0) - Number(a[statColumn] || 0) || String(a.Joueurs).localeCompare(String(b.Joueurs), "fr"))
            .map((row, index) => ({ ...row, Rang: index + 1 }));
    }

    startLiveRefresh() {
        setInterval(() => this.renderStats(), this.pollMs);
    }

    playerPhoto(name) {
        return this.slug(name) + ".png";
    }

    slug(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    initials(name) {
        return String(name || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0])
            .join("")
            .toUpperCase();
    }

    escape(value) {
        return String(value || "").replace(/[&<>"]/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;"
        }[char]));
    }

    getRankClass(rank) {
        if(rank === 1) return "gold";
        if(rank === 2) return "silver";
        if(rank === 3) return "bronze";
        return "";
    }

}

window.handlePlayerImageError = function(img) {
    const base = img.dataset.base;
    const step = Number(img.dataset.step || 0);
    const next = ["jpg", "webp", "jpeg"][step];

    if(next) {
        img.dataset.step = String(step + 1);
        img.src = "assets/players/" + base + "." + next;
        return;
    }

    img.style.display = "none";
    img.closest(".player-photo-wrap")?.classList.add("missing-photo");
};

document.addEventListener("DOMContentLoaded", () => {
    const manager = new StatsManager();
    manager.init();
});
