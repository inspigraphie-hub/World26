class StandingsManager {

    constructor() {
        this.container = document.getElementById("standingsContainer");
        this.thirdsContainer = document.getElementById("thirdsContainer");
        this.refreshTimer = null;
    }

    async init() {
        try {
            const baseStandings = await this.loadCSV("data/Classement.csv");
            const thirdsTable = await this.loadThirdsCSV("data/Classement3.csv");
            const matches = await this.loadMatches();
            const standings = this.recalculateStandings(baseStandings, matches);
            const groups = this.getGroups(standings);
            const qualifiedThirds = this.getQualifiedThirdsFromFile(thirdsTable);

            this.displayGroups(groups, qualifiedThirds);
            this.displayThirds(thirdsTable);
            if(!this.refreshTimer) this.startLiveRefresh();
        } catch(error) {
            console.error(error);
            this.container.innerHTML = "<h2>Impossible de charger le classement.</h2>";
        }
    }

    async loadCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        const buffer = await response.arrayBuffer();
        const csv = this.fixEncoding(new TextDecoder("utf-8").decode(buffer));
        return this.parseCSV(csv);
    }

    async loadMatches() {
        try {
            const matches = await this.loadCSV("data/Resultats_Coupe_du_Monde.csv");
            const live = await this.loadLiveScores();
            return this.mergeLiveScores(matches, live.matches || []);
        } catch(error) {
            return [];
        }
    }

    async loadLiveScores() {
        try {
            const response = await fetch("data/live_scores.json?t=" + Date.now(), { cache: "no-store" });
            if(!response.ok) return { matches: [] };
            return await response.json();
        } catch(error) {
            return { matches: [] };
        }
    }

    mergeLiveScores(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => liveMap.set(this.matchKey(match), match));

        return matches.map(match => {
            const live = liveMap.get(this.matchKey(match));
            if(!live) return match;
            return {
                ...match,
                "Score Domicile": live["Score Domicile"] ?? match["Score Domicile"],
                "Score Exterieur": live["Score Exterieur"] ?? match["Score Exterieur"],
                Statut: live.Statut ?? match.Statut
            };
        });
    }

    fixEncoding(text) {
        return text
            .replace(/^\uFEFF/, "")
            .replace(/Ãƒâ€°|Ã‰/g, "É")
            .replace(/ÃƒÂ©|Ã©/g, "é")
            .replace(/ÃƒÂ¨|Ã¨/g, "è")
            .replace(/ÃƒÂª|Ãª/g, "ê")
            .replace(/ÃƒÂ«|Ã«/g, "ë")
            .replace(/Ãƒ |Ã /g, "à")
            .replace(/ÃƒÂ¢|Ã¢/g, "â")
            .replace(/ÃƒÂ®|Ã®/g, "î")
            .replace(/ÃƒÂ¯|Ã¯/g, "ï")
            .replace(/ÃƒÂ´|Ã´/g, "ô")
            .replace(/ÃƒÂ¶|Ã¶/g, "ö")
            .replace(/ÃƒÂ¹|Ã¹/g, "ù")
            .replace(/ÃƒÂ»|Ã»/g, "û")
            .replace(/ÃƒÂ¼|Ã¼/g, "ü")
            .replace(/ÃƒÂ§|Ã§/g, "ç");
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/).filter(Boolean);
        const separator = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(separator).map(header => header.replace(/^\uFEFF/, "").trim());

        return this.rowsFromLines(lines.slice(1), headers, separator);
    }

    async loadThirdsCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        const buffer = await response.arrayBuffer();
        const csv = this.fixEncoding(new TextDecoder("utf-8").decode(buffer));
        return this.parseThirdsCSV(csv);
    }

    parseThirdsCSV(csv) {
        const lines = csv.trim().split(/\r?\n/).filter(Boolean);
        const headerIndex = lines.findIndex(line => {
            const clean = line.replace(/^\uFEFF/, "").trim().toLowerCase();
            return clean.startsWith("rang;") || clean.startsWith("rang,");
        });

        if(headerIndex === -1) return [];

        const separator = lines[headerIndex].includes(";") ? ";" : ",";
        const headers = lines[headerIndex].split(separator).map(header => header.replace(/^\uFEFF/, "").trim());
        return this.rowsFromLines(lines.slice(headerIndex + 1), headers, separator);
    }

    rowsFromLines(lines, headers, separator) {
        return lines.filter(line => line.trim() !== "").map(line => {
            const values = line.split(separator);
            const obj = {};
            headers.forEach((header, index) => obj[header] = values[index] ? values[index].trim() : "");
            return obj;
        });
    }

    recalculateStandings(data, matches) {
        if(matches.length === 0) return data;

        const rows = data.map(row => ({
            ...row,
            J: "0",
            G: "0",
            N: "0",
            P: "0",
            Bp: "0",
            Bc: "0",
            "Dif.": "0",
            Pts: "0"
        }));
        const map = new Map(rows.map(row => [this.normalize(this.teamName(row)), row]));

        matches.filter(match => this.statusKey(match) === "done").forEach(match => {
            const home = map.get(this.normalize(match.Domicile));
            const away = map.get(this.normalize(match.Exterieur));
            const homeScore = Number(match["Score Domicile"]);
            const awayScore = Number(match["Score Exterieur"]);
            if(!home || !away || Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

            this.applyResult(home, homeScore, awayScore);
            this.applyResult(away, awayScore, homeScore);
        });

        rows.forEach(row => row["Dif."] = String(Number(row.Bp) - Number(row.Bc)));
        return rows;
    }

    applyResult(row, goalsFor, goalsAgainst) {
        row.J = String(Number(row.J) + 1);
        row.Bp = String(Number(row.Bp) + goalsFor);
        row.Bc = String(Number(row.Bc) + goalsAgainst);

        if(goalsFor > goalsAgainst) {
            row.G = String(Number(row.G) + 1);
            row.Pts = String(Number(row.Pts) + 3);
        } else if(goalsFor < goalsAgainst) {
            row.P = String(Number(row.P) + 1);
        } else {
            row.N = String(Number(row.N) + 1);
            row.Pts = String(Number(row.Pts) + 1);
        }
    }

    getGroups(data) {
        const groups = {};

        data.forEach(team => {
            const group = team.Groupe;
            if(!group) return;
            if(!groups[group]) groups[group] = [];
            groups[group].push(team);
        });

        Object.keys(groups).forEach(group => groups[group].sort((a, b) => this.sortTeams(a, b)));
        return groups;
    }

    sortTeams(a, b) {
        return Number(b.Pts) - Number(a.Pts)
            || Number(b["Dif."]) - Number(a["Dif."])
            || Number(b.Bp) - Number(a.Bp)
            || Number(a.PFP || 0) - Number(b.PFP || 0);
    }

    getQualifiedThirdsFromFile(thirdsTable) {
        return thirdsTable
            .filter(team => this.isQualified(team.Statut))
            .map(team => this.normalize(this.teamName(team)));
    }

    isQualified(status) {
        const value = this.normalize(status);
        return value === "qualifie" || value === "phase-finale" || value === "qualifies";
    }

    displayGroups(groups, qualifiedThirds) {
        this.container.innerHTML = "";

        Object.keys(groups).sort().forEach(group => {
            let html = `
<div class="standing-card">
    <div class="standing-title">${this.escape(group)}</div>
    <table class="standing-table">
        <thead>
            <tr>
                <th>#</th>
                <th class="team-col">Équipe</th>
                <th>J</th>
                <th>G</th>
                <th>N</th>
                <th>P</th>
                <th>BP</th>
                <th>BC</th>
                <th>Diff</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody>`;

            groups[group].forEach((team, index) => {
                const position = index + 1;
                const teamName = this.teamName(team);
                const diff = Number(team["Dif."]);
                const diffClass = diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-neutral";
                let rowClass = "";

                if(position <= 2) rowClass = "qualified";
                else if(position === 3 && qualifiedThirds.includes(this.normalize(teamName))) rowClass = "best-third";
                else rowClass = "eliminated";

                html += this.standingRow(team, teamName, position, diffClass, rowClass);
            });

            html += "</tbody></table></div>";
            this.container.insertAdjacentHTML("beforeend", html);
        });
    }

    displayThirds(thirdsTable) {
        let html = `
<div class="thirds-card">
    <table class="standing-table">
        <thead>
            <tr>
                <th>#</th>
                <th class="team-col">Équipe</th>
                <th>Grp</th>
                <th>J</th>
                <th>G</th>
                <th>N</th>
                <th>P</th>
                <th>BP</th>
                <th>BC</th>
                <th>Diff</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody>`;

        thirdsTable.forEach((team, index) => {
            const teamName = this.teamName(team);
            const diff = Number(team["Dif."]);
            const diffClass = diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-neutral";
            const rowClass = this.isQualified(team.Statut) ? "thirds-qualified" : "eliminated";
            const position = Number(team.Rang) || index + 1;
            html += this.standingRow(team, teamName, position, diffClass, rowClass, true);
        });

        html += "</tbody></table></div>";
        this.thirdsContainer.innerHTML = html;
    }

    standingRow(team, teamName, position, diffClass, rowClass, showGroup = false) {
        return `
<tr class="${rowClass}">
    <td class="rank">${position}</td>
    <td>
        <div class="team-cell">
            <img src="assets/flags/${this.flag(teamName)}" alt="${this.escape(teamName)}">
            <span>${this.escape(teamName)}</span>
        </div>
    </td>
    ${showGroup ? `<td>${this.escape(team.Groupe)}</td>` : ""}
    <td>${team.J}</td>
    <td>${team.G}</td>
    <td>${team.N}</td>
    <td>${team.P}</td>
    <td>${team.Bp}</td>
    <td>${team.Bc}</td>
    <td class="${diffClass}">${team["Dif."]}</td>
    <td class="points">${team.Pts}</td>
</tr>`;
    }

    startLiveRefresh() {
        this.refreshTimer = setInterval(async () => {
            try {
                const baseStandings = await this.loadCSV("data/Classement.csv");
                const thirdsTable = await this.loadThirdsCSV("data/Classement3.csv");
                const matches = await this.loadMatches();
                const standings = this.recalculateStandings(baseStandings, matches);
                const groups = this.getGroups(standings);
                const qualifiedThirds = this.getQualifiedThirdsFromFile(thirdsTable);
                this.displayGroups(groups, qualifiedThirds);
                this.displayThirds(thirdsTable);
            } catch(error) {
                console.warn("Classement live en attente", error);
            }
        }, 30000);
    }

    teamName(row) {
        const key = Object.keys(row || {}).find(item => this.normalize(item) === "equipe");
        return key ? row[key] : "";
    }

    statusKey(match) {
        const status = this.normalize(match.Statut || "");
        if(status.includes("termin")) return "done";
        if(status.includes("cours") || status.includes("direct")) return "live";
        return "upcoming";
    }

    matchKey(match) {
        return [
            match.Date || "",
            match.Groupe || "",
            match.Domicile || "",
            match.Exterieur || ""
        ].map(value => this.normalize(value)).join("|");
    }

    normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    flag(country) {
        const flags = {
            "afghanistan":"af", "afrique-du-sud":"za", "albanie":"al", "algerie":"dz",
            "allemagne":"de", "angleterre":"gb-eng", "arabie-saoudite":"sa", "argentine":"ar",
            "australie":"au", "autriche":"at", "belgique":"be", "bolivie":"bo",
            "bosnie-herzegovine":"ba", "bosnie-et-herzegovine":"ba", "bresil":"br", "bulgarie":"bg",
            "cap-vert":"cv", "cameroun":"cm", "jordanie":"jo", "canada":"ca", "chili":"cl", "chine":"cn",
            "colombie":"co", "rd-congo":"cd", "coree-du-sud":"kr", "costa-rica":"cr",
            "cote-d-ivoire":"ci", "croatie":"hr", "danemark":"dk", "egypte":"eg",
            "equateur":"ec", "espagne":"es","ecosse":"gb-sct", "etats-unis":"us", "france":"fr", "ghana":"gh",
            "grece":"gr", "haiti":"ht", "iran":"ir", "irak":"iq", "italie":"it", "japon":"jp",
            "maroc":"ma", "mexique":"mx", "nigeria":"ng", "norvege":"no", "nouvelle-zelande":"nz",
            "ouzbekistan":"uz", "panama":"pa", "paraguay":"py", "pays-bas":"nl",
            "pays-de-galles":"gb-wls", "pologne":"pl", "portugal":"pt", "qatar":"qa",
            "senegal":"sn", "serbie":"rs", "suede":"se", "suisse":"ch", "tchequie":"cz",
            "tunisie":"tn", "turquie":"tr", "ukraine":"ua", "uruguay":"uy", "coree":"kr", "curacao":"cw",
        };

        return (flags[this.normalize(country)] || "xx") + ".png";
    }

    escape(value) {
        return String(value || "").replace(/[&<>"]/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;"
        }[char]));
    }

}

document.addEventListener("DOMContentLoaded", () => {
    const manager = new StandingsManager();
    manager.init();
});
