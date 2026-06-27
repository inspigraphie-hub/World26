class PronoApp {
    constructor() {
        this.balanceKey = "worldcupTokens";
        this.betsKey = "worldcupBets";
        this.favoriteKey = "worldcupFavoriteTeam";
        this.bonusKey = "worldcupDailyBonus";
        this.matches = [];
        this.activeFilter = "all";
    }

    async init() {
        try {
            this.ensureWallet();
            this.matches = await this.loadCSV("data/Resultats_Coupe_du_Monde.csv");
            this.bindControls();
            this.render();
        } catch(error) {
            console.error(error);
            document.getElementById("pronoMatches").innerHTML = "<div class=\"empty-state\">Impossible de charger les pronos.</div>";
        }
    }

    async loadCSV(path) {
        const response = await fetch(path);
        if(!response.ok) throw new Error("Impossible de charger " + path);
        const text = await response.text();
        return this.parseCSV(text.replace(/^\uFEFF/, ""));
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

    bindControls() {
        document.getElementById("dailyBonus")?.addEventListener("click", () => this.claimBonus());
        document.getElementById("savePronoFavorite")?.addEventListener("click", () => {
            const select = document.getElementById("pronoFavoriteTeam");
            localStorage.setItem(this.favoriteKey, select.value);
            this.render();
        });
        document.getElementById("resetBets")?.addEventListener("click", () => {
            localStorage.removeItem(this.betsKey);
            localStorage.setItem(this.balanceKey, "1000");
            this.render();
        });
        document.querySelectorAll("[data-prono-filter]").forEach(button => {
            button.addEventListener("click", () => {
                this.activeFilter = button.dataset.pronoFilter;
                document.querySelectorAll("[data-prono-filter]").forEach(item => item.classList.toggle("active", item === button));
                this.renderMatches();
            });
        });
    }

    render() {
        this.renderBalance();
        this.renderFavoritePicker();
        this.renderStats();
        this.renderMatches();
        this.renderHistory();
    }

    ensureWallet() {
        if(localStorage.getItem(this.balanceKey) === null) {
            localStorage.setItem(this.balanceKey, "1000");
        }
    }

    renderBalance() {
        document.getElementById("tokenBalance").textContent = this.balance();
    }

    renderFavoritePicker() {
        const select = document.getElementById("pronoFavoriteTeam");
        const signal = document.getElementById("favoriteSignal");
        if(!select || !signal) return;

        const teams = this.uniqueTeams();
        const favorite = localStorage.getItem(this.favoriteKey) || "France";
        select.innerHTML = teams.map(team => "<option value=\"" + this.escape(team) + "\"" + (team === favorite ? " selected" : "") + ">" + team + "</option>").join("");
        const next = this.nextMatchForTeam(favorite);
        signal.textContent = next
            ? favorite + " joue le " + next.Date + " contre " + this.opponentFor(next, favorite) + "."
            : favorite + " n'a plus de match de groupe à venir.";
    }

    renderStats() {
        const bets = this.bets();
        document.getElementById("openBetsCount").textContent = bets.length;
        document.getElementById("spentTokens").textContent = bets.reduce((sum, bet) => sum + bet.stake, 0);
        document.getElementById("potentialGain").textContent = bets.reduce((sum, bet) => sum + Math.round(bet.stake * bet.odd), 0);
    }

    renderMatches() {
        const box = document.getElementById("pronoMatches");
        if(!box) return;

        const favorite = localStorage.getItem(this.favoriteKey) || "France";
        const betKeys = new Set(this.bets().map(bet => bet.key));
        let matches = this.matches.filter(match => this.statusKey(match) !== "done");

        if(this.activeFilter === "favorite") {
            matches = matches.filter(match => [match.Domicile, match.Exterieur].includes(favorite));
        }
        if(this.activeFilter === "open") {
            matches = matches.filter(match => !betKeys.has(this.matchKey(match)));
        }

        matches = matches.slice(0, 12);
        box.innerHTML = matches.length
            ? matches.map(match => this.matchCard(match, favorite, betKeys.has(this.matchKey(match)))).join("")
            : "<div class=\"empty-state\">Aucun match à miser dans ce filtre.</div>";

        box.querySelectorAll(".odd-button").forEach(button => {
            button.addEventListener("click", () => {
                const card = button.closest(".prono-card");
                card.querySelectorAll(".odd-button").forEach(item => item.classList.toggle("active", item === button));
            });
        });

        box.querySelectorAll(".bet-submit").forEach(button => {
            button.addEventListener("click", () => this.placeBet(button.closest(".prono-card")));
        });
    }

    matchCard(match, favorite, alreadyBet) {
        const key = this.matchKey(match);
        const odds = this.oddsFor(match);
        const isFavorite = [match.Domicile, match.Exterieur].includes(favorite);
        return [
            "<article class=\"prono-card " + (isFavorite ? "favorite" : "") + "\" data-key=\"" + this.escape(key) + "\" data-home=\"" + this.escape(match.Domicile) + "\" data-away=\"" + this.escape(match.Exterieur) + "\" data-date=\"" + this.escape(match.Date) + "\">",
            "<div class=\"prono-card-meta\"><span>" + match.Date + " • " + match.Groupe + "</span><span>" + (alreadyBet ? "Déjà joué" : "Ouvert") + "</span></div>",
            "<div class=\"prono-teams\">",
            this.teamBlock(match.Domicile),
            "<span class=\"versus-pill\">VS</span>",
            this.teamBlock(match.Exterieur),
            "</div>",
            "<div class=\"odds-grid\">",
            this.oddButton("home", match.Domicile, odds.home, alreadyBet),
            this.oddButton("draw", "Nul", odds.draw, alreadyBet),
            this.oddButton("away", match.Exterieur, odds.away, alreadyBet),
            "</div>",
            "<div class=\"bet-row\"><span>Mise</span><input class=\"stake-input\" type=\"number\" min=\"10\" step=\"10\" value=\"50\" " + (alreadyBet ? "disabled" : "") + "></div>",
            "<button class=\"bet-submit\" type=\"button\" " + (alreadyBet ? "disabled" : "") + ">" + (alreadyBet ? "Prono enregistré" : "Miser mes jetons") + "</button>",
            "</article>"
        ].join("");
    }

    teamBlock(team) {
        return "<div class=\"prono-team\"><img src=\"assets/flags/" + this.flag(team) + "\" alt=\"" + this.escape(team) + "\"><span>" + team + "</span></div>";
    }

    oddButton(choice, label, odd, disabled) {
        return "<button type=\"button\" class=\"odd-button\" data-choice=\"" + choice + "\" data-odd=\"" + odd + "\" " + (disabled ? "disabled" : "") + "><span>" + label + "</span><b>" + odd.toFixed(2) + "</b></button>";
    }

    placeBet(card) {
        const selected = card.querySelector(".odd-button.active");
        const stakeInput = card.querySelector(".stake-input");
        const stake = Number(stakeInput.value);
        const balance = this.balance();

        if(!selected) {
            this.flash(card, "Choisis une cote.");
            return;
        }
        if(!Number.isFinite(stake) || stake < 10) {
            this.flash(card, "Mise minimum : 10 jetons.");
            return;
        }
        if(stake > balance) {
            this.flash(card, "Pas assez de jetons.");
            return;
        }

        const bet = {
            key: card.dataset.key,
            home: card.dataset.home,
            away: card.dataset.away,
            date: card.dataset.date,
            choice: selected.dataset.choice,
            label: selected.querySelector("span").textContent,
            odd: Number(selected.dataset.odd),
            stake,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(this.balanceKey, String(balance - stake));
        localStorage.setItem(this.betsKey, JSON.stringify([bet, ...this.bets()]));
        this.render();
    }

    flash(card, message) {
        let note = card.querySelector(".bet-note");
        if(!note) {
            note = document.createElement("div");
            note.className = "bet-note";
            card.appendChild(note);
        }
        note.textContent = message;
    }

    renderHistory() {
        const box = document.getElementById("betsHistory");
        if(!box) return;

        const bets = this.bets();
        box.innerHTML = bets.length
            ? bets.map(bet => "<div class=\"history-row\"><div><b>" + bet.home + " - " + bet.away + "</b><br><span>" + bet.date + " • " + bet.label + " • cote " + bet.odd.toFixed(2) + "</span></div><strong>+" + Math.round(bet.stake * bet.odd) + " potentiel</strong></div>").join("")
            : "<div class=\"empty-state\">Aucun prono pour le moment.</div>";
    }

    claimBonus() {
        const today = new Date().toISOString().slice(0, 10);
        if(localStorage.getItem(this.bonusKey) === today) return;
        localStorage.setItem(this.bonusKey, today);
        localStorage.setItem(this.balanceKey, String(this.balance() + 100));
        this.renderBalance();
    }

    oddsFor(match) {
        const homePower = this.teamPower(match.Domicile);
        const awayPower = this.teamPower(match.Exterieur);
        const gap = homePower - awayPower;
        return {
            home: this.clamp(2.05 - gap * 0.08, 1.35, 3.7),
            draw: this.clamp(3.15 + Math.abs(gap) * 0.03, 2.65, 4.2),
            away: this.clamp(2.05 + gap * 0.08, 1.35, 3.7)
        };
    }

    teamPower(team) {
        const row = this.matches.filter(match => match.Domicile === team || match.Exterieur === team);
        const done = row.filter(match => this.statusKey(match) === "done");
        return done.reduce((sum, match) => {
            const home = match.Domicile === team;
            const forGoals = Number(home ? match["Score Domicile"] : match["Score Exterieur"]) || 0;
            const againstGoals = Number(home ? match["Score Exterieur"] : match["Score Domicile"]) || 0;
            return sum + forGoals - againstGoals;
        }, 0);
    }

    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    balance() {
        return Number(localStorage.getItem(this.balanceKey) || 0);
    }

    bets() {
        try { return JSON.parse(localStorage.getItem(this.betsKey) || "[]"); }
        catch(error) { return []; }
    }

    matchKey(match) {
        return match.Date + "-" + match.Domicile + "-" + match.Exterieur;
    }

    statusKey(match) {
        const status = (match.Statut || "").toLowerCase();
        if(status.includes("direct") || status.includes("cours")) return "live";
        if(status.includes("termin")) return "done";
        return "upcoming";
    }

    uniqueTeams() {
        return [...new Set(this.matches.flatMap(match => [match.Domicile, match.Exterieur]).filter(Boolean))].sort((a,b) => a.localeCompare(b, "fr"));
    }

    nextMatchForTeam(team) {
        return this.matches.find(match => this.statusKey(match) !== "done" && [match.Domicile, match.Exterieur].includes(team));
    }

    opponentFor(match, team) {
        return match.Domicile === team ? match.Exterieur : match.Domicile;
    }

    flag(country) {
        const flags = {
            "Afghanistan":"af",
        "Afrique du Sud":"za",
        "Albanie":"al",
        "Algérie":"dz",
        "Allemagne":"de",
        "Angleterre":"gb-eng",
        "Arabie saoudite":"sa",
        "Argentine":"ar",
        "Australie":"au",
        "Autriche":"at",
        "Belgique":"be",
        "Bolivie":"bo",
        "Bosnie-Herzégovine":"ba",
        "Brésil":"br",
        "Bulgarie":"bg",
        "Cap-Vert":"cv",
        "Cameroun":"cm",
        "Canada":"ca",
        "Chili":"cl",
        "Chine":"cn",
        "Colombie":"co",
        "RD Congo":"cd",
        "Panama":"pa",
        "Ouzbékistan":"uz",
        "Corée du Nord":"kp",
        "Corée du Sud":"kr",
        "Costa Rica":"cr",
        "Côte d'Ivoire":"ci",
        "Croatie":"hr",
        "Curaçao":'cw',
        "Danemark":"dk",
        "Égypte":"eg",
        "Écosse":"gb-sct",
        "Équateur":"ec",
        "Espagne":"es",
        "États-Unis":"us",
        "Finlande":"fi",
        "France":"fr",
        "Ghana":"gh",
        "Grèce":"gr",
        "Hongrie":"hu",
        "Haïti":"ha",
        "Irlande":"ie",
        "Iran":"ir",
        "Irak":"iq",
        "Italie":"it",
        "Japon":"jp",
        "Jordanie":"jo",
        "Maroc":"ma",
        "Mexique":"mx",
        "Nigeria":"ng",
        "Norvège":"no",
        "Nouvelle-Zélande":"nz",
        "Pays-Bas":"nl",
        "Pologne":"pl",
        "Portugal":"pt",
        "Qatar":"qa",
        "Tchéquie":"cz",
        "Roumanie":"ro",
        "Russie":"ru",
        "Sénégal":"sn",
        "Serbie":"rs",
        "Suède":"se",
        "Suisse":"ch",
        "Tunisie":"tn",
        "Turquie":"tr",
        "Ukraine":"ua",
        "Uruguay":"uy",
        "Pays de Galles":"gb-wls",
        "Paraguay":"para",

        };
        return (flags[country] || "xx") + ".png";
    }

    escape(value) {
        return (value || "").replace(/[&<>\"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[char]));
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new PronoApp().init();
});
