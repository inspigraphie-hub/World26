class MatchManager {
    constructor() {
        this.container = document.getElementById("matchesContainer");
        this.todayContainer = document.getElementById("todayMatches");
        this.todayTitle = document.getElementById("todayTitle");
        this.todayCount = document.getElementById("todayCount");
        this.filters = document.getElementById("matchFilters");
        this.searchInput = document.getElementById("teamSearch");
        this.liveStatus = document.getElementById("liveScoreStatus");
        this.matches = [];
        this.activeFilter = "all";
        this.searchTerm = "";
        this.pollMs = 15 * 60 * 1000;
        this.lastSignature = "";
        this.refreshTimer = null;
    }

    async init() {
        try {
            this.matches = await this.loadMatches();
            this.lastSignature = this.matchesSignature(this.matches);
            this.renderAll();
            this.bindFilters();
            this.bindSearch();
            this.startLiveRefresh();
        } catch (error) {
            console.error(error);
            this.container.innerHTML = `
                <h2>Erreur lors du chargement du calendrier.</h2>
                <p>${error.message}</p>
            `;
        }
    }

    async loadMatches() {
        const [groupMatches, knockoutMatches, live] = await Promise.all([
            this.loadCSV("data/Resultats_Coupe_du_Monde.csv"),
            this.loadKnockoutMatches(),
            this.loadLiveScores()
        ]);

        const projectedKnockout = this.projectNextKnockoutMatches(knockoutMatches);
        return this.sortMatchesForHome(this.mergeLiveScores([...groupMatches, ...knockoutMatches, ...projectedKnockout], live.matches || []));
    }

    async loadCSV(path) {
        const response = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) throw new Error("Impossible de charger le fichier CSV.");

        const buffer = await response.arrayBuffer();
        const csv = this.fixEncoding(new TextDecoder("utf-8").decode(buffer));
        return this.parseCSV(csv);
    }

    async loadKnockoutMatches() {
        try {
            const [csvMatches, live] = await Promise.all([
                this.loadCSV("data/Matchs_16es_Coupe_du_Monde_2026.csv"),
                this.loadKnockoutLive()
            ]);
            this._knockoutIndex = 0;
            return this.mergeKnockoutLive(csvMatches.map(match => this.normalizeKnockoutMatch(match)), live.matches || []);
        } catch (error) {
            return [];
        }
    }

    async loadKnockoutLive() {
        try {
            return await this.fetchJSONWithFallback("/api/knockout-live", "data/knockout_live.json");
        } catch (error) {
            return { matches: [] };
        }
    }

    async loadLiveScores() {
        try {
            return await this.fetchJSONWithFallback("/api/live-scores", "data/live_scores.json");
        } catch (error) {
            return { matches: [] };
        }
    }

    async fetchJSONWithFallback(apiPath, fallbackPath) {
        const paths = [apiPath, fallbackPath];

        for (const path of paths) {
            try {
                const url = path + (path.includes("?") ? "&" : "?") + "t=" + Date.now();
                const response = await fetch(url, { cache: "no-store" });
                if (response.ok) return await response.json();
            } catch (error) {
                // Try the next source.
            }
        }

        return { matches: [] };
    }

    mergeLiveScores(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => liveMap.set(this.matchKey(match), match));

        return matches.map(match => {
            const live = liveMap.get(this.matchKey(match));
            if (!live) return match;

            return {
                ...match,
                "Score Domicile": live["Score Domicile"] ?? live.scoreHome ?? live.score1 ?? match["Score Domicile"],
                "Score Exterieur": live["Score Exterieur"] ?? live.scoreAway ?? live.score2 ?? match["Score Exterieur"],
                "Statut": live.Statut ?? live.status ?? match.Statut,
                "Minute": live.Minute ?? live.minute ?? match.Minute ?? "",
                "_liveUpdated": "1"
            };
        });
    }

    mergeKnockoutLive(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => {
            if(match.id) liveMap.set(String(match.id), match);
            liveMap.set(this.knockoutKey(match.date, match.equipe1, match.equipe2), match);
        });

        return matches.map(match => {
            const live = liveMap.get(match._knockoutId) || liveMap.get(this.knockoutKey(match._rawDate, match.Domicile, match.Exterieur));
            if(!live) return match;

            return {
                ...match,
                Date: this.displayDate(live.date || match._rawDate),
                Domicile: live.equipe1 || match.Domicile,
                Exterieur: live.equipe2 || match.Exterieur,
                "Score Domicile": live.score1 ?? match["Score Domicile"],
                "Score Exterieur": live.score2 ?? match["Score Exterieur"],
                "Statut": live.statut || match.Statut,
                "Minute": live.minute || "",
                Diffuseur: live.diffuseur || match.Diffuseur || "",
                "Drapeau Domicile": live.drapeau1 || match["Drapeau Domicile"],
                "Drapeau Exterieur": live.drapeau2 || match["Drapeau Exterieur"]
            };
        });
    }

    normalizeKnockoutMatch(match) {
        const index = this._knockoutIndex || 0;
        this._knockoutIndex = index + 1;

        return {
            Date: this.displayDate(match.Date),
            Groupe: "16e de finale",
            Domicile: match.Equipe1 || match["Équipe1"] || "",
            "Score Domicile": match.Score1 || "",
            "Score Exterieur": match.Score2 || "",
            Exterieur: match.Equipe2 || match["Équipe2"] || "",
            Statut: match.Statut || "À venir",
            Heure: match.Heure || "",
            Diffuseur: match.Diffuseur || "",
            Vainqueur: match.Vainqueur || match.Winner || "",
            "Drapeau Domicile": match.Drapeau1 || "",
            "Drapeau Exterieur": match.Drapeau2 || "",
            _rawDate: match.Date || "",
            _sortDate: this.sortDateValue(match.Date),
            _knockoutId: "M" + (73 + index),
            _isKnockout: "1"
        };
    }

    projectNextKnockoutMatches(matches) {
        const fixtures = [
            { date: "04/07/2026", display: "4-juil", hour: "19:00", phase: "Huiti?mes de finale", home: "Canada", away: "Maroc", homeFlag: "ca.png", awayFlag: "ma.png", scoreHome: "0", scoreAway: "3", status: "Termin?", winner: "Maroc" },
            { date: "04/07/2026", display: "4-juil", hour: "23:00", phase: "Huiti?mes de finale", home: "Paraguay", away: "France", homeFlag: "py.png", awayFlag: "fr.png", scoreHome: "0", scoreAway: "1", status: "Termin?", winner: "France" },
            { date: "05/07/2026", display: "5-juil", hour: "22:00", phase: "Huiti?mes de finale", home: "Br?sil", away: "Norvège", homeFlag: "br.png", awayFlag: "no.png", scoreHome: "1", scoreAway: "2", status: "Termin?", winner: "Norvège" },
            { date: "06/07/2026", display: "6-juil", hour: "02:00", phase: "Huiti?mes de finale", home: "Mexique", away: "Angleterre", homeFlag: "mx.png", awayFlag: "gb-eng.png", scoreHome: "2", scoreAway: "3", status: "Termin?", winner: "Angleterre" },
            { date: "06/07/2026", display: "6-juil", hour: "21:00", phase: "Huiti?mes de finale", home: "Portugal", away: "Espagne", homeFlag: "pt.png", awayFlag: "es.png", scoreHome: "0", scoreAway: "1", status: "Termin?", winner: "Espagne" },
            { date: "07/07/2026", display: "7-juil", hour: "02:00", phase: "Huiti?mes de finale", home: "?tats-Unis", away: "Belgique", homeFlag: "us.png", awayFlag: "be.png", scoreHome: "1", scoreAway: "4", status: "Termin?", winner: "Belgique" },
            { date: "07/07/2026", display: "7-juil", hour: "18:00", phase: "Huiti?mes de finale", home: "Argentine", away: "?gypte", homeFlag: "ar.png", awayFlag: "eg.png", scoreHome: "3", scoreAway: "2", status: "Termin?", winner: "Argentine" },
            { date: "07/07/2026", display: "7-juil", hour: "22:00", phase: "Huiti?mes de finale", home: "Suisse", away: "Colombie", homeFlag: "ch.png", awayFlag: "co.png", scoreHome: "0 (4)", scoreAway: "0 (3)", status: "Termin?", winner: "Suisse" },
            { date: "09/07/2026", display: "9-juil", hour: "21:00", phase: "Quarts de finale", home: "France", away: "Maroc", homeFlag: "fr.png", awayFlag: "ma.png", scoreHome: "2", scoreAway: "0", status: "Termin?", winner: "France" },
            { date: "10/07/2026", display: "10-juil", hour: "21:00", phase: "Quarts de finale", home: "Espagne", away: "Belgique", homeFlag: "es.png", awayFlag: "be.png", scoreHome: "2", scoreAway: "1", status: "Terminé", winner: "Espagne" },
            { date: "11/07/2026", display: "11-juil", hour: "23:00", phase: "Quarts de finale", home: "Norvège", away: "Angleterre", homeFlag: "no.png", awayFlag: "gb-eng.png", scoreHome: "", scoreAway: "", status: "À venir", winner: "" },
            { date: "12/07/2026", display: "12-juil", hour: "03:00", phase: "Quarts de finale", home: "Argentine", away: "Suisse", homeFlag: "ar.png", awayFlag: "ch.png", scoreHome: "", scoreAway: "", status: "À venir", winner: "" },
            { date: "14/07/2026", display: "14-juil", hour: "21:00", phase: "Demi-finales", home: "France", away: "Espagne", homeFlag: "fr.png", awayFlag: "es.png", scoreHome: "", scoreAway: "", status: "À venir", winner: "" }
        ];

        return fixtures.map((fixture, index) => ({
            Date: fixture.display,
            Groupe: fixture.phase || "Huiti?mes de finale",
            Domicile: fixture.home,
            Exterieur: fixture.away,
            "Score Domicile": fixture.scoreHome || "",
            "Score Exterieur": fixture.scoreAway || "",
            Statut: fixture.status || "À venir",
            Heure: fixture.hour,
            Minute: fixture.minute || "",
            Diffuseur: "",
            Vainqueur: fixture.winner || "",
            "Drapeau Domicile": fixture.homeFlag,
            "Drapeau Exterieur": fixture.awayFlag,
            _rawDate: fixture.date,
            _sortDate: this.sortDateValue(fixture.date),
            _knockoutId: "M" + (89 + index),
            _isProjectedKnockout: "1"
        }));
    }

    winnerFromMatch(match) {
        if(!match || this.statusKey(match) !== "done") return null;
        const explicit = match.Vainqueur || match.Winner || "";
        if(explicit) {
            if(this.sameTeamName(explicit, match.Domicile)) return { team: match.Domicile, flag: match["Drapeau Domicile"] };
            if(this.sameTeamName(explicit, match.Exterieur)) return { team: match.Exterieur, flag: match["Drapeau Exterieur"] };
            return { team: explicit, flag: this.flag(explicit, "") };
        }

        const home = Number(this.splitPenaltyScore(match["Score Domicile"]).score);
        const away = Number(this.splitPenaltyScore(match["Score Exterieur"]).score);
        if(Number.isNaN(home) || Number.isNaN(away) || home === away) return null;
        return home > away
            ? { team: match.Domicile, flag: match["Drapeau Domicile"] }
            : { team: match.Exterieur, flag: match["Drapeau Exterieur"] };
    }

    sameTeamName(left, right) {
        return this.normalizeText(left) === this.normalizeText(right);
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
        const headers = lines[0].split(separator).map(header => header.replace(/^\uFEFF/, "").trim());

        return lines.slice(1).filter(line => line.trim() !== "").map(line => {
            const values = line.split(separator);
            const match = {};
            headers.forEach((header, index) => {
                match[header] = values[index] ? values[index].trim() : "";
            });
            return match;
        });
    }

    renderAll() {
        this.renderToday();
        this.display(this.getFilteredMatches());
        this.updateLiveStatus();
    }

    display(matches) {
        this.container.innerHTML = "";

        if (matches.length === 0) {
            this.container.innerHTML = `<div class="empty-state">Aucun match ne correspond à ce filtre.</div>`;
            document.dispatchEvent(new Event("matches:updated"));
            return;
        }

        if (this.activeFilter === "all" && this.searchTerm === "") {
            const upcoming = this.sortUpcomingMatches(matches.filter(match => this.statusKey(match) !== "done"));
            const finished = this.sortFinishedMatches(matches.filter(match => this.statusKey(match) === "done"));

            if (upcoming.length) {
                this.container.insertAdjacentHTML("beforeend", `<h3 class="matches-section-title">Matchs à suivre</h3>`);
                upcoming.forEach((match, index) => this.container.insertAdjacentHTML("beforeend", this.createCard(match, index)));
            }

            if (finished.length) {
                this.container.insertAdjacentHTML("beforeend", `<h3 class="matches-section-title">Matchs terminés</h3>`);
                finished.forEach((match, index) => this.container.insertAdjacentHTML("beforeend", this.createCard(match, index)));
            }

            document.dispatchEvent(new Event("matches:updated"));
            return;
        }

        matches.forEach((match, index) => {
            this.container.insertAdjacentHTML("beforeend", this.createCard(match, index));
        });

        document.dispatchEvent(new Event("matches:updated"));
    }

    createCard(match, index) {
        const status = this.statusKey(match);

        return `
<div class="match-card reveal ${status} ${match._liveUpdated ? "score-updated" : ""}" data-match-key="${this.matchKey(match)}" style="animation-delay:${(index % 12) * 0.06}s">
    <div class="match-date">
        <span>${match["Date"]}</span>
        <span>${match["Groupe"]}</span>
        <span class="status-pill ${status}">${this.statusLabel(match)}</span>
    </div>

    <div class="teams">
        <div class="team ${this.isWinner(match, "home") ? "winner" : ""}">
            <img src="assets/flags/${this.flag(match["Domicile"], match["Drapeau Domicile"])}" alt="${match["Domicile"]}">
            <h3>${this.shortName(match["Domicile"])}</h3>
        </div>

        <div class="score">
            <div class="score-number">${this.scoreHTML(match)}</div>
        </div>

        <div class="team ${this.isWinner(match, "away") ? "winner" : ""}">
            <img src="assets/flags/${this.flag(match["Exterieur"], match["Drapeau Exterieur"])}" alt="${match["Exterieur"]}">
            <h3>${this.shortName(match["Exterieur"])}</h3>
        </div>
    </div>
</div>`;
    }

    bindFilters() {
        if (!this.filters) return;

        this.filters.addEventListener("click", event => {
            const button = event.target.closest(".filter-btn");
            if (!button) return;

            this.activeFilter = button.dataset.filter;
            this.searchTerm = "";

            if (this.searchInput) this.searchInput.value = "";

            this.filters.querySelectorAll(".filter-btn").forEach(filter => {
                filter.classList.toggle("active", filter === button);
            });

            this.display(this.getFilteredMatches());
        });
    }

    bindSearch() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener("input", () => {
            this.searchTerm = this.normalizeText(this.searchInput.value);
            this.display(this.getFilteredMatches());
        });
    }

    getFilteredMatches() {
        const today = this.todayKey();

        return this.matches.filter(match => {
            const status = this.statusKey(match);
            const teams = [match["Domicile"], match["Exterieur"]].map(team => this.normalizeText(team)).join(" ");
            const matchesSearch = this.searchTerm === "" || teams.includes(this.searchTerm);

            if (!matchesSearch) return false;
            if (this.activeFilter === "today") return match["Date"] === today || match._liveUpdated;
            if (this.activeFilter === "france") return [match["Domicile"], match["Exterieur"]].includes("France");
            if (this.activeFilter === "upcoming") return status === "upcoming" || status === "live";
            if (this.activeFilter === "done") return status === "done";

            return true;
        }).sort((a, b) => {
            if (this.activeFilter === "upcoming") return this.matchDateTimeValue(a) - this.matchDateTimeValue(b);
            if (this.activeFilter === "done") return this.matchDateTimeValue(b) - this.matchDateTimeValue(a);
            return 0;
        });
    }

    renderToday() {
        if (!this.todayContainer) return;

        const today = this.todayKey();
        const liveUpdatedMatches = this.matches.filter(match => match._liveUpdated);
        const todayMatches = this.sortMatchesByTime(this.matches.filter(match => match["Date"] === today));
        let matches = todayMatches;
        let title = "Matchs du jour";

        if (liveUpdatedMatches.length > 0) {
            const seen = new Set();
            matches = this.sortMatchesByTime([...liveUpdatedMatches, ...matches].filter(match => {
                const key = this.matchKey(match);
                if(seen.has(key)) return false;
                seen.add(key);
                return true;
            }));
        }

        const hasUpcomingToday = matches.some(match => this.statusKey(match) !== "done");
        if (matches.length === 0 || !hasUpcomingToday) {
            const nextMatches = this.getNextUpcomingMatches(4);
            if(nextMatches.length > 0) {
                matches = nextMatches;
                title = "Prochains matchs";
            }
        }

        this.todayTitle.textContent = title;
        this.todayCount.textContent = `${matches.length} ${matches.length > 1 ? "matchs" : "match"}`;
        this.todayContainer.innerHTML = matches.length
            ? matches.map((match, index) => this.createTodayCard(match, index)).join("")
            : `<div class="empty-state">Aucun match ? afficher pour le moment.</div>`;
    }

    createTodayCard(match, index) {
        const status = this.statusKey(match);

        return `
<article class="today-card ${status} ${match._liveUpdated ? "score-updated" : ""}" style="animation-delay:${index * 0.08}s">
    <div class="today-meta">
        <span>${match["Date"]}</span>
        <span>${match["Groupe"]}</span>
        <span class="status-pill ${status}">${this.statusLabel(match)}</span>
    </div>

    <div class="today-teams">
        ${this.compactTeam(match["Domicile"], "", this.isWinner(match, "home"), match["Drapeau Domicile"])}
        <span class="today-separator">${this.matchCenterText(match)}</span>
        ${this.compactTeam(match["Exterieur"], "", this.isWinner(match, "away"), match["Drapeau Exterieur"])}
    </div>

    ${match.Diffuseur ? `<div class="today-broadcaster">${match.Diffuseur}</div>` : ""}
</article>`;
    }

    compactTeam(country, score, winner, providedFlag = "") {
        return `
<div class="today-team ${winner ? "winner" : ""}">
    <img src="assets/flags/${this.flag(country, providedFlag)}" alt="${country}">
    <strong>${this.shortName(country)}</strong>
    <span>${score || ""}</span>
</div>`;
    }

    startLiveRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);

        this.refreshTimer = setInterval(async () => {
            try {
                const nextMatches = await this.loadMatches();
                const nextSignature = this.matchesSignature(nextMatches);

                if (nextSignature !== this.lastSignature) {
                    this.matches = nextMatches;
                    this.lastSignature = nextSignature;
                    this.renderAll();
                    document.dispatchEvent(new CustomEvent("scores:live-update", { detail: { matches: this.matches } }));
                    return;
                }

                this.updateLiveStatus();
            } catch (error) {
                this.updateLiveStatus("Connexion live en attente", true);
            }
        }, this.pollMs);
    }

    updateLiveStatus(message = "", isWarning = false) {
        if (!this.liveStatus) return;

        const liveCount = this.matches.filter(match => this.statusKey(match) === "live").length;
        const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const label = message || (liveCount > 0 ? liveCount + " match" + (liveCount > 1 ? "s" : "") + " en direct" : "Scores à jour");

        this.liveStatus.classList.toggle("warning", isWarning);
        this.liveStatus.innerHTML = `<i class="fa-solid fa-satellite-dish" aria-hidden="true"></i><span>${label} • ${time}</span>`;
    }

    matchesSignature(matches) {
        return JSON.stringify(matches.map(match => [
            match.Date,
            match.Groupe,
            match.Domicile,
            match.Exterieur,
            match["Score Domicile"],
            match["Score Exterieur"],
            match.Statut,
            match.Minute
        ]));
    }

    scoreText(match) {
        const parts = this.scoreParts(match);
        if (!parts.hasScore) return "vs";
        return parts.main;
    }

    scoreHTML(match) {
        const parts = this.scoreParts(match);
        if (!parts.hasScore) return "vs";
        if (!parts.penalties) return `<span class="score-main">${parts.main}</span>`;
        return `<span class="score-main">${parts.main}</span><span class="score-penalties">TAB ${parts.penalties}</span>`;
    }

    scoreParts(match) {
        const home = match["Score Domicile"] || "";
        const away = match["Score Exterieur"] || "";
        const homeParts = this.splitPenaltyScore(home);
        const awayParts = this.splitPenaltyScore(away);

        return {
            hasScore: home !== "" || away !== "",
            main: `${homeParts.score || "-"} - ${awayParts.score || "-"}`,
            penalties: homeParts.penalty || awayParts.penalty ? `${homeParts.penalty || "-"} - ${awayParts.penalty || "-"}` : ""
        };
    }

    splitPenaltyScore(value) {
        const match = String(value || "").match(/^(\d+)\s*\((\d+)\)$/);
        if (!match) return { score: value || "", penalty: "" };
        return { score: match[1], penalty: match[2] };
    }

    matchCenterText(match) {
        const parts = this.scoreParts(match);
        if (parts.hasScore) return parts.penalties ? `${parts.main} (${parts.penalties} TAB)` : parts.main;
        return this.formatHour(match.Heure) || "vs";
    }

    normalizeText(text) {
        return (text || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    statusLabel(match) {
        const status = this.statusKey(match);
        if (status === "live") return "En direct" + (match.Minute ? " • " + match.Minute + "'" : "");
        if (status === "done") return "Terminé";
        return "À venir";
    }

    statusKey(match) {
        const status = (match["Statut"] || "").toLowerCase();
        if (status.includes("direct") || status.includes("cours")) return "live";
        if (status.includes("termin")) return "done";
        return "upcoming";
    }

    isWinner(match, side) {
        if (this.statusKey(match) !== "done") return false;

        const explicit = match.Vainqueur || match.Winner || "";
        if(explicit) {
            return side === "home"
                ? this.sameTeamName(explicit, match.Domicile)
                : this.sameTeamName(explicit, match.Exterieur);
        }

        const home = Number(match["Score Domicile"]);
        const away = Number(match["Score Exterieur"]);

        if (Number.isNaN(home) || Number.isNaN(away) || home === away) return false;
        return side === "home" ? home > away : away > home;
    }

    todayKey() {
        const date = new Date();
        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return `${date.getDate()}-${months[date.getMonth()]}`;
    }

    sortMatchesByRecentFirst(matches) {
        return this.sortFinishedMatches(matches);
    }

    sortMatchesForHome(matches) {
        const upcoming = this.sortUpcomingMatches(matches.filter(match => this.statusKey(match) !== "done"));
        const finished = this.sortFinishedMatches(matches.filter(match => this.statusKey(match) === "done"));
        return [...upcoming, ...finished];
    }

    sortUpcomingMatches(matches) {
        return [...matches].sort((a, b) => this.matchDateTimeValue(a) - this.matchDateTimeValue(b));
    }

    sortFinishedMatches(matches) {
        return [...matches].sort((a, b) => this.matchDateTimeValue(b) - this.matchDateTimeValue(a));
    }

    matchDateTimeValue(match) {
        return this.sortDateValue(match._rawDate || match.Date) + this.timeValue(match.Heure) * 60000;
    }

    sortMatchesByTime(matches) {
        return [...matches].sort((a, b) => this.timeValue(a.Heure) - this.timeValue(b.Heure));
    }

    getNextUpcomingMatches(limit) {
        const now = new Date();
        return this.matches
            .filter(match => this.statusKey(match) === "upcoming")
            .sort((a, b) => {
                const dateDiff = this.sortDateValue(a._rawDate || a.Date) - this.sortDateValue(b._rawDate || b.Date);
                if (dateDiff !== 0) return dateDiff;
                return this.timeValue(a.Heure) - this.timeValue(b.Heure);
            })
            .filter(match => this.sortDateValue(match._rawDate || match.Date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
            .slice(0, limit);
    }

    sortDateValue(value) {
        const text = (value || "").toString().trim();
        const fullDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

        if (fullDate) {
            return new Date(Number(fullDate[3]), Number(fullDate[2]) - 1, Number(fullDate[1])).getTime();
        }

        const compactDate = text.match(/^(\d{1,2})-([a-zéèêûôîïç]+)/i);

        if (compactDate) {
            const months = {
                janv: 0,
                fevr: 1,
                févr: 1,
                mars: 2,
                avr: 3,
                mai: 4,
                juin: 5,
                juil: 6,
                aout: 7,
                août: 7,
                sept: 8,
                oct: 9,
                nov: 10,
                dec: 11,
                déc: 11
            };
            const monthKey = this.normalizeText(compactDate[2]);
            return new Date(2026, months[monthKey] ?? 0, Number(compactDate[1])).getTime();
        }

        return 0;
    }

    timeValue(value) {
        const match = (value || "").toString().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return 0;
        return Number(match[1]) * 60 + Number(match[2]);
    }

    formatHour(value) {
        const match = (value || "").toString().match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return value || "";
        return `${Number(match[1])}h${match[2]}`;
    }

    displayDate(value) {
        const match = (value || "").toString().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return value || "";

        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return `${Number(match[1])}-${months[Number(match[2]) - 1]}`;
    }

    knockoutKey(date, home, away) {
        return [date || "", home || "", away || ""].map(value => this.normalizeText(value)).join("|");
    }

    matchKey(match) {
        return [
            match.Date || match.date || "",
            match.Groupe || match.group || "",
            match.Domicile || match.home || match.equipe1 || "",
            match.Exterieur || match.away || match.equipe2 || ""
        ].map(value => this.normalizeText(value)).join("|");
    }

    shortName(country) {
        const names = {
            "Ouzbékistan": "Ouzbék.",
            "Bosnie-Herzégovine": "Bosnie",
            "Nouvelle-Zélande": "N.-Zélande",
            "Afrique du Sud": "A. du Sud",
            "Arabie saoudite": "Arabie",
            "Corée du Sud": "Corée S."
        };

        return names[country] || country;
    }

    flag(country, providedFlag = "") {
        if (providedFlag) return providedFlag.includes(".") ? providedFlag : providedFlag + ".png";

        const flags = {
            "Afghanistan": "af",
            "Afrique du Sud": "za",
            "Albanie": "al",
            "Algérie": "dz",
            "Allemagne": "de",
            "Angleterre": "gb-eng",
            "Arabie saoudite": "sa",
            "Argentine": "ar",
            "Australie": "au",
            "Autriche": "at",
            "Belgique": "be",
            "Bolivie": "bo",
            "Bosnie-Herzégovine": "ba",
            "Bosnie-et-Herzégovine": "ba",
            "Brésil": "br",
            "Bulgarie": "bg",
            "Cap-Vert": "cv",
            "Cameroun": "cm",
            "Canada": "ca",
            "Chili": "cl",
            "Chine": "cn",
            "Colombie": "co",
            "RD Congo": "cd",
            "Panama": "pa",
            "Ouzbékistan": "uz",
            "Corée du Nord": "kp",
            "Corée du Sud": "kr",
            "République de Corée": "kr",
            "Costa Rica": "cr",
            "Côte d'Ivoire": "ci",
            "Croatie": "hr",
            "Curaçao": "cw",
            "Danemark": "dk",
            "Égypte": "eg",
            "Écosse": "gb-sct",
            "Équateur": "ec",
            "Espagne": "es",
            "États-Unis": "us",
            "Finlande": "fi",
            "France": "fr",
            "Ghana": "gh",
            "Grèce": "gr",
            "Hongrie": "hu",
            "Haïti": "ht",
            "Irlande": "ie",
            "Iran": "ir",
            "RI Iran": "ir",
            "Irak": "iq",
            "Italie": "it",
            "Japon": "jp",
            "Jordanie": "jo",
            "Maroc": "ma",
            "Mexique": "mx",
            "Nigeria": "ng",
            "Norvège": "no",
            "Nouvelle-Zélande": "nz",
            "Pays-Bas": "nl",
            "Pologne": "pl",
            "Portugal": "pt",
            "Qatar": "qa",
            "Tchéquie": "cz",
            "Roumanie": "ro",
            "Russie": "ru",
            "Sénégal": "sn",
            "Serbie": "rs",
            "Suède": "se",
            "Suisse": "ch",
            "Tunisie": "tn",
            "Turquie": "tr",
            "Ukraine": "ua",
            "Uruguay": "uy",
            "Pays de Galles": "gb-wls",
            "Paraguay": "py"
        };

        return (flags[country] || "xx") + ".png";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const manager = new MatchManager();
    manager.init();
});
