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
            const live = await this.loadKnockoutLive();

            this.display(this.mergeKnockoutLive(matches, live.matches || []));
            this.bindRoundNavigation();
            this.observeAnimations();
            this.startLiveRefresh();
        } catch(error) {
            console.error(error);
            this.container.innerHTML = "<h2>Impossible de charger le tableau final.</h2>";
        }
    }

    async loadKnockoutLive() {
        try {
            return await this.fetchJSONWithFallback("/api/knockout-live", "data/knockout_live.json");
        } catch(error) {
            return { matches: [] };
        }
    }

    async fetchJSONWithFallback(apiPath, fallbackPath) {
        const paths = [apiPath, fallbackPath];

        for (const path of paths) {
            try {
                const url = path + (path.includes("?") ? "&" : "?") + "t=" + Date.now();
                const response = await fetch(url, { cache: "no-store" });
                if(response.ok) return await response.json();
            } catch(error) {
                // Try the next source.
            }
        }

        return { matches: [] };
    }

    mergeKnockoutLive(matches, liveMatches) {
        const liveMap = new Map();
        liveMatches.forEach(match => {
            if(match.id) liveMap.set(String(match.id), match);
            if(match.date && match.equipe1 && match.equipe2) {
                liveMap.set(this.matchKey(match.date, match.equipe1, match.equipe2), match);
            }
        });

        return matches.map(match => {
            const id = "M" + match.id;
            const live = liveMap.get(id) || liveMap.get(this.matchKey(match.date, match.equipe1, match.equipe2));
            if(!live) return match;

            return {
                ...match,
                date: live.date || match.date,
                jour: live.jour || match.jour,
                heure: live.heure || match.heure,
                equipe1: live.equipe1 || match.equipe1,
                equipe2: live.equipe2 || match.equipe2,
                drapeau1: live.drapeau1 || match.drapeau1,
                drapeau2: live.drapeau2 || match.drapeau2,
                score1: live.score1 ?? match.score1,
                score2: live.score2 ?? match.score2,
                statut: live.statut || match.statut || "",
                winnerName: live.winner || match.winnerName || "",
                minute: live.minute || ""
            };
        });
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
            score2: match["Score2"] || match["Score Exterieur"] || match["Score Extérieur"] || "",
            statut: match["Statut"] || "",
            winnerName: match["Vainqueur"] || match["Winner"] || ""
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
        const leftRoundEight = [
            this.projectedMatch("M89", ["M73", "M74"], matchesById, 8),
            this.projectedMatch("M90", ["M75", "M76"], matchesById, 9),
            this.projectedMatch("M91", ["M77", "M78"], matchesById, 10),
            this.projectedMatch("M92", ["M79", "M80"], matchesById, 11)
        ].join("");
        const leftQuarters = [
            this.projectedMatch("M97", ["M89", "M90"], matchesById, 12),
            this.projectedMatch("M98", ["M91", "M92"], matchesById, 13)
        ].join("");
        const leftSemi = this.projectedMatch("M101", ["M97", "M98"], matchesById, 14);
        const rightRoundEight = [
            this.projectedMatch("M93", ["M81", "M82"], matchesById, 20),
            this.projectedMatch("M94", ["M83", "M84"], matchesById, 21),
            this.projectedMatch("M95", ["M85", "M86"], matchesById, 22),
            this.projectedMatch("M96", ["M87", "M88"], matchesById, 23)
        ].join("");
        const rightQuarters = [
            this.projectedMatch("M99", ["M93", "M94"], matchesById, 18),
            this.projectedMatch("M100", ["M95", "M96"], matchesById, 19)
        ].join("");
        const rightSemi = this.projectedMatch("M102", ["M99", "M100"], matchesById, 17);
        const finals = [
            this.finalMatch("Finale", ["M101", "M102"], matchesById, 15),
            this.finalMatch("3e place", ["M101", "M102"], matchesById, 16, true)
        ].join("");

        const html = [
            '<div class="bracket-column round-32" data-round="round-32">',
            leftRound32.map((match,index) => this.matchBox(match, index)).join(""),
            '</div>',
            '<div class="bracket-column round-eight-finals" data-round="round-eight-finals">',
            leftRoundEight,
            '</div>',
            '<div class="bracket-column round-quarter-finals" data-round="round-quarter-finals">',
            leftQuarters,
            '</div>',
            '<div class="bracket-column round-semi-finals" data-round="round-semi-finals">',
            leftSemi,
            '</div>',
            '<div class="bracket-column round-finals" data-round="round-finals">',
            finals,
            '</div>',
            '<div class="bracket-column round-semi-finals" data-round="round-semi-finals">',
            rightSemi,
            '</div>',
            '<div class="bracket-column round-quarter-finals" data-round="round-quarter-finals">',
            rightQuarters,
            '</div>',
            '<div class="bracket-column round-eight-finals" data-round="round-eight-finals">',
            rightRoundEight,
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
        if(match.winnerName) {
            if(this.sameTeam(match.winnerName, match.equipe1)) return { team: match.equipe1, flag: match.drapeau1 };
            if(this.sameTeam(match.winnerName, match.equipe2)) return { team: match.equipe2, flag: match.drapeau2 };
        }

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
        if(match.winnerName) {
            if(this.sameTeam(match.winnerName, match.equipe1)) return { team: match.equipe2, flag: match.drapeau2 };
            if(this.sameTeam(match.winnerName, match.equipe2)) return { team: match.equipe1, flag: match.drapeau1 };
        }

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
        const result = this.roundResultFor(id);
        const team1 = teams[0] || { team: "À déterminer", flag: "" };
        const team2 = teams[1] || { team: "À déterminer", flag: "" };
        const winner = result ? this.winnerFromProjectedResult(team1, team2, result) : null;
        const loser = result ? this.loserFromProjectedResult(team1, team2, result) : null;

        matchesById[id] = {
            id,
            winner,
            loser
        };

        return this.emptyOrProjectedMatch(id, [team1, team2], index, result, winner);
    }

    matchScheduleFor(id) {
        const schedules = {
            M89: { label: "Sam. 04/07", hour: "23:00", status: "Terminé" },
            M90: { label: "Sam. 04/07", hour: "19:00", status: "Terminé" },
            M91: { label: "Dim. 05/07", hour: "22:00", status: "Terminé" },
            M92: { label: "Lun. 06/07", hour: "02:00", status: "Terminé" },
            M93: { label: "Lun. 06/07", hour: "21:00", status: "Terminé" },
            M94: { label: "Mar. 07/07", hour: "02:00", status: "Terminé" },
            M95: { label: "Mar. 07/07", hour: "18:00", status: "Terminé" },
            M96: { label: "Mar. 07/07", hour: "22:00", status: "Term. (TB)" },
            M97: { label: "Jeu. 09/07", hour: "21:00", status: "Terminé" },
            M98: { label: "Ven. 10/07", hour: "21:00", status: "Terminé" },
            M99: { label: "Sam. 11/07", hour: "23:00", status: "À venir" },
            M100: { label: "Dim. 12/07", hour: "03:00", status: "À venir" },
            M101: { label: "Mar. 14/07", hour: "21:00", status: "À venir" },
            M102: { label: "Mer. 15/07", hour: "21:00", status: "À venir" },
            final: { label: "Dim. 19/07", hour: "21:00", status: "À venir" },
            third: { label: "Sam. 18/07", hour: "23:00", status: "À venir" }
        };
        return schedules[id] || null;
    }

    scheduleLabel(id) {
        const schedule = this.matchScheduleFor(id);
        if(!schedule) return "";
        const meta = [schedule.label, schedule.hour].filter(Boolean).join(" • ");
        const status = schedule.status ? ' <span class="bracket-status">' + schedule.status + '</span>' : "";
        return '<div class="bracket-label">' + meta + status + '</div>';
    }

    roundResultFor(id) {
        const results = {
            M89: { score1: "0", score2: "1" },
            M90: { score1: "0", score2: "3" },
            M91: { score1: "1", score2: "2" },
            M92: { score1: "2", score2: "3" },
            M93: { score1: "0", score2: "1" },
            M94: { score1: "1", score2: "4" },
            M95: { score1: "3", score2: "2" },
            M96: { score1: "0 (4)", score2: "0 (3)" },
            M97: { score1: "2", score2: "0" },
            M98: { score1: "2", score2: "1" }
        };
        return results[id] || null;
    }

    winnerFromProjectedResult(team1, team2, result) {
        if(result.status && !this.normalize(result.status).includes("termine")) return null;
        const scores = this.projectedScoreParts(result);
        if(scores.score1 !== scores.score2) return scores.score1 > scores.score2 ? team1 : team2;
        if(scores.penalty1 !== null && scores.penalty2 !== null && scores.penalty1 !== scores.penalty2) {
            return scores.penalty1 > scores.penalty2 ? team1 : team2;
        }
        return null;
    }

    loserFromProjectedResult(team1, team2, result) {
        if(result.status && !this.normalize(result.status).includes("termine")) return null;
        const scores = this.projectedScoreParts(result);
        if(scores.score1 !== scores.score2) return scores.score1 < scores.score2 ? team1 : team2;
        if(scores.penalty1 !== null && scores.penalty2 !== null && scores.penalty1 !== scores.penalty2) {
            return scores.penalty1 < scores.penalty2 ? team1 : team2;
        }
        return null;
    }

    projectedScoreParts(result) {
        const left = this.splitScoreWithPenalty(result.score1);
        const right = this.splitScoreWithPenalty(result.score2);
        return {
            score1: left.score,
            score2: right.score,
            penalty1: left.penalty,
            penalty2: right.penalty
        };
    }

    splitScoreWithPenalty(value) {
        const match = String(value || "").match(/^(\d+)(?:\s*\((\d+)\))?$/);
        if(!match) return { score: NaN, penalty: null };
        return {
            score: Number(match[1]),
            penalty: match[2] === undefined ? null : Number(match[2])
        };
    }

    emptyOrProjectedMatch(id, teams, index, result = null, winner = null) {
        const team1 = teams[0] || { team: "À déterminer", flag: "" };
        const team2 = teams[1] || { team: "À déterminer", flag: "" };

        return [
            '<div class="bracket-match reveal-bracket" style="animation-delay:' + (index * 0.05) + 's">',
            this.scheduleLabel(id),
            this.teamRow(team1.team, team1.flag, result?.score1 || "", winner?.team === team1.team),
            this.teamRow(team2.team, team2.flag, result?.score2 || "", winner?.team === team2.team),
            '</div>'
        ].join("");
    }

    matchBox(match, index) {
        const meta = [match.jour || match.date, match.heure].filter(Boolean).join(" • ");
        const status = match.statut ? ' <span class="bracket-status">' + match.statut + (match.minute ? " " + match.minute + "'" : "") + '</span>' : "";
        const time = meta || status ? '<div class="bracket-label">' + meta + status + '</div>' : "";

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
            this.scheduleLabel(useLosers ? "third" : "final"),
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

    startLiveRefresh() {
        setInterval(async () => {
            try {
                const response = await fetch("data/Matchs_16es_Coupe_du_Monde_2026.csv?t=" + Date.now(), { cache: "no-store" });
                if(!response.ok) return;
                const csv = this.fixEncoding(await response.text());
                this.matchIndex = 0;
                const matches = this.parseCSV(csv);
                const live = await this.loadKnockoutLive();
                this.display(this.mergeKnockoutLive(matches, live.matches || []));
                this.observeAnimations();
            } catch(error) {
                console.warn("Tableau live en attente", error);
            }
        }, 15 * 60 * 1000);
    }

    matchKey(date, home, away) {
        return [date, home, away].map(value => this.normalize(value)).join("|");
    }

    sameTeam(left, right) {
        return this.normalize(left) === this.normalize(right);
    }

    normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    bindRoundNavigation() {
        const nav = document.getElementById("bracketRoundNav");
        const wrapper = document.querySelector(".bracket-wrapper");

        if(!nav || !wrapper) return;

        const firstButton = nav.querySelector("button[data-round]");
        if(firstButton && !nav.querySelector("button.active")) {
            firstButton.classList.add("active");
            this.container.dataset.activeRound = firstButton.dataset.round;
        }

        nav.addEventListener("click", event => {
            const button = event.target.closest("button[data-round]");
            if(!button) return;

            const column = this.container.querySelector('[data-round="' + button.dataset.round + '"]');
            if(!column) return;

            nav.querySelectorAll("button").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            this.container.dataset.activeRound = button.dataset.round;

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
