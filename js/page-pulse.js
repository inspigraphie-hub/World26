class PagePulse {
    async init() {
        const container = document.getElementById("sitePulse");
        if(!container) return;

        try {
            const [matches, standings] = await Promise.all([
                this.loadCSV("data/Resultats_Coupe_du_Monde.csv"),
                this.loadCSV("data/Classement.csv")
            ]);
            const today = matches.filter(match => match.Date === this.todayKey());
            const next = matches.find(match => this.statusKey(match) !== "done");
            const france = standings.find(team => team["Équipe"] === "France");
            const qualified = france && Number(france.Pts || 0) >= 6;

            container.innerHTML = [
                "<span><i class=\"fa-solid fa-calendar-day\"></i>" + today.length + " match" + (today.length > 1 ? "s" : "") + " aujourd'hui</span>",
                "<span><i class=\"fa-solid fa-flag\"></i>France " + (qualified ? "qualifi&eacute;e" : "&agrave; suivre") + "</span>",
                "<span><i class=\"fa-solid fa-futbol\"></i>" + (next ? "Prochain : " + next.Domicile + " - " + next.Exterieur : "Calendrier termin&eacute;") + "</span>"
            ].join("");
        } catch(error) {
            console.error(error);
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

    statusKey(match) {
        const status = (match.Statut || "").toLowerCase();
        if(status.includes("direct") || status.includes("cours")) return "live";
        if(status.includes("termin")) return "done";
        return "upcoming";
    }

    todayKey() {
        const date = new Date();
        const months = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];
        const csvMonths = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
        return date.getDate() + "-" + csvMonths[date.getMonth()];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new PagePulse().init();
});
