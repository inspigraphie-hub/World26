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
                this.loadCSV("data/Classement.csv"),
                this.loadLiveScores(),
                this.loadLiveStats(),
                this.loadKnockoutMatches()
            ]);
            this.matches = this.sortUpcomingFirst(this.mergeLiveScores([...data[0], ...data[6]], data[4].matches || []));
            this.scorers = this.mergePlayers(data[1], data[5].scorers || [], "Buts");
            this.assists = this.mergePlayers(data[2], data[5].assists || [], "Passes D.");
            this.standings = this.buildStandingsFromMatches(this.matches, data[3]);

            this.renderPulse();
            this.renderCountdown();
            this.renderQuickRankings();
            this.enhanceMatchCards();
            document.addEventListener("matches:updated", () => this.enhanceMatchCards());
            document.addEventListener("scores:live-update", event => {
                this.matches = event.detail?.matches || this.matches;
                this.standings = this.buildStandingsFromMatches(this.matches, this.standings);
                this.renderPulse();
                this.renderCountdown();
                this.renderQuickRankings();
            });
        } catch(error) {
            console.error(error);
        }
    }

    async loadCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        if(!response.ok) throw new Error("Impossible de charger " + path);
        const text = await response.text();
        return this.parseCSV(this.fixEncoding(text));
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

    async loadLiveStats() {
        try {
            const response = await fetch("data/live_stats.json?t=" + Date.now(), { cache: "no-store" });
            if(!response.ok) return { scorers: [], assists: [] };
            return await response.json();
        } catch(error) {
            return { scorers: [], assists: [] };
        }
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

    mergeLiveScores(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => liveMap.set(this.matchKey(match), match));

        return matches.map(match => {
            const live = liveMap.get(this.matchKey(match));
            if(!live) return match;
            return {
                ...match,
                "Score Domicile": live["Score Domicile"] ?? live.scoreHome ?? live.score1 ?? match["Score Domicile"],
                "Score Exterieur": live["Score Exterieur"] ?? live.scoreAway ?? live.score2 ?? match["Score Exterieur"],
                Statut: live.Statut ?? live.status ?? match.Statut,
                Minute: live.Minute ?? live.minute ?? match.Minute ?? ""
            };
        });
    }

    mergePlayers(fallbackRows, liveRows, statColumn) {
        const map = new Map();

        fallbackRows.forEach(row => {
            const name = row.Joueurs || row.name;
            if(!name) return;
            map.set(this.normalize(name), { ...row });
        });

        liveRows.forEach(row => {
            const name = row.Joueurs || row.name || row.player;
            if(!name) return;
            const key = this.normalize(name);
            const existing = map.get(key) || {};
            map.set(key, {
                ...existing,
                ...row,
                Joueurs: name,
                Photo: row.Photo || existing.Photo || "",
                [statColumn]: String(row[statColumn] ?? row.value ?? existing[statColumn] ?? 0)
            });
        });

        return [...map.values()]
            .sort((a,b) => Number(b[statColumn] || 0) - Number(a[statColumn] || 0) || String(a.Joueurs).localeCompare(String(b.Joueurs), "fr"))
            .map((row, index) => ({ ...row, Rang: index + 1 }));
    }

    buildStandingsFromMatches(matches, fallback) {
        const map = new Map();

        const ensure = team => {
            if(!map.has(team)) {
                map.set(team, { "Équipe": team, J: 0, G: 0, N: 0, P: 0, Bp: 0, Bc: 0, "Dif.": 0, Pts: 0 });
            }
            return map.get(team);
        };

        matches.filter(match => this.statusKey(match) === "done").forEach(match => {
            const home = ensure(match.Domicile);
            const away = ensure(match.Exterieur);
            const homeScore = Number(match["Score Domicile"]);
            const awayScore = Number(match["Score Exterieur"]);
            if(Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

            home.J += 1; away.J += 1;
            home.Bp += homeScore; home.Bc += awayScore;
            away.Bp += awayScore; away.Bc += homeScore;

            if(homeScore > awayScore) {
                home.G += 1; away.P += 1; home.Pts += 3;
            } else if(awayScore > homeScore) {
                away.G += 1; home.P += 1; away.Pts += 3;
            } else {
                home.N += 1; away.N += 1; home.Pts += 1; away.Pts += 1;
            }
        });

        if(map.size === 0) return fallback;

        return [...map.values()].map(team => ({
            ...team,
            "Dif.": team.Bp - team.Bc
        })).sort((a, b) => b.Pts - a.Pts || b["Dif."] - a["Dif."] || b.Bp - a.Bp);
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
        const todayMatches = this.matches.filter(match => match.Date === this.todayKey() && this.isActuallyUpcoming(match));
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
        const upcoming = this.matches.filter(match => this.isActuallyUpcoming(match)).slice(0, 4);
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
        return this.sortUpcomingFirst(this.matches).find(match => this.isActuallyUpcoming(match));
    }

    nextMatchForTeam(team) {
        return this.sortUpcomingFirst(this.matches).find(match => this.isActuallyUpcoming(match) && [match.Domicile, match.Exterieur].includes(team));
    }

    sortUpcomingFirst(matches) {
        const upcoming = matches.filter(match => this.isActuallyUpcoming(match)).sort((a, b) => this.matchDateTimeValue(a) - this.matchDateTimeValue(b));
        const done = matches.filter(match => !this.isActuallyUpcoming(match)).sort((a, b) => this.matchDateTimeValue(b) - this.matchDateTimeValue(a));
        return [...upcoming, ...done];
    }

    isActuallyUpcoming(match) {
        const status = this.statusKey(match);
        if(status === "live") return true;
        if(status === "done") return false;

        const value = this.matchDateTimeValue(match);
        if(!value) return true;

        return value >= Date.now();
    }

    matchDateTimeValue(match) {
        return this.sortDateValue(match._rawDate || match.Date) + this.timeValue(match.Heure) * 60000;
    }

    sortDateValue(value) {
        const text = (value || "").toString().trim();
        const fullDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if(fullDate) return new Date(Number(fullDate[3]), Number(fullDate[2]) - 1, Number(fullDate[1])).getTime();
        const compactDate = text.match(/^(\d{1,2})-([a-zéèêûôîïç]+)/i);
        if(compactDate) {
            const months = { janv:0, fevr:1, févr:1, mars:2, avr:3, mai:4, juin:5, juil:6, aout:7, août:7, sept:8, oct:9, nov:10, dec:11, déc:11 };
            return new Date(2026, months[this.normalize(compactDate[2])] ?? 0, Number(compactDate[1])).getTime();
        }
        return 0;
    }

    timeValue(value) {
        const match = (value || "").toString().match(/^(\d{1,2}):(\d{2})$/);
        if(!match) return 0;
        return Number(match[1]) * 60 + Number(match[2]);
    }

    displayDate(value) {
        const match = (value || "").toString().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if(!match) return value || "";
        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return Number(match[1]) + "-" + months[Number(match[2]) - 1];
    }

    opponentFor(match, team) {
        return match.Domicile === team ? match.Exterieur : match.Domicile;
    }

    matchKey(match) {
        return [
            match.Date || match.date || "",
            match.Groupe || match.group || "",
            match.Domicile || match.home || match.equipe1 || "",
            match.Exterieur || match.away || match.equipe2 || ""
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
