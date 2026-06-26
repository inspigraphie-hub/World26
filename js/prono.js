class PronoApp {
    constructor() {
        this.profileListKey = "worldcupPronoProfiles";
        this.activeProfileKey = "worldcupPronoActiveProfile";
        this.defaultProfile = "Invite";
        this.balanceKey = "tokens";
        this.betsKey = "bets";
        this.favoriteKey = "favoriteTeam";
        this.bonusKey = "dailyBonus";
        this.matches = [];
        this.activeFilter = "all";
        this.pollMs = 30000;
    }

    async init() {
        try {
            this.ensureProfiles();
            this.ensureWallet();
            this.matches = await this.loadMatches();
            this.settleBets();
            this.bindControls();
            this.render();
            this.startLiveRefresh();
        } catch(error) {
            console.error(error);
            document.getElementById("pronoMatches").innerHTML = '<div class="empty-state">Impossible de charger les pronos.</div>';
        }
    }

    ensureProfiles() {
        const profiles = this.profiles();
        if(profiles.length === 0) {
            localStorage.setItem(this.profileListKey, JSON.stringify([this.defaultProfile]));
        }
        if(!localStorage.getItem(this.activeProfileKey)) {
            localStorage.setItem(this.activeProfileKey, this.profiles()[0] || this.defaultProfile);
        }
    }

    profiles() {
        try {
            const profiles = JSON.parse(localStorage.getItem(this.profileListKey) || "[]");
            return Array.isArray(profiles) ? profiles : [];
        } catch(error) {
            return [];
        }
    }

    activeProfile() {
        return localStorage.getItem(this.activeProfileKey) || this.defaultProfile;
    }

    profileKey(key) {
        return `worldcupProno:${this.normalize(this.activeProfile())}:${key}`;
    }

    setActiveProfile(name) {
        const clean = this.cleanProfileName(name);
        if(!clean) return;

        const profiles = this.profiles();
        if(!profiles.includes(clean)) {
            profiles.push(clean);
            profiles.sort((a, b) => a.localeCompare(b, "fr"));
            localStorage.setItem(this.profileListKey, JSON.stringify(profiles));
        }

        localStorage.setItem(this.activeProfileKey, clean);
        this.ensureWallet();
        this.settleBets();
        this.render();
    }

    cleanProfileName(name) {
        return (name || "").trim().replace(/\s+/g, " ").slice(0, 18);
    }

    async loadMatches() {
        const matches = await this.loadCSV(`data/Resultats_Coupe_du_Monde.csv?t=${Date.now()}`);
        const live = await this.loadLiveScores();
        return this.mergeLiveScores(matches, live.matches || []);
    }

    async loadCSV(path) {
        const response = await fetch(path, { cache: "no-store" });
        if(!response.ok) throw new Error(`Impossible de charger ${path}`);
        return this.parseCSV(this.fixEncoding(await response.text()));
    }

    async loadLiveScores() {
        try {
            const response = await fetch(`data/live_scores.json?t=${Date.now()}`, { cache: "no-store" });
            if(!response.ok) return { matches: [] };
            return await response.json();
        } catch(error) {
            return { matches: [] };
        }
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/).filter(Boolean);
        const separator = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(separator).map(header => header.replace(/^\uFEFF/, "").trim());
        return lines.slice(1).map(line => {
            const values = line.split(separator);
            const item = {};
            headers.forEach((header, index) => item[header] = values[index] ? values[index].trim() : "");
            return item;
        });
    }

    fixEncoding(text) {
        return text
            .replace(/Ã©/g, "e").replace(/Ã¨/g, "e").replace(/Ãª/g, "e").replace(/Ã«/g, "e")
            .replace(/Ã /g, "a").replace(/Ã¢/g, "a").replace(/Ã®/g, "i").replace(/Ã¯/g, "i")
            .replace(/Ã´/g, "o").replace(/Ã»/g, "u").replace(/Ã¹/g, "u").replace(/Ã§/g, "c")
            .replace(/Ã‰/g, "E").replace(/Ã/g, "E").replace(/Ã/g, "E").replace(/Ã/g, "C")
            .replace(/ï»¿/g, "");
    }

    mergeLiveScores(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => liveMap.set(this.matchKeyFromParts(match.Date, match.Domicile, match.Exterieur), match));

        return matches.map(match => {
            const live = liveMap.get(this.matchKey(match));
            return live ? { ...match, ...live } : match;
        });
    }

    bindControls() {
        document.getElementById("switchPronoProfile")?.addEventListener("click", () => {
            this.setActiveProfile(document.getElementById("pronoProfileSelect").value);
        });

        document.getElementById("createPronoProfile")?.addEventListener("click", () => {
            const input = document.getElementById("pronoProfileName");
            this.setActiveProfile(input.value);
            input.value = "";
        });

        document.getElementById("pronoProfileName")?.addEventListener("keydown", event => {
            if(event.key === "Enter") document.getElementById("createPronoProfile").click();
        });

        document.getElementById("savePronoFavorite")?.addEventListener("click", () => {
            const select = document.getElementById("pronoFavoriteTeam");
            localStorage.setItem(this.profileKey(this.favoriteKey), select.value);
            this.render();
            this.flash("favoriteSignal", `${select.value} est ton equipe favorite.`);
        });

        document.getElementById("resetBets")?.addEventListener("click", () => {
            localStorage.removeItem(this.profileKey(this.betsKey));
            localStorage.setItem(this.profileKey(this.balanceKey), "1000");
            this.render();
        });

        document.getElementById("dailyBonus")?.addEventListener("click", () => this.claimBonus());

        document.querySelectorAll("[data-prono-filter]").forEach(button => {
            button.addEventListener("click", () => {
                this.activeFilter = button.dataset.pronoFilter;
                document.querySelectorAll("[data-prono-filter]").forEach(tab => tab.classList.toggle("active", tab === button));
                this.renderMatches();
            });
        });

        document.getElementById("pronoMatches")?.addEventListener("click", event => {
            const odd = event.target.closest(".odd-button");
            if(odd && !odd.disabled) {
                const card = odd.closest(".prono-card");
                card.querySelectorAll(".odd-button").forEach(button => button.classList.remove("active"));
                odd.classList.add("active");
                return;
            }

            const submit = event.target.closest(".bet-submit");
            if(submit && !submit.disabled) this.placeBet(submit.closest(".prono-card"));
        });
    }

    startLiveRefresh() {
        window.setInterval(async () => {
            const live = await this.loadLiveScores();
            this.matches = this.mergeLiveScores(this.matches, live.matches || []);
            this.settleBets();
            this.render();
        }, this.pollMs);
    }

    render() {
        this.renderProfileSwitcher();
        this.renderBalance();
        this.renderFavoritePicker();
        this.renderStats();
        this.renderMatches();
        this.renderHistory();
    }

    renderProfileSwitcher() {
        const select = document.getElementById("pronoProfileSelect");
        const signal = document.getElementById("profileSignal");
        if(!select) return;

        const active = this.activeProfile();
        select.innerHTML = this.profiles().map(name => {
            const selected = name === active ? " selected" : "";
            return `<option value="${this.escape(name)}"${selected}>${this.escape(name)}</option>`;
        }).join("");

        if(signal) signal.textContent = `Memoire active : ${active}`;
    }

    ensureWallet() {
        if(localStorage.getItem(this.profileKey(this.balanceKey)) === null) {
            localStorage.setItem(this.profileKey(this.balanceKey), "1000");
        }
    }

    renderBalance() {
        document.getElementById("tokenBalance").textContent = this.balance().toLocaleString("fr-FR");
    }

    renderFavoritePicker() {
        const select = document.getElementById("pronoFavoriteTeam");
        if(!select) return;

        const favorite = this.favoriteTeam();
        select.innerHTML = this.uniqueTeams().map(team => {
            const selected = team === favorite ? " selected" : "";
            return `<option value="${this.escape(team)}"${selected}>${this.escape(team)}</option>`;
        }).join("");

        const next = this.nextMatchForTeam(favorite);
        document.getElementById("favoriteSignal").textContent = next
            ? `Prochain match : ${favorite} vs ${this.opponentFor(next, favorite)}`
            : "Choisis une equipe a suivre.";
    }

    renderStats() {
        const bets = this.bets();
        const open = bets.filter(bet => bet.status === "open");
        const spent = open.reduce((sum, bet) => sum + Number(bet.stake), 0);
        const gain = open.reduce((sum, bet) => sum + Number(bet.stake) * Number(bet.odd), 0);
        document.getElementById("openBetsCount").textContent = open.length;
        document.getElementById("spentTokens").textContent = Math.round(spent).toLocaleString("fr-FR");
        document.getElementById("potentialGain").textContent = Math.round(gain).toLocaleString("fr-FR");
    }

    renderMatches() {
        const box = document.getElementById("pronoMatches");
        if(!box) return;

        const favorite = this.favoriteTeam();
        const lockedKeys = new Set(this.bets().map(bet => bet.matchKey));
        const matches = this.matches
            .filter(match => this.statusKey(match) !== "done")
            .filter(match => this.activeFilter !== "favorite" || [match.Domicile, match.Exterieur].includes(favorite))
            .filter(match => this.activeFilter !== "open" || !lockedKeys.has(this.matchKey(match)))
            .slice(0, 12);

        box.innerHTML = matches.length
            ? matches.map(match => this.matchCard(match, favorite, lockedKeys.has(this.matchKey(match)))).join("")
            : '<div class="empty-state">Aucun match a miser dans ce filtre.</div>';
    }

    matchCard(match, favorite, locked) {
        const odds = this.oddsFor(match);
        const isFavorite = [match.Domicile, match.Exterieur].includes(favorite);
        const status = this.statusKey(match);

        return `
            <article class="prono-card ${isFavorite ? "favorite" : ""} ${status === "live" ? "live" : ""}" data-locked="${locked ? "1" : "0"}" data-key="${this.escape(this.matchKey(match))}" data-home="${this.escape(match.Domicile)}" data-away="${this.escape(match.Exterieur)}" data-date="${this.escape(match.Date)}">
                <div class="prono-card-meta">
                    <span>${this.escape(match.Date)} - ${this.escape(match.Groupe || "Match")}</span>
                    <span>${this.statusText(match, locked)}</span>
                </div>
                <div class="prono-teams">
                    ${this.teamBlock(match.Domicile)}
                    <span class="versus-pill">${this.scoreText(match)}</span>
                    ${this.teamBlock(match.Exterieur)}
                </div>
                <div class="odds-grid">
                    ${this.oddButton("home", match.Domicile, odds.home, locked)}
                    ${this.oddButton("draw", "Nul", odds.draw, locked)}
                    ${this.oddButton("away", match.Exterieur, odds.away, locked)}
                </div>
                <div class="bet-row"><span>Mise</span><input class="stake-input" type="number" min="10" step="10" value="50" ${locked ? "disabled" : ""}></div>
                <button class="bet-submit" type="button" ${locked ? "disabled" : ""}>${locked ? "Prono verrouille" : "Miser mes jetons"}</button>
            </article>
        `;
    }

    teamBlock(team) {
        return `<div class="prono-team"><img src="assets/flags/${this.flag(team)}" alt="${this.escape(team)}" onerror="this.style.display='none'"><span>${this.escape(team)}</span></div>`;
    }

    oddButton(choice, label, odd, disabled) {
        return `<button type="button" class="odd-button" data-choice="${choice}" data-odd="${odd}" ${disabled ? "disabled" : ""}><span>${this.escape(label)}</span><b>${odd.toFixed(2)}</b></button>`;
    }

    placeBet(card) {
        const selected = card.querySelector(".odd-button.active");
        if(!selected) return;

        const stake = this.clamp(Number(card.querySelector(".stake-input").value || 0), 10, this.balance());
        if(stake <= 0) return;

        const key = card.dataset.key;
        if(this.bets().some(bet => bet.matchKey === key)) return;

        const label = selected.querySelector("span").textContent;
        const odd = Number(selected.dataset.odd);
        const bet = {
            id: `${key}:${Date.now()}`,
            profile: this.activeProfile(),
            matchKey: key,
            home: card.dataset.home,
            away: card.dataset.away,
            date: card.dataset.date,
            choice: selected.dataset.choice,
            label,
            odd,
            stake,
            status: "open",
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(this.profileKey(this.balanceKey), String(this.balance() - stake));
        localStorage.setItem(this.profileKey(this.betsKey), JSON.stringify([bet, ...this.bets()]));
        this.settleBets();
        this.render();
    }

    settleBets() {
        const bets = this.bets();
        let changed = false;
        let balance = this.balance();

        const nextBets = bets.map(bet => {
            if(bet.status !== "open") return bet;

            const match = this.matches.find(item => this.matchKey(item) === bet.matchKey);
            if(!match || this.statusKey(match) !== "done") return bet;

            const won = this.resultChoice(match) === bet.choice;
            changed = true;
            if(won) balance += Math.round(Number(bet.stake) * Number(bet.odd));
            return { ...bet, status: won ? "won" : "lost", settledAt: new Date().toISOString() };
        });

        if(changed) {
            localStorage.setItem(this.profileKey(this.balanceKey), String(balance));
            localStorage.setItem(this.profileKey(this.betsKey), JSON.stringify(nextBets));
        }
    }

    renderHistory() {
        const box = document.getElementById("betsHistory");
        if(!box) return;

        const bets = this.bets();
        box.innerHTML = bets.length
            ? bets.map(bet => this.historyRow(bet)).join("")
            : '<div class="empty-state">Aucun prono pour ce profil.</div>';
    }

    historyRow(bet) {
        const state = bet.status === "won" ? "gagne" : bet.status === "lost" ? "perdu" : "en attente";
        const value = bet.status === "won"
            ? `+${Math.round(bet.stake * bet.odd)}`
            : bet.status === "lost" ? `-${bet.stake}` : `${bet.stake} joues`;

        return `
            <div class="history-row ${bet.status || "open"}">
                <div><b>${this.escape(bet.home)} - ${this.escape(bet.away)}</b><br><span>${this.escape(bet.date)} - ${this.escape(bet.label)} - cote ${Number(bet.odd).toFixed(2)} - ${state}</span></div>
                <strong>${value}</strong>
            </div>
        `;
    }

    flash(id, text) {
        const element = document.getElementById(id);
        if(element) element.textContent = text;
    }

    claimBonus() {
        const today = new Date().toISOString().slice(0, 10);
        if(localStorage.getItem(this.profileKey(this.bonusKey)) === today) {
            this.flash("profileSignal", "Bonus deja recupere aujourd'hui pour ce profil.");
            return;
        }

        localStorage.setItem(this.profileKey(this.bonusKey), today);
        localStorage.setItem(this.profileKey(this.balanceKey), String(this.balance() + 100));
        this.render();
    }

    oddsFor(match) {
        const home = this.teamPower(match.Domicile);
        const away = this.teamPower(match.Exterieur);
        const diff = home - away;
        return {
            home: this.clamp(2.1 - diff * 0.08, 1.35, 4.8),
            draw: this.clamp(3.15 + Math.abs(diff) * 0.04, 2.55, 4.6),
            away: this.clamp(2.1 + diff * 0.08, 1.35, 4.8)
        };
    }

    teamPower(team) {
        const strong = ["France", "Bresil", "Argentine", "Espagne", "Allemagne", "Angleterre", "Portugal", "Pays-Bas"];
        const normalTeam = this.normalize(team);
        const index = strong.findIndex(name => this.normalize(name) === normalTeam);
        return index === -1 ? 8 : 18 - index;
    }

    favoriteTeam() {
        return localStorage.getItem(this.profileKey(this.favoriteKey)) || "France";
    }

    statusText(match, locked) {
        if(locked) return "Verrouille";
        if(this.statusKey(match) === "live") return `EN DIRECT${match.Minute ? ` ${match.Minute}'` : ""}`;
        if(this.statusKey(match) === "done") return "Termine";
        return "A venir";
    }

    scoreText(match) {
        const home = match["Score Domicile"];
        const away = match["Score Exterieur"];
        return home !== "" && away !== "" ? `${home}-${away}` : "VS";
    }

    resultChoice(match) {
        const home = Number(match["Score Domicile"]);
        const away = Number(match["Score Exterieur"]);
        if(home > away) return "home";
        if(away > home) return "away";
        return "draw";
    }

    statusKey(match) {
        const status = this.normalize(match.Statut || "");
        if(status.includes("termine")) return "done";
        if(status.includes("cours") || status.includes("live")) return "live";
        return "upcoming";
    }

    matchKey(match) {
        return this.matchKeyFromParts(match.Date, match.Domicile, match.Exterieur);
    }

    matchKeyFromParts(date, home, away) {
        return [date, home, away].map(value => this.normalize(value)).join("|");
    }

    normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    balance() {
        return Number(localStorage.getItem(this.profileKey(this.balanceKey)) || 0);
    }

    bets() {
        try {
            const bets = JSON.parse(localStorage.getItem(this.profileKey(this.betsKey)) || "[]");
            return Array.isArray(bets) ? bets : [];
        } catch(error) {
            return [];
        }
    }

    uniqueTeams() {
        return [...new Set(this.matches.flatMap(match => [match.Domicile, match.Exterieur]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    }

    nextMatchForTeam(team) {
        return this.matches.find(match => this.statusKey(match) !== "done" && [match.Domicile, match.Exterieur].includes(team));
    }

    opponentFor(match, team) {
        return match.Domicile === team ? match.Exterieur : match.Domicile;
    }

    flag(team) {
        const flags = {
            "Afghanistan": "af", "Afrique du Sud": "za", "Albanie": "al", "Algerie": "dz",
            "Allemagne": "de", "Angleterre": "gb-eng", "Arabie Saoudite": "sa", "Argentine": "ar",
            "Australie": "au", "Autriche": "at", "Belgique": "be", "Bolivie": "bo",
            "Bosnie-Herzegovine": "ba", "Bosnie et Herzegovine": "ba", "Bresil": "br", "Bulgarie": "bg",
            "Cap-Vert": "cv", "Cameroun": "cm", "Canada": "ca", "Chili": "cl", "Chine": "cn",
            "Colombie": "co", "RD Congo": "cd", "Panama": "pa", "Ouzbekistan": "uz",
            "Coree du Nord": "kp", "Coree du Sud": "kr", "Republique de Coree": "kr", "Costa Rica": "cr",
            "Cote d'Ivoire": "ci", "Croatie": "hr", "Curacao": "cw", "Danemark": "dk",
            "Egypte": "eg", "Ecosse": "gb-sct", "Equateur": "ec", "Espagne": "es",
            "Etats-Unis": "us", "Finlande": "fi", "France": "fr", "Ghana": "gh", "Grece": "gr",
            "Hongrie": "hu", "Haiti": "ht", "Irlande": "ie", "Iran": "ir", "RI Iran": "ir",
            "Irak": "iq", "Italie": "it", "Japon": "jp", "Jordanie": "jo", "Maroc": "ma",
            "Mexique": "mx", "Nigeria": "ng", "Norvege": "no", "Nouvelle-Zelande": "nz",
            "Pays-Bas": "nl", "Pologne": "pl", "Portugal": "pt", "Qatar": "qa", "Tchequie": "cz",
            "Roumanie": "ro", "Russie": "ru", "Senegal": "sn", "Serbie": "rs", "Suede": "se",
            "Suisse": "ch", "Tunisie": "tn", "Turquie": "tr", "Ukraine": "ua", "Uruguay": "uy",
            "Pays de Galles": "gb-wls", "Paraguay": "py"
        };
        const key = Object.keys(flags).find(name => this.normalize(name) === this.normalize(team));
        return key ? flags[key] + ".png" : "";
    }

    escape(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

document.addEventListener("DOMContentLoaded", () => new PronoApp().init());
