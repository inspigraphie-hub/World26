class StandingsManager {

    constructor() {
        this.container = document.getElementById("standingsContainer");
        this.thirdsContainer = document.getElementById("thirdsContainer");
    }

    async init() {

        try {

            const response = await fetch("data/Classement.csv");

            const buffer = await response.arrayBuffer();

            const decoder = new TextDecoder("utf-8");

            let csv = decoder.decode(buffer);

            csv = this.fixEncoding(csv);

            const data = this.parseCSV(csv);

            const groups = this.getGroups(data);

            const qualifiedThirds = this.getQualifiedThirds(groups);

            this.displayGroups(groups, qualifiedThirds);

            this.displayThirds(groups);

        } catch(error) {

            console.error(error);

            this.container.innerHTML = "<h2>Impossible de charger le classement.</h2>";

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

    getGroups(data) {

        let groups = {};

        data.forEach(team => {

            const group = team["Groupe"];

            if(!group) return;

            if(!groups[group]) {
                groups[group] = [];
            }

            groups[group].push(team);

        });

        Object.keys(groups).forEach(group => {

            groups[group].sort((a, b) => this.sortTeams(a, b));

        });

        return groups;

    }

    sortTeams(a, b) {

        return Number(b["Pts"]) - Number(a["Pts"])
            || Number(b["Dif."]) - Number(a["Dif."])
            || Number(b["Bp"]) - Number(a["Bp"])
            || Number(a["PFP"]) - Number(b["PFP"]);

    }

    getQualifiedThirds(groups) {

        let thirds = [];

        Object.keys(groups).forEach(group => {

            if(groups[group].length >= 3) {

                thirds.push(groups[group][2]);

            }

        });

        thirds.sort((a, b) => this.sortTeams(a, b));

        return thirds
            .slice(0, 8)
            .map(team => team["Équipe"]);

    }

    displayGroups(groups, qualifiedThirds) {

        this.container.innerHTML = "";

        Object.keys(groups).sort().forEach(group => {

            let html = `

<div class="standing-card">

    <div class="standing-title">${group}</div>

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

        <tbody>

`;

            groups[group].forEach((team, index) => {

                const position = index + 1;
                const teamName = team["Équipe"];
                const diff = Number(team["Dif."]);

                let diffClass = "diff-neutral";

                if(diff > 0) diffClass = "diff-positive";
                if(diff < 0) diffClass = "diff-negative";

                let rowClass = "";

                if(position <= 2) {
                    rowClass = "qualified";
                } 
                else if(position === 3 && qualifiedThirds.includes(teamName)) {
                    rowClass = "best-third";
                } 
                else if(position === 4) {
                    rowClass = "eliminated";
                }

                html += `

            <tr class="${rowClass}">

                <td class="rank">${position}</td>

                <td>
                    <div class="team-cell">
                        <img src="assets/flags/${this.flag(teamName)}" alt="${teamName}">
                        <span>${teamName}</span>
                    </div>
                </td>

                <td>${team["J"]}</td>
                <td>${team["G"]}</td>
                <td>${team["N"]}</td>
                <td>${team["P"]}</td>
                <td>${team["Bp"]}</td>
                <td>${team["Bc"]}</td>
                <td class="${diffClass}">${team["Dif."]}</td>
                <td class="points">${team["Pts"]}</td>

            </tr>

`;

            });

            html += `

        </tbody>

    </table>

</div>

`;

            this.container.insertAdjacentHTML("beforeend", html);

        });

    }

    displayThirds(groups) {

        let thirds = [];

        Object.keys(groups).forEach(group => {

            if(groups[group].length >= 3) {

                const thirdTeam = groups[group][2];

                thirds.push(thirdTeam);

            }

        });

        thirds.sort((a, b) => this.sortTeams(a, b));

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

        <tbody>

`;

        thirds.forEach((team, index) => {

            const teamName = team["Équipe"];
            const diff = Number(team["Dif."]);

            let diffClass = "diff-neutral";

            if(diff > 0) diffClass = "diff-positive";
            if(diff < 0) diffClass = "diff-negative";

            const rowClass = index < 8 ? "thirds-qualified" : "eliminated";

            html += `

            <tr class="${rowClass}">

                <td class="rank">${index + 1}</td>

                <td>
                    <div class="team-cell">
                        <img src="assets/flags/${this.flag(teamName)}" alt="${teamName}">
                        <span>${teamName}</span>
                    </div>
                </td>

                <td>${team["Groupe"]}</td>
                <td>${team["J"]}</td>
                <td>${team["G"]}</td>
                <td>${team["N"]}</td>
                <td>${team["P"]}</td>
                <td>${team["Bp"]}</td>
                <td>${team["Bc"]}</td>
                <td class="${diffClass}">${team["Dif."]}</td>
                <td class="points">${team["Pts"]}</td>

            </tr>

`;

        });

        html += `

        </tbody>

    </table>

</div>

`;

        this.thirdsContainer.innerHTML = html;

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

    const manager = new StandingsManager();

    manager.init();

});