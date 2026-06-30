class GroupsManager {

    constructor() {

        this.container = document.getElementById("groupsContainer");

    }

    async init() {

        try {

            const response = await fetch("data/Resultats_Coupe_du_Monde.csv");

            const buffer = await response.arrayBuffer();

            const decoder = new TextDecoder("windows-1252");

            let csv = decoder.decode(buffer);

csv = csv
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

            const matches = this.parseCSV(csv);

            const groups = this.getGroups(matches);

            this.display(groups);

        }

        catch(error){

            console.error(error);

            this.container.innerHTML = "<h2>Impossible de charger les groupes.</h2>";

        }

    }

    parseCSV(csv){

        const lines = csv.trim().split(/\r?\n/);

        const separator = lines[0].includes(";") ? ";" : ",";

        const headers = lines[0].split(separator).map(h => h.trim());

        let data = [];

        lines.slice(1).forEach(line=>{

            if(line.trim()==="") return;

            const values = line.split(separator);

            let obj = {};

            headers.forEach((header,index)=>{

                obj[header] = values[index] ? values[index].trim() : "";

            });

            data.push(obj);

        });

        return data;

    }

    getGroups(matches){

        let groups = {};

        matches.forEach(match=>{

            const group = match["Groupe"];

            if(!groups[group]){

                groups[group] = [];

            }

            if(!groups[group].includes(match["Domicile"])){

                groups[group].push(match["Domicile"]);

            }

            if(!groups[group].includes(match["Exterieur"])){

                groups[group].push(match["Exterieur"]);

            }

        });

        return groups;

    }

    display(groups){

        this.container.innerHTML = "";

        Object.keys(groups).sort().forEach(group=>{

            let html = `

<div class="group-card">

    <div class="group-title">

        ${group}

    </div>

`;

            groups[group].forEach(team=>{

                html += `

<div class="group-team">

    <img src="assets/flags/${this.flag(team)}" alt="${team}">

    <span>${team}</span>

</div>

`;

            });

            html += `</div>`;

            this.container.insertAdjacentHTML("beforeend", html);

        });

    }

    flag(country){

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

}

document.addEventListener("DOMContentLoaded", ()=>{

    const manager = new GroupsManager();

    manager.init();

});