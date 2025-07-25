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

let editId = null, statsPieChart = null, weekPieChart = null;

// ------ ORARIO AUTOMATICO SU AGGIUNTA ATTIVITÀ ------
document.getElementById('activity').addEventListener('keydown', function(e) {
  if(e.key === "Enter") addActivity();
});
document.getElementById('activity').addEventListener('focus', function() {
  if (!document.getElementById('dateTime').value) {
    document.getElementById('dateTime').value = getLocalISODateTimeNow();
  }
});
document.getElementById('dateTime').addEventListener('focus', function() {
  if (!this.value) this.value = getLocalISODateTimeNow();
});

function getLocalISODateTimeNow() {
  const now = new Date();
  now.setSeconds(0,0);
  const tzOffset = -now.getTimezoneOffset();
  const localISO = new Date(now.getTime() + tzOffset * 60000)
    .toISOString().slice(0,16);
  return localISO;
}

function addActivity() {
  const activity = document.getElementById('activity').value.trim();
  let dateTime = document.getElementById('dateTime').value;
  const tag = document.getElementById('tag').value;
  if (!activity || !tag) return alert("Inserisci attività e tag!");
  if (!dateTime) dateTime = getLocalISODateTimeNow();
  db.collection("activities").add({
    activity, tag,
    timestamp: dateTime
  }).then(() => {
    loadActivities();
    document.getElementById('activity').value = "";
    document.getElementById('dateTime').value = "";
    document.getElementById('tag').value = "";
  });
}

function loadActivities() {
  db.collection("activities").orderBy("timestamp").get().then(snapshot => {
    const list = document.getElementById('activityList');
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      const dt = new Date(data.timestamp);
      const localDate = dt.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
      const localTime = dt.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false });
      list.innerHTML += `<tr>
        <td>${localDate}</td>
        <td>${localTime}</td>
        <td><span class="tag">${data.tag || 'Nessun tag'}</span></td>
        <td>${data.activity || ''}</td>
        <td class="actions">
          <button onclick="editActivity('${doc.id}')">✏️</button>
          <button onclick="deleteActivity('${doc.id}')">❌</button>
        </td>
      </tr>`;
    });
  });
}
window.onload = loadActivities;

function deleteActivity(id) {
  db.collection("activities").doc(id).delete().then(loadActivities);
}

function editActivity(id) {
  db.collection("activities").doc(id).get().then(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    editId = id;
    document.getElementById('editActivity').value = d.activity || "";
    document.getElementById('editDateTime').value = d.timestamp;
    document.getElementById('editTag').value = d.tag || "";
    document.getElementById('editForm').style.display = "block";
  });
}

function saveEdit() {
  const newActivity = document.getElementById('editActivity').value.trim();
  const newDateTime = document.getElementById('editDateTime').value;
  const newTag = document.getElementById('editTag').value;
  if (!editId || !newActivity || !newDateTime || !newTag) return;
  db.collection("activities").doc(editId).update({
    activity: newActivity,
    timestamp: newDateTime,
    tag: newTag
  }).then(() => {
    cancelEdit();
    loadActivities();
  });
}

function cancelEdit() {
  editId = null;
  document.getElementById('editForm').style.display = "none";
}

// ------ TAG NON gestibili (NON_LIBERI) ------
const NON_LIBERI = [
  "Survive", "Sleep", "Work", "Slavery"
];

// --------- STATISTICHE GIORNALIERE ---------
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
      snapshot.forEach(doc => {
        let d = doc.data();
        items.push({ tag: d.tag, timestamp: d.timestamp });
      });

      // Cerca la prima attività del giorno dopo per "riempire" buchi serali
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
        // Dalla mezzanotte: TAG della prima attività del giorno
        if (items.length > 0) {
          events.push({
            tag: items[0].tag,
            timestamp: dataYYYYMMDD + "T00:00"
          });
          events = events.concat(items);
        }

        // Riempie il buco serale con TAG della prima attività del giorno dopo, se serve
        let lastTime = items.length ? items[items.length-1].timestamp : null;
        if (lastTime && lastTime < dataYYYYMMDD + "T23:59:59") {
          let fillTag = nextDayActivity ? nextDayActivity.tag : "Sleep";
          events.push({
            tag: fillTag,
            timestamp: dataYYYYMMDD + "T23:59:59"
          });
        } else if (items.length > 0) {
          events.push({
            tag: items[items.length-1].tag,
            timestamp: dataYYYYMMDD + "T23:59:59"
          });
        }

        // Calcola intervalli
        let tempoPerTag = {}, totaliMinuti = 0;
        for (let i = 1; i < events.length; i++) {
          let t1 = new Date(events[i-1].timestamp);
          let t2 = new Date(events[i].timestamp);
          let diffMin = Math.round((t2-t1)/60000);
          if (diffMin < 0) continue;
          let tag = events[i].tag;
          if (filtro === "free" && NON_LIBERI.includes(tag)) continue;
          tempoPerTag[tag] = (tempoPerTag[tag]||0) + diffMin;
          totaliMinuti += diffMin;
        }
        let risultato = `<b>Statistiche del ${dataYYYYMMDD} (${filtro==='free'?'solo tempo gestibile':'tutte le attività'})</b>
        <br>(Totale minuti tracciati: <b>${totaliMinuti}</b>)<br><table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
        Object.entries(tempoPerTag).forEach(([tag, minuti]) => {
          let perc = ((minuti / totaliMinuti) * 100).toFixed(1);
          risultato += `<tr><td>${tag}</td><td>${minuti}</td><td>${perc}%</td></tr>`;
        });
        risultato += "</table>";
        document.getElementById('statsResult').innerHTML = risultato;

        let ctx = document.getElementById('statsPie').getContext('2d');
        if (statsPieChart) statsPieChart.destroy();
        statsPieChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: Object.keys(tempoPerTag),
            datasets: [{ data: Object.values(tempoPerTag) }]
          },
          options: { plugins: { legend: { display: true, position: 'right' } } }
        });
      });
    });
}
window.calcolaPercentualiPerData = calcolaPercentualiPerData;
