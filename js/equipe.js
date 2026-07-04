class TeamPage {
    constructor() {
        this.matches = [];
        this.standings = [];
        this.team = new URLSearchParams(window.location.search).get("team") || localStorage.getItem("worldcupFavoriteTeam") || "France";
    }

    async init() {
        try {
            const [groupMatches, knockoutMatches, standings] = await Promise.all([
                this.loadCSV("data/Resultats_Coupe_du_Monde.csv"),
                this.loadKnockoutMatches(),
                this.loadCSV("data/Classement.csv")
            ]);
            this.matches = [...groupMatches, ...knockoutMatches];
            this.standings = standings;
            this.render();
        } catch(error) {
            console.error(error);
            document.getElementById("teamName").textContent = "Équipe introuvable";
        }
    }

    async loadCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        if(!response.ok) throw new Error("Impossible de charger " + path);
        const text = await response.text();
        return this.parseCSV(text.replace(/^\uFEFF/, ""));
    }

    async loadKnockoutMatches() {
        try {
            const rows = await this.loadCSV("data/Matchs_16es_Coupe_du_Monde_2026.csv");
            return rows.map(row => ({
                Date: this.displayDate(row.Date),
                Groupe: "16e de finale",
                Domicile: row.Equipe1 || row["Équipe1"] || "",
                Exterieur: row.Equipe2 || row["Équipe2"] || "",
                "Score Domicile": row.Score1 || "",
                "Score Exterieur": row.Score2 || "",
                Statut: row.Statut || "À venir",
                Heure: row.Heure || "",
                _rawDate: row.Date || ""
            }));
        } catch(error) {
            return [];
        }
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/).filter(Boolean);
        const separator = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(separator).map(header => header.trim());
        return lines.slice(1).map(line => {
            const values = line.split(separator);
            const item = {};
            headers.forEach((header, index) => item[header] = values[index] ? values[index].trim() : "");
            return item;
        });
    }

    render() {
        const teamName = document.getElementById("teamName");
        const summary = document.getElementById("teamSummary");
        const matchList = document.getElementById("teamMatches");
        const stats = document.getElementById("teamStats");
        if(!teamName || !summary || !matchList || !stats) return;

        const row = this.findStanding();
        const teamMatches = this.matches.filter(match => this.involvesTeam(match));
        const next = teamMatches.find(match => this.statusKey(match) !== "done");
        const finished = teamMatches.filter(match => this.statusKey(match) === "done");
        const wins = finished.filter(match => this.resultFor(match) === "Victoire").length;

        teamName.textContent = this.team;
        document.title = this.team + " - Coupe du Monde FIFA 2026";
        summary.innerHTML = [
            this.summaryTile("Groupe", row?.Groupe || "À venir"),
            this.summaryTile("Points", row?.Pts || "0"),
            this.summaryTile("Bilan", row ? row.G + "V " + row.N + "N " + row.P + "D" : wins + "V"),
            this.summaryTile("Prochain", next ? next.Date : "Aucun")
        ].join("");

        matchList.innerHTML = teamMatches.length
            ? teamMatches.map(match => this.matchRow(match)).join("")
            : "<p>Aucun match trouvé pour cette équipe.</p>";

        stats.innerHTML = row
            ? [
                this.statTile("Joués", row.J),
                this.statTile("Victoires", row.G),
                this.statTile("Nuls", row.N),
                this.statTile("Défaites", row.P),
                this.statTile("Buts pour", row.Bp),
                this.statTile("Buts contre", row.Bc),
                this.statTile("Différence", row["Dif."]),
                this.statTile("Points", row.Pts)
            ].join("")
            : "<p>Stats à venir.</p>";

        this.renderPulse(teamMatches, row);
    }

    renderPulse(teamMatches, row) {
        const pulse = document.getElementById("sitePulse");
        if(!pulse) return;

        const today = this.matches.filter(match => match.Date === this.todayKey());
        const next = teamMatches.find(match => this.statusKey(match) !== "done");
        const qualified = row && Number(row.Pts || 0) >= 6;

        pulse.innerHTML = [
            "<span><i class=\"fa-solid fa-calendar-day\"></i>" + today.length + " match" + (today.length > 1 ? "s" : "") + " aujourd'hui</span>",
            "<span><i class=\"fa-solid fa-flag\"></i>" + this.team + (qualified ? " qualifiée" : " à suivre") + "</span>",
            "<span><i class=\"fa-solid fa-futbol\"></i>" + (next ? "Prochain : " + next.Date : "Parcours de groupe terminé") + "</span>"
        ].join("");
    }

    summaryTile(label, value) {
        return "<span>" + label + "<b>" + value + "</b></span>";
    }

    statTile(label, value) {
        return "<div class=\"team-stat\">" + label + "<b>" + (value || "0") + "</b></div>";
    }

    matchRow(match) {
        const opponent = this.opponentFor(match);
        const status = this.statusLabel(match);
        const result = this.resultFor(match);
        const score = this.scoreText(match);
        return [
            "<article class=\"team-match-row " + this.statusKey(match) + "\">",
            "<span>" + match.Date + "</span>",
            "<div><strong>" + this.team + " - " + opponent + "</strong><br><small>" + match.Groupe + " • " + status + "</small></div>",
            "<b>" + (score || result) + "</b>",
            "</article>"
        ].join("");
    }

    findStanding() {
        const aliases = [this.team];
        if(this.team === "Corée du Sud") aliases.push("République de Corée");
        if(this.team === "République de Corée") aliases.push("Corée du Sud");
        return this.standings.find(row => aliases.includes(row["Équipe"]));
    }

    involvesTeam(match) {
        return this.sameTeam(match.Domicile) || this.sameTeam(match.Exterieur);
    }

    sameTeam(name) {
        return name === this.team || (this.team === "Corée du Sud" && name === "République de Corée") || (this.team === "République de Corée" && name === "Corée du Sud");
    }

    opponentFor(match) {
        return this.sameTeam(match.Domicile) ? match.Exterieur : match.Domicile;
    }

    displayDate(value) {
        const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if(!match) return value || "";
        const months = ["janv", "f?vr", "mars", "avr", "mai", "juin", "juil", "ao?t", "sept", "oct", "nov", "d?c"];
        return Number(match[1]) + "-" + months[Number(match[2]) - 1];
    }

    scoreText(match) {
        if(match["Score Domicile"] === "" || match["Score Exterieur"] === "") return "";
        const home = this.sameTeam(match.Domicile);
        return home
            ? match["Score Domicile"] + " - " + match["Score Exterieur"]
            : match["Score Exterieur"] + " - " + match["Score Domicile"];
    }

    resultFor(match) {
        if(this.statusKey(match) !== "done") return this.statusLabel(match);
        const homeScore = Number(match["Score Domicile"]);
        const awayScore = Number(match["Score Exterieur"]);
        if(Number.isNaN(homeScore) || Number.isNaN(awayScore) || homeScore === awayScore) return "Nul";
        const homeWin = homeScore > awayScore;
        return (this.sameTeam(match.Domicile) && homeWin) || (this.sameTeam(match.Exterieur) && !homeWin) ? "Victoire" : "Défaite";
    }

    statusKey(match) {
        const status = (match.Statut || "").toLowerCase();
        if(status.includes("direct") || status.includes("cours")) return "live";
        if(status.includes("termin")) return "done";
        return "upcoming";
    }

    statusLabel(match) {
        const key = this.statusKey(match);
        if(key === "live") return "En direct";
        if(key === "done") return "Terminé";
        return "À venir";
    }

    todayKey() {
        const date = new Date();
        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return date.getDate() + "-" + months[date.getMonth()];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const page = new TeamPage();
    page.init();
});
