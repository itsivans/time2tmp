const firebaseConfig = {
  apiKey: "AIzaSyDEq8aUhdBPcjYM6H6909DldXAdjhRNWbI",
  authDomain: "time-ff7ed.firebaseapp.com",
  projectId: "time-ff7ed",
  storageBucket: "time-ff7ed.appspot.com",
  messagingSenderId: "842285944784",
  appId: "1:842285944784:web:de483548153abc956033d5",
  measurementId: "G-ZR0BNWGVXJ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const NON_LIBERI = ["Survive", "Sleep", "Work", "Slavery"];
let statsPieChart = null, weekPieChart = null;

function calcolaPercentualiPerData(filtro = "all") {
  let dataYYYYMMDD = document.getElementById('statsDate').value;
  if (!dataYYYYMMDD) {
    let now = new Date();
    dataYYYYMMDD = now.toISOString().slice(0,10);
    document.getElementById('statsDate').value = dataYYYYMMDD;
  }

  db.collection("activities")
    .where("timestamp", ">=", dataYYYYMMDD + "T00:00")
    .where("timestamp", "<=", dataYYYYMMDD + "T23:59:59")
    .orderBy("timestamp")
    .get().then(snapshot => {
      let items = [];
      snapshot.forEach(doc => items.push({ tag: doc.data().tag, timestamp: doc.data().timestamp }));

      function getFirstNextDay(callback) {
        let day = new Date(dataYYYYMMDD);
        day.setDate(day.getDate() + 1);
        let nextDay = day.toISOString().slice(0,10);
        db.collection("activities")
          .where("timestamp", ">=", nextDay + "T00:00")
          .orderBy("timestamp")
          .limit(1)
          .get().then(nextSnap => {
            let next = null;
            nextSnap.forEach(doc => next = doc.data());
            callback(next);
          });
      }

      getFirstNextDay(function(nextDayActivity) {
        let events = [];
        if (items.length > 0) {
          events.push({ tag: items[0].tag, timestamp: dataYYYYMMDD + "T00:00" });
          events = events.concat(items);
        }
        if (items.length > 0) {
          let lastTime = items[items.length-1].timestamp;
          let end = dataYYYYMMDD + "T23:59:59";
          if (lastTime < end) {
            events.push({ tag: nextDayActivity ? nextDayActivity.tag : "Sleep", timestamp: end });
          } else {
            events.push({ tag: items[items.length-1].tag, timestamp: end });
          }
        }

        let tempoPerTag = {}, totMin = 0, minNonGestibili = 0;
        let breakdown = {}; // per ogni tag NON gestibile

        for (let i = 1; i < events.length; i++) {
          let t1 = new Date(events[i-1].timestamp);
          let t2 = new Date(events[i].timestamp);
          let diff = Math.round((t2 - t1) / 60000);
          if (diff < 0) continue;

          let tag = events[i].tag;
          if (filtro === "free" && NON_LIBERI.includes(tag)) {
            minNonGestibili += diff;
            breakdown[tag] = (breakdown[tag] || 0) + diff;
            continue;
          }
          if (NON_LIBERI.includes(tag)) {
            minNonGestibili += diff;
            breakdown[tag] = (breakdown[tag] || 0) + diff;
          }

          if (filtro !== "free" || !NON_LIBERI.includes(tag)) {
            tempoPerTag[tag] = (tempoPerTag[tag] || 0) + diff;
            totMin += diff;
          }
        }

        let html = `<b>Statistiche del ${dataYYYYMMDD} (${filtro === 'free' ? 'solo tempo gestibile' : 'tutte le attività'})</b><br>`;
        html += `(Totale: <b>${totMin} min</b> = ${(totMin/60).toFixed(1)}h)<br>`;

        if (filtro === "free") {
          const disponibili = 1440 - minNonGestibili;
          const perc = ((totMin / disponibili) * 100).toFixed(1);
          html += `<i>Usato: ${totMin} / ${disponibili} min → <b>${perc}%</b></i><br>`;
        }

        // Breakdown 24h
        html += `<br><b>🕒 Breakdown 24h:</b><ul>`;
        let totale = 0;
        for (let tag of NON_LIBERI) {
          if (breakdown[tag]) {
            totale += breakdown[tag];
            html += `<li>${tag}: ${(breakdown[tag]/60).toFixed(1)}h</li>`;
          }
        }
        html += `<li><b>Totale non gestibile:</b> ${(totale/60).toFixed(1)}h</li>`;
        html += `<li><b>Tempo teorico gestibile:</b> ${((1440 - totale)/60).toFixed(1)}h</li>`;
        html += `</ul>`;

        html += `<table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
        Object.entries(tempoPerTag).forEach(([tag, min]) => {
          let perc = ((min / totMin) * 100).toFixed(1);
          html += `<tr><td>${tag}</td><td>${min}</td><td>${perc}%</td></tr>`;
        });
        html += "</table>";
        document.getElementById('statsResult').innerHTML = html;

        let ctx = document.getElementById('statsPie').getContext('2d');
        if (statsPieChart) statsPieChart.destroy();
        statsPieChart = new Chart(ctx, {
          type: 'pie',
          data: { labels: Object.keys(tempoPerTag), datasets: [{ data: Object.values(tempoPerTag) }] },
          options: { plugins: { legend: { display: true, position: 'right' } } }
        });
      });
    });
}

window.calcolaPercentualiPerData = calcolaPercentualiPerData;
window.calcolaPercentualiSettimana = () => alert("🛠️ In arrivo: versione settimanale con breakdown 24h.");
