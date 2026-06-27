class MatchManager {

    constructor() {
        this.container = document.getElementById("matchesContainer");
        this.todayContainer = document.getElementById("todayMatches");
        this.todayTitle = document.getElementById("todayTitle");
        this.todayCount = document.getElementById("todayCount");
        this.filters = document.getElementById("matchFilters");
        this.searchInput = document.getElementById("teamSearch");
        this.matches = [];
        this.activeFilter = "all";
        this.searchTerm = "";
    }

    async init() {

        try {

            const response = await fetch("data/Resultats_Coupe_du_Monde.csv");

            if (!response.ok) {
                throw new Error("Impossible de charger le fichier CSV.");
            }

            const buffer = await response.arrayBuffer();

            const decoder = new TextDecoder("utf-8");

            let csv = decoder.decode(buffer);

            csv = this.fixEncoding(csv);

            this.matches = this.parseCSV(csv);

            this.renderToday();
            this.display(this.matches);
            this.bindFilters();
            this.bindSearch();

        } catch (e) {

            console.error(e);

            this.container.innerHTML = `
                <h2>Erreur lors du chargement du calendrier.</h2>
                <p>${e.message}</p>
            `;

        }

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
            .map(h => h.replace(/^\uFEFF/, "").trim());

        const data = [];

        for (let i = 1; i < lines.length; i++) {

            if (lines[i].trim() === "") continue;

            const values = lines[i].split(separator);

            const match = {};

            headers.forEach((header, index) => {

                match[header] = values[index] ? values[index].trim() : "";

            });

            data.push(match);

        }

        return data;

    }

    display(matches) {

        this.container.innerHTML = "";

        if(matches.length === 0) {
            this.container.innerHTML = `<div class="empty-state">Aucun match ne correspond à ce filtre.</div>`;
            return;
        }

        matches.forEach((match, index) => {

            this.container.insertAdjacentHTML(
                "beforeend",
                this.createCard(match, index)
            );

        });

        document.dispatchEvent(new Event("matches:updated"));

    }

    createCard(match, index) {

        const status = this.statusKey(match);

        return `

<div class="match-card reveal ${status}" style="animation-delay:${(index % 12) * 0.06}s">

    <div class="match-date">

        <span>${match["Date"]}</span>

        <span>${match["Groupe"]}</span>

        <span class="status-pill ${status}">${this.statusLabel(match)}</span>

    </div>

    <div class="teams">

        <div class="team ${this.isWinner(match, "home") ? "winner" : ""}">

            <img src="assets/flags/${this.flag(match["Domicile"])}" alt="${match["Domicile"]}">

            <h3>${this.shortName(match["Domicile"])}</h3>

        </div>

        <div class="score">

            <div class="score-number">

                ${this.scoreText(match)}

            </div>


        </div>

        <div class="team ${this.isWinner(match, "away") ? "winner" : ""}">

            <img src="assets/flags/${this.flag(match["Exterieur"])}" alt="${match["Exterieur"]}">

            <h3>${this.shortName(match["Exterieur"])}</h3>

        </div>

    </div>

</div>

`;

    }

    bindFilters() {
        if(!this.filters) return;

        this.filters.addEventListener("click", event => {
            const button = event.target.closest(".filter-btn");
            if(!button) return;

            this.activeFilter = button.dataset.filter;
            this.searchTerm = "";

            if(this.searchInput) {
                this.searchInput.value = "";
            }

            this.filters.querySelectorAll(".filter-btn").forEach(filter => {
                filter.classList.toggle("active", filter === button);
            });

            this.display(this.getFilteredMatches());
        });
    }

    bindSearch() {
        if(!this.searchInput) return;

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

            if(!matchesSearch) return false;
            if(this.activeFilter === "today") return match["Date"] === today;
            if(this.activeFilter === "france") return [match["Domicile"], match["Exterieur"]].includes("France");
            if(this.activeFilter === "upcoming") return status === "upcoming" || status === "live";
            if(this.activeFilter === "done") return status === "done";

            return true;
        });
    }

    renderToday() {
        if(!this.todayContainer) return;

        const today = this.todayKey();
        let matches = this.matches.filter(match => match["Date"] === today);
        let title = "Matchs du jour";

        if(matches.length === 0) {
            matches = this.matches.filter(match => this.statusKey(match) === "upcoming").slice(0, 3);
            title = "Prochains matchs";
        }

        this.todayTitle.textContent = title;
        this.todayCount.textContent = `${matches.length} ${matches.length > 1 ? "matchs" : "match"}`;
        this.todayContainer.innerHTML = matches.length
            ? matches.map((match, index) => this.createTodayCard(match, index)).join("")
            : `<div class="empty-state">Aucun match à afficher pour le moment.</div>`;
    }

    createTodayCard(match, index) {
        const status = this.statusKey(match);

        return `

<article class="today-card ${status}" style="animation-delay:${index * 0.08}s">
    <div class="today-meta">
        <span>${match["Date"]}</span>
        <span>${match["Groupe"]}</span>
        <span class="status-pill ${status}">${this.statusLabel(match)}</span>
    </div>

    <div class="today-teams">
        ${this.compactTeam(match["Domicile"], match["Score Domicile"], this.isWinner(match, "home"))}
        <span class="today-separator">-</span>
        ${this.compactTeam(match["Exterieur"], match["Score Exterieur"], this.isWinner(match, "away"))}
    </div>
</article>

`;
    }

    compactTeam(country, score, winner) {
        return `
<div class="today-team ${winner ? "winner" : ""}">
    <img src="assets/flags/${this.flag(country)}" alt="${country}">
    <strong>${this.shortName(country)}</strong>
    <span>${score || ""}</span>
</div>
`;
    }

    scoreText(match) {
        const home = match["Score Domicile"];
        const away = match["Score Exterieur"];

        if(home === "" && away === "") return "vs";

        return `${home || "-"} - ${away || "-"}`;
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
        if(status === "live") return "En direct";
        if(status === "done") return "Terminé";
        return "À venir";
    }

    statusKey(match) {
        const status = (match["Statut"] || "").toLowerCase();

        if(status.includes("direct") || status.includes("cours")) return "live";
        if(status.includes("termin")) return "done";

        return "upcoming";
    }

    isWinner(match, side) {
        if(this.statusKey(match) !== "done") return false;

        const home = Number(match["Score Domicile"]);
        const away = Number(match["Score Exterieur"]);

        if(Number.isNaN(home) || Number.isNaN(away) || home === away) return false;

        return side === "home" ? home > away : away > home;
    }

    todayKey() {
        const date = new Date();
        const months = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return `${date.getDate()}-${months[date.getMonth()]}`;
    }
    shortName(country) {

        const names = {
            "Ouzbékistan":"Ouzbék.",
            "Bosnie-Herzégovine":"Bosnie",
            "Nouvelle-Zélande":"N.-Zélande",
            "Afrique du Sud":"A. du Sud",
            "Arabie saoudite":"Arabie",
            "Corée du Sud":"Corée S."
        };

        return names[country] || country;

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
            "Bosnie-et-Herzégovine":"ba",
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
            "République de Corée":"kr",
            "Costa Rica":"cr",
            "Côte d'Ivoire":"ci",
            "Croatie":"hr",
            "Curaçao":"cw",
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
            "Haïti":"ht",
            "Irlande":"ie",
            "Iran":"ir",
            "RI Iran":"ir",
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
            "Paraguay":"py"

        };

        return (flags[country] || "xx") + ".png";

    }

}

document.addEventListener("DOMContentLoaded", () => {

    const manager = new MatchManager();

    manager.init();

});
