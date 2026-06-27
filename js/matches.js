class KnockoutBracketManager {

    constructor() {
        this.container = document.getElementById("bracketContainer");
        this.matchIndex = 0;
    }

    async init() {
        if(!this.container) return;

        try {
            const response = await fetch("data/Matchs_16es_Coupe_du_Monde_2026.csv");

            if(!response.ok) {
                throw new Error("Impossible de charger le fichier des 16es.");
            }

            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder("utf-8");
            const csv = this.fixEncoding(decoder.decode(buffer));
            const matches = this.parseCSV(csv);

            this.display(matches);
            this.bindRoundNavigation();
            this.observeAnimations();
        } catch(error) {
            console.error(error);
            this.container.innerHTML = "<h2>Impossible de charger le tableau final.</h2>";
        }
    }

    fixEncoding(text) {
        return text
            .replace(/^\uFEFF/, "")
            .replace(/Ãƒâ€°|Ã‰/g, "É")
            .replace(/ÃƒÂ©|Ã©/g, "é")
            .replace(/ÃƒÂ¨|Ã¨/g, "è")
            .replace(/ÃƒÂª|Ãª/g, "ê")
            .replace(/ÃƒÂ«|Ã«/g, "ë")
            .replace(/Ãƒ |Ã /g, "à")
            .replace(/ÃƒÂ¢|Ã¢/g, "â")
            .replace(/ÃƒÂ®|Ã®/g, "î")
            .replace(/ÃƒÂ¯|Ã¯/g, "ï")
            .replace(/ÃƒÂ´|Ã´/g, "ô")
            .replace(/ÃƒÂ¶|Ã¶/g, "ö")
            .replace(/ÃƒÂ¹|Ã¹/g, "ù")
            .replace(/ÃƒÂ»|Ã»/g, "û")
            .replace(/ÃƒÂ¼|Ã¼/g, "ü")
            .replace(/ÃƒÂ§|Ã§/g, "ç");
    }

    parseCSV(csv) {
        const lines = csv.trim().split(/\r?\n/);
        const separator = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(separator).map(h => h.replace(/^\uFEFF/, "").trim());
        const data = [];

        lines.slice(1).forEach(line => {
            if(line.trim() === "") return;

            const values = line.split(separator);
            const obj = {};

            headers.forEach((header,index) => {
                obj[header] = values[index] ? values[index].trim() : "";
            });

            data.push(this.normalizeMatch(obj));
        });

        return data;
    }

    normalizeMatch(match) {
        const normalized = {
            numero: match["Numero"] || match["N°"] || match["Match"] || match["Numéro"] || "",
            date: match["Date"] || "",
            jour: match["Jour"] || "",
            heure: match["Heure"] || match["Horaire"] || "",
            equipe1: match["Equipe1"] || match["Équipe1"] || match["Domicile"] || match["Equipe 1"] || match["Équipe 1"] || "",
            equipe2: match["Equipe2"] || match["Équipe2"] || match["Exterieur"] || match["Extérieur"] || match["Equipe 2"] || match["Équipe 2"] || "",
            drapeau1: match["Drapeau1"] || match["Drapeau 1"] || "",
            drapeau2: match["Drapeau2"] || match["Drapeau 2"] || "",
            score1: match["Score1"] || match["Score Domicile"] || "",
            score2: match["Score2"] || match["Score Exterieur"] || match["Score Extérieur"] || ""
        };

        normalized.id = Number(normalized.numero) || 73 + this.matchIndex;
        this.matchIndex += 1;

        return normalized;
    }

    display(round32) {
        this.container.innerHTML = "";

        const matchesById = this.buildMatchMap(round32);
        const leftRound32 = round32.slice(0,8);
        const rightRound32 = round32.slice(8,16);

        const html = [
            '<div class="bracket-column round-32" data-round="round-32">',
            leftRound32.map((match,index) => this.matchBox(match, index)).join(""),
            '</div>',
            '<div class="bracket-column round-eight-finals" data-round="round-eight-finals">',
            this.projectedMatch("M89", ["M73", "M75"], matchesById, 8),
            this.projectedMatch("M90", ["M74", "M77"], matchesById, 9),
            this.projectedMatch("M93", ["M83", "M84"], matchesById, 10),
            this.projectedMatch("M94", ["M81", "M82"], matchesById, 11),
            '</div>',
            '<div class="bracket-column round-quarter-finals" data-round="round-quarter-finals">',
            this.projectedMatch("M97", ["M89", "M90"], matchesById, 12),
            this.projectedMatch("M98", ["M93", "M94"], matchesById, 13),
            '</div>',
            '<div class="bracket-column round-semi-finals" data-round="round-semi-finals">',
            this.projectedMatch("M101", ["M97", "M98"], matchesById, 14),
            '</div>',
            '<div class="bracket-column round-finals" data-round="round-finals">',
            this.finalMatch("Finale", ["M101", "M102"], matchesById, 15),
            this.finalMatch("3e place", ["M101", "M102"], matchesById, 16, true),
            '</div>',
            '<div class="bracket-column round-semi-finals" data-round="round-semi-finals">',
            this.projectedMatch("M102", ["M99", "M100"], matchesById, 17),
            '</div>',
            '<div class="bracket-column round-quarter-finals" data-round="round-quarter-finals">',
            this.projectedMatch("M99", ["M91", "M92"], matchesById, 18),
            this.projectedMatch("M100", ["M95", "M96"], matchesById, 19),
            '</div>',
            '<div class="bracket-column round-eight-finals" data-round="round-eight-finals">',
            this.projectedMatch("M91", ["M76", "M78"], matchesById, 20),
            this.projectedMatch("M92", ["M79", "M80"], matchesById, 21),
            this.projectedMatch("M95", ["M86", "M88"], matchesById, 22),
            this.projectedMatch("M96", ["M85", "M87"], matchesById, 23),
            '</div>',
            '<div class="bracket-column round-32" data-round="round-32">',
            rightRound32.map((match,index) => this.matchBox(match, index + 24)).join(""),
            '</div>'
        ].join("");

        this.container.insertAdjacentHTML("beforeend", html);
    }

    buildMatchMap(round32) {
        const map = {};

        round32.forEach(match => {
            const id = "M" + match.id;
            map[id] = {
                ...match,
                id,
                winner: this.getWinner(match),
                loser: this.getLoser(match)
            };
        });

        return map;
    }

    getWinner(match) {
        const score1 = Number(match.score1);
        const score2 = Number(match.score2);

        if(match.score1 === "" || match.score2 === "" || Number.isNaN(score1) || Number.isNaN(score2) || score1 === score2) {
            return null;
        }

        return score1 > score2
            ? { team: match.equipe1, flag: match.drapeau1 }
            : { team: match.equipe2, flag: match.drapeau2 };
    }

    getLoser(match) {
        const score1 = Number(match.score1);
        const score2 = Number(match.score2);

        if(match.score1 === "" || match.score2 === "" || Number.isNaN(score1) || Number.isNaN(score2) || score1 === score2) {
            return null;
        }

        return score1 < score2
            ? { team: match.equipe1, flag: match.drapeau1 }
            : { team: match.equipe2, flag: match.drapeau2 };
    }

    projectedMatch(id, sourceIds, matchesById, index) {
        const teams = sourceIds.map(sourceId => matchesById[sourceId]?.winner || null);

        matchesById[id] = {
            id,
            winner: null,
            loser: null
        };

        return this.emptyOrProjectedMatch(teams, index);
    }

    emptyOrProjectedMatch(teams, index) {
        const team1 = teams[0] || { team: "À déterminer", flag: "" };
        const team2 = teams[1] || { team: "À déterminer", flag: "" };

        return [
            '<div class="bracket-match reveal-bracket" style="animation-delay:' + (index * 0.05) + 's">',
            this.teamRow(team1.team, team1.flag, ""),
            this.teamRow(team2.team, team2.flag, ""),
            '</div>'
        ].join("");
    }

    matchBox(match, index) {
        const meta = [match.jour || match.date, match.heure].filter(Boolean).join(" • ");
        const time = meta ? '<div class="bracket-label">' + meta + '</div>' : "";

        return [
            '<div class="bracket-match reveal-bracket" style="animation-delay:' + (index * 0.05) + 's">',
            time,
            this.teamRow(match.equipe1, match.drapeau1, match.score1, this.getWinner(match)?.team === match.equipe1),
            this.teamRow(match.equipe2, match.drapeau2, match.score2, this.getWinner(match)?.team === match.equipe2),
            '</div>'
        ].join("");
    }

    finalMatch(title, sourceIds, matchesById, index, useLosers = false) {
        const teams = sourceIds.map(sourceId => {
            const match = matchesById[sourceId];
            return useLosers ? match?.loser : match?.winner;
        });

        const team1 = teams[0] || { team: "À déterminer", flag: "" };
        const team2 = teams[1] || { team: "À déterminer", flag: "" };

        return [
            '<div class="bracket-match bracket-final reveal-bracket" style="animation-delay:' + (index * 0.05) + 's">',
            '<div class="bracket-final-title">' + title + '</div>',
            this.teamRow(team1.team, team1.flag, ""),
            this.teamRow(team2.team, team2.flag, ""),
            '</div>'
        ].join("");
    }

    teamRow(team, flag, score, winner = false) {
        const hasFlag = flag && flag !== "xx.png";
        const image = hasFlag
            ? '<img src="assets/flags/' + flag + '" alt="' + team + '">'
            : '<div class="bracket-empty"></div>';

        return [
            '<div class="bracket-team ' + (winner ? 'winner' : '') + '">',
            image,
            '<span>' + team + '</span>',
            '<span class="bracket-score">' + (score || "") + '</span>',
            '</div>'
        ].join("");
    }

    bindRoundNavigation() {
        const nav = document.getElementById("bracketRoundNav");
        const wrapper = document.querySelector(".bracket-wrapper");

        if(!nav || !wrapper) return;

        nav.addEventListener("click", event => {
            const button = event.target.closest("button[data-round]");
            if(!button) return;

            const column = this.container.querySelector('[data-round="' + button.dataset.round + '"]');
            if(!column) return;

            nav.querySelectorAll("button").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            wrapper.scrollTo({
                left: Math.max(column.offsetLeft - 18, 0),
                behavior: "smooth"
            });
        });
    }

    observeAnimations() {
        const elements = document.querySelectorAll(".reveal-bracket");

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    entry.target.classList.add("show");
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold:.12
        });

        elements.forEach(el => observer.observe(el));
    }

}

document.addEventListener("DOMContentLoaded", () => {
    const bracket = new KnockoutBracketManager();
    bracket.init();
});
