// Firebase config
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

let statsPieChart = null, weekPieChart = null;

const NON_LIBERI = ["Survive", "Sleep", "Work", "Slavery"];

// ----------- GIORNALIERE -----------
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
        for (let i = 1; i < events.length; i++) {
          let t1 = new Date(events[i-1].timestamp);
          let t2 = new Date(events[i].timestamp);
          let diff = Math.round((t2 - t1) / 60000);
          if (diff < 0) continue;
          let tag = events[i].tag;
          if (filtro === "free" && NON_LIBERI.includes(tag)) {
            minNonGestibili += diff;
            continue;
          }
          tempoPerTag[tag] = (tempoPerTag[tag] || 0) + diff;
          totMin += diff;
        }

        let html = `<b>Statistiche del ${dataYYYYMMDD} (${filtro === 'free' ? 'solo tempo gestibile' : 'tutte le attività'})</b><br>`;
        html += `(Totale: <b>${totMin} min</b> = ${(totMin/60).toFixed(1)}h)<br>`;
        if (filtro === "free") {
          let disponibili = 1440 - minNonGestibili;
          let perc = ((totMin / disponibili) * 100).toFixed(1);
          html += `<i>Usato: ${totMin} / ${disponibili} min → <b>${perc}%</b></i><br>`;
        }
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

// ----------- SETTIMANALI -----------
function calcolaPercentualiSettimana(filtro = "all") {
  let start = document.getElementById('weekStart').value;
  let end = document.getElementById('weekEnd').value;
  if (!start || !end) return alert("Scegli le date!");

  db.collection("activities")
    .where("timestamp", ">=", start + "T00:00")
    .where("timestamp", "<=", end + "T23:59:59")
    .orderBy("timestamp")
    .get().then(snapshot => {
      let items = [];
      snapshot.forEach(doc => items.push({ tag: doc.data().tag, timestamp: doc.data().timestamp }));

      let nextDay = new Date(end);
      nextDay.setDate(nextDay.getDate() + 1);
      let weekEnd = nextDay.toISOString().slice(0,10) + "T00:00";

      db.collection("activities")
        .where("timestamp", ">=", weekEnd)
        .orderBy("timestamp")
        .limit(1)
        .get().then(nextSnap => {
          let next = null;
          nextSnap.forEach(doc => next = doc.data());
          if (items.length && items[items.length - 1].timestamp < weekEnd) {
            items.push({ tag: next ? next.tag : "Sleep", timestamp: weekEnd });
          }

          let tempoPerTag = {}, totMin = 0, minNonGestibili = 0;
          for (let i = 1; i < items.length; i++) {
            let t1 = new Date(items[i - 1].timestamp);
            let t2 = new Date(items[i].timestamp);
            let diff = Math.round((t2 - t1) / 60000);
            if (diff < 0) continue;
            let tag = items[i].tag;
            if (filtro === "free" && NON_LIBERI.includes(tag)) {
              minNonGestibili += diff;
              continue;
            }
            tempoPerTag[tag] = (tempoPerTag[tag] || 0) + diff;
            totMin += diff;
          }

          let html = `<b>Statistiche dal ${start} al ${end} (${filtro === 'free' ? 'solo tempo gestibile' : 'tutte'})</b><br>`;
          html += `(Totale: <b>${totMin} min</b> = ${(totMin/60).toFixed(1)}h)<br>`;
          if (filtro === "free") {
            let giorni = (new Date(end) - new Date(start)) / 86400000 + 1;
            let disponibili = giorni * 1440 - minNonGestibili;
            let perc = ((totMin / disponibili) * 100).toFixed(1);
            html += `<i>Usato: ${totMin} / ${disponibili} min → <b>${perc}%</b></i><br>`;
          }
          html += `<table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
          Object.entries(tempoPerTag).forEach(([tag, min]) => {
            let perc = ((min / totMin) * 100).toFixed(1);
            html += `<tr><td>${tag}</td><td>${min}</td><td>${perc}%</td></tr>`;
          });
          html += "</table>";
          document.getElementById('weekStatsResult').innerHTML = html;

          let ctx = document.getElementById('weekStatsPie').getContext('2d');
          if (weekPieChart) weekPieChart.destroy();
          weekPieChart = new Chart(ctx, {
            type: 'pie',
            data: { labels: Object.keys(tempoPerTag), datasets: [{ data: Object.values(tempoPerTag) }] },
            options: { plugins: { legend: { display: true, position: 'right' } } }
          });
        });
    });
}

window.calcolaPercentualiPerData = calcolaPercentualiPerData;
window.calcolaPercentualiSettimana = calcolaPercentualiSettimana;
