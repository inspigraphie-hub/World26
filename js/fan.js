class FanExperience {
    constructor() {
        this.matches = [];
        this.scorers = [];
        this.assists = [];
        this.standings = [];
        this.favoriteKey = "worldcupFavoriteTeam";
        this.predictionKey = "worldcupPredictions";
    }

    async init() {
        try {
            const data = await Promise.all([
                this.loadCSV("data/Resultats_Coupe_du_Monde.csv"),
                this.loadCSV("data/meilleurs_buteurs.csv"),
                this.loadCSV("data/meilleurs_passeurs.csv"),
                this.loadCSV("data/Classement.csv")
            ]);
            this.matches = data[0];
            this.scorers = data[1];
            this.assists = data[2];
            this.standings = data[3];

            this.renderPulse();
            this.renderCountdown();
            this.renderQuickRankings();
            this.enhanceMatchCards();
            document.addEventListener("matches:updated", () => this.enhanceMatchCards());
        } catch(error) {
            console.error(error);
        }
    }

    async loadCSV(path) {
        const response = await fetch(path);
        if(!response.ok) throw new Error("Impossible de charger " + path);
        const text = await response.text();
        return this.parseCSV(this.fixEncoding(text));
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
        const lines = csv.trim().split(/\r?\n/).filter(line => line.trim() !== "");
        const headerIndex = lines.findIndex(line => line.includes(";") && !line.startsWith("Classement des"));
        const usefulLines = headerIndex >= 0 ? lines.slice(headerIndex) : lines;
        const separator = usefulLines[0].includes(";") ? ";" : ",";
        const headers = usefulLines[0].split(separator).map(header => header.trim());
        return usefulLines.slice(1).map(line => {
            const values = line.split(separator);
            const obj = {};
            headers.forEach((header, index) => obj[header] = values[index] ? values[index].trim() : "");
            return obj;
        });
    }

    renderPulse() {
        const containers = document.querySelectorAll("#sitePulse");
        if(containers.length === 0) return;
        const todayMatches = this.matches.filter(match => match.Date === this.todayKey());
        const next = this.nextUpcomingMatch();
        const france = this.teamStatus("France");
        const brazil = this.nextMatchForTeam("Brésil");
        const chips = [
            "<span><i class=\"fa-solid fa-calendar-day\"></i>" + todayMatches.length + " match" + (todayMatches.length > 1 ? "s" : "") + " aujourd’hui</span>",
            france ? "<span><i class=\"fa-solid fa-flag\"></i>France " + france + "</span>" : "",
            brazil ? "<span><i class=\"fa-solid fa-futbol\"></i>Brésil : " + brazil.Date + "</span>" : "",
            next ? "<span><i class=\"fa-solid fa-bolt\"></i>Prochain : " + next.Domicile + " - " + next.Exterieur + "</span>" : ""
        ].filter(Boolean).join("");
        containers.forEach(container => container.innerHTML = chips);
    }

    renderFavoriteTools() {
        const select = document.getElementById("favoriteTeamSelect");
        const button = document.getElementById("saveFavoriteTeam");
        if(!select || !button) return;
        const teams = this.uniqueTeams();
        const saved = localStorage.getItem(this.favoriteKey) || "France";
        select.innerHTML = teams.map(team => "<option value=\"" + this.escape(team) + "\"" + (team === saved ? " selected" : "") + ">" + team + "</option>").join("");
        button.addEventListener("click", () => {
            localStorage.setItem(this.favoriteKey, select.value);
            this.renderFavoriteSummary(select.value);
        });
        this.renderFavoriteSummary(saved);
    }

    renderFavoriteSummary(team) {
        const box = document.getElementById("favoriteTeamSummary");
        if(!box) return;
        const next = this.nextMatchForTeam(team);
        const status = this.teamStatus(team);
        const href = "equipe.html?team=" + encodeURIComponent(team);
        box.innerHTML = "<strong>" + team + "</strong>" +
            "<span>" + (status || "À suivre") + "</span>" +
            "<span>" + (next ? "Prochain match : " + next.Date + " contre " + this.opponentFor(next, team) : "Aucun match à venir") + "</span>" +
            "<a href=\"" + href + "\">Voir la page équipe</a>";
    }

    renderCountdown() {
        const title = document.getElementById("nextMatchTitle");
        const box = document.getElementById("nextMatchCountdown");
        if(!title || !box) return;
        const next = this.nextUpcomingMatch();
        if(!next) {
            title.textContent = "Aucun match à venir";
            box.textContent = "Tous les matchs du calendrier sont terminés.";
            return;
        }
        title.textContent = next.Domicile + " - " + next.Exterieur;
        box.innerHTML = "<span>" + next.Date + "</span><strong>" + this.daysUntil(next.Date) + "</strong><span>" + next.Groupe + "</span>";
    }

    renderQuickRankings() {
        const grid = document.getElementById("quickRankingsGrid");
        if(!grid) return;
        const attacks = [...this.standings].sort((a,b) => Number(b.Bp || 0) - Number(a.Bp || 0));
        const defenses = [...this.standings].sort((a,b) => Number(a.Bc || 99) - Number(b.Bc || 99));
        const qualified = this.standings.filter(team => Number(team.Pts || 0) >= 6).slice(0, 6);
        const upcoming = this.matches.filter(match => this.statusKey(match) !== "done").slice(0, 4);
        grid.innerHTML = [
            this.rankingCard("Top buteurs", "fa-futbol", "green", this.scorers.slice(0, 5).map(player => ({ label: player.Joueurs, value: player.Buts + " buts" }))),
            this.rankingCard("Top passeurs", "fa-wand-magic-sparkles", "cyan", this.assists.slice(0, 5).map(player => ({ label: player.Joueurs, value: player["Passes D."] + " passes" }))),
            this.rankingCard("Meilleures attaques", "fa-bolt", "red", attacks.slice(0, 5).map(team => ({ label: team["Équipe"], value: team.Bp + " BP" }))),
            this.rankingCard("Meilleures défenses", "fa-shield-halved", "purple", defenses.slice(0, 5).map(team => ({ label: team["Équipe"], value: team.Bc + " BC" }))),
            this.rankingCard("Équipes en forme", "fa-trophy", "gold", qualified.map(team => ({ label: team["Équipe"], value: team.Pts + " pts" }))),
            this.rankingCard("Prochains gros matchs", "fa-calendar-days", "dark", upcoming.map(match => ({ label: match.Domicile + " - " + match.Exterieur, value: match.Date })))
        ].join("");
    }

    rankingCard(title, icon, tone, rows) {
        const content = rows.length
            ? rows.map((row, index) => "<p><span><em>" + (index + 1) + "</em>" + row.label + "</span><b>" + row.value + "</b></p>").join("")
            : "<p><span><em>0</em>À venir</span><b>-</b></p>";
        return "<article class=\"quick-ranking-card compact tone-" + tone + "\"><div class=\"ranking-card-head\"><i class=\"fa-solid " + icon + "\"></i><h3>" + title + "</h3></div>" + content + "</article>";
    }

    enhanceMatchCards() {
        this.linkTeams();
    }

    linkTeams() {
        document.querySelectorAll(".team h3").forEach(name => {
            if(name.querySelector("a")) return;
            const team = name.textContent.trim();
            if(!team) return;
            name.innerHTML = "<a href=\"equipe.html?team=" + encodeURIComponent(team) + "\">" + team + "</a>";
        });
    }

    addCardActions() {
        document.querySelectorAll(".match-card").forEach(card => {
            if(card.querySelector(".match-actions")) return;
            const teams = [...card.querySelectorAll(".team h3")].map(node => node.textContent.trim());
            if(teams.length < 2) return;
            const actions = document.createElement("div");
            actions.className = "match-actions";
            actions.innerHTML = "<button type=\"button\" class=\"share-match\"><i class=\"fa-solid fa-share-nodes\"></i><span>Partager</span></button>";
            actions.querySelector(".share-match").addEventListener("click", () => this.shareMatch(card.innerText.split("\n").filter(Boolean).join(" | ")));
            card.appendChild(actions);
        });
    }

    getPredictions() {
        try { return JSON.parse(localStorage.getItem(this.predictionKey) || "{}"); }
        catch(error) { return {}; }
    }

    async shareMatch(text) {
        if(navigator.share) {
            await navigator.share({ title: "Coupe du Monde 2026", text });
            return;
        }
        await navigator.clipboard?.writeText(text);
    }

    uniqueTeams() {
        return [...new Set(this.matches.flatMap(match => [match.Domicile, match.Exterieur]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "fr"));
    }

    statusKey(match) {
        const status = (match.Statut || "").toLowerCase();
        if(status.includes("direct") || status.includes("cours")) return "live";
        if(status.includes("termin")) return "done";
        return "upcoming";
    }

    todayKey() {
        const date = new Date();
        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return date.getDate() + "-" + months[date.getMonth()];
    }

    nextUpcomingMatch() {
        return this.matches.find(match => this.statusKey(match) !== "done");
    }

    nextMatchForTeam(team) {
        return this.matches.find(match => this.statusKey(match) !== "done" && [match.Domicile, match.Exterieur].includes(team));
    }

    opponentFor(match, team) {
        return match.Domicile === team ? match.Exterieur : match.Domicile;
    }

    teamStatus(team) {
        const row = this.standings.find(item => item["Équipe"] === team || (item["Équipe"] === "République de Corée" && team === "Corée du Sud"));
        if(!row) return "à suivre";
        if(Number(row.Pts || 0) >= 6) return "bien placée";
        if(Number(row.Pts || 0) >= 4) return "en lutte";
        return "sous pression";
    }

    daysUntil(dateKey) {
        const parts = dateKey.split("-");
        const months = { juin:5, juil:6 };
        const target = new Date(2026, months[parts[1]] ?? 5, Number(parts[0]));
        const diff = Math.ceil((target - new Date()) / 86400000);
        if(diff <= 0) return "Aujourd’hui";
        if(diff === 1) return "Demain";
        return "Dans " + diff + " jours";
    }

    escape(value) {
        return (value || "").replace(/[&<>\"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const fanExperience = new FanExperience();
    fanExperience.init();
});
