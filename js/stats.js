class StatsManager {

    constructor() {
        this.scorersContainer = document.getElementById("scorersContainer");
        this.assistsContainer = document.getElementById("assistsContainer");
    }

    async init() {
        try {
            const scorers = await this.loadCSV("data/meilleurs_buteurs.csv");
            const assists = await this.loadCSV("data/meilleurs_passeurs.csv");

            this.displayPlayers(scorers, this.scorersContainer, "Buts", "buts");
            this.displayPlayers(assists, this.assistsContainer, "Passes D.", "passes");

        } catch(error) {
            console.error(error);
            this.scorersContainer.innerHTML = "<p>Impossible de charger les meilleurs buteurs.</p>";
            this.assistsContainer.innerHTML = "<p>Impossible de charger les meilleurs passeurs.</p>";
        }
    }

    async loadCSV(path) {
        const response = await fetch(path);
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder("utf-8");

        let csv = decoder.decode(buffer);
        csv = this.fixEncoding(csv);

        return this.parseCSV(csv).slice(0, 5);
    }

    fixEncoding(text) {
        return text
            .replace(/^\uFEFF/, "")
            .replace(/Ã‰/g, "É")
            .replace(/Ã©/g, "é")
            .replace(/Ã¨/g, "è")
            .replace(/Ãª/g, "ê")
            .replace(/Ã«/g, "ë")
            .replace(/Ã /g, "à")
            .replace(/Ã¢/g, "â")
            .replace(/Ã®/g, "î")
            .replace(/Ã¯/g, "ï")
            .replace(/Ã´/g, "ô")
            .replace(/Ã¶/g, "ö")
            .replace(/Ã¹/g, "ù")
            .replace(/Ã»/g, "û")
            .replace(/Ã¼/g, "ü")
            .replace(/Ã§/g, "ç");
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/);
        const separator = lines[0].includes(";") ? ";" : ",";

        const headers = lines[0]
            .split(separator)
            .map(header => header.replace(/^\uFEFF/, "").trim());

        let data = [];

        lines.slice(1).forEach(line => {
            if(line.trim() === "") return;

            const values = line.split(separator);
            let obj = {};

            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : "";
            });

            data.push(obj);
        });

        return data;
    }

    displayPlayers(players, container, statColumn, label) {
        container.innerHTML = "";

        players.forEach((player, index) => {
            const rank = Number(player["Rang"] || index + 1);
            const name = player["Joueurs"];
            const photo = player["Photo"];
            const value = player[statColumn];

            const html = `

<div class="player-card" style="animation-delay:${index * 0.12}s">

    <div class="player-rank ${this.getRankClass(rank)}">
        ${rank}
    </div>

    <img 
        src="assets/players/${photo}" 
        alt="${name}" 
        class="player-photo"
    >

    <div class="player-content">
        <div class="player-name">${name}</div>

        <div class="player-stat">
            ${value}<span>${label}</span>
        </div>
    </div>

</div>

`;

            container.insertAdjacentHTML("beforeend", html);
        });
    }

    getRankClass(rank) {
        if(rank === 1) return "gold";
        if(rank === 2) return "silver";
        if(rank === 3) return "bronze";
        return "";
    }

}

document.addEventListener("DOMContentLoaded", () => {
    const manager = new StatsManager();
    manager.init();
});