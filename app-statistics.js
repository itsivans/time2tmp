// ===== app-statistics.js (per-utente) =====
const firebaseConfig = {
  apiKey: "AIzaSyDEq8aUhdBPcjYM6H6909DldXAdjhRNWbI",
  authDomain: "time-ff7ed.firebaseapp.com",
  projectId: "time-ff7ed",
  storageBucket: "time-ff7ed.appspot.com",
  messagingSenderId: "842285944784",
  appId: "1:842285944784:web:de483548153abc956033d5",
  measurementId: "G-ZR0BNWGVXJ"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); // ← guardia
const auth = firebase.auth();
const db   = firebase.firestore();

const NON_LIBERI = ["Survive", "Sleep", "Work", "Slavery"];
let statsPieChart = null, weekPieChart = null;

// Helpers ISO "YYYY-MM-DDTHH:mm:ss"
const isoDayStart = d => `${d}T00:00:00`;
const isoDayEnd   = d => `${d}T23:59:59`;

function userActivities(uid){ return db.collection(`users/${uid}/activities`); }

// --- Tabella "Tutte le attività" (SOLO mie) ---
function loadActivitiesTable(uid) {
  userActivities(uid)
    .orderBy("timestamp", "desc")
    .get()
    .then(snapshot => {
      const activityList = document.getElementById('activityList');
      if (!activityList) return;
      activityList.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const dt = new Date(data.timestamp);
        const localDate = dt.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });
        const localTime = dt.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false });
        activityList.innerHTML += `
          <tr>
            <td>${localDate}</td>
            <td>${localTime}</td>
            <td><span class="tag">${data.tag || 'Nessun tag'}</span></td>
            <td>${data.activity || ''}</td>
          </tr>`;
      });
    })
    .catch(err => console.error('Errore tabella:', err));
}
window.loadActivitiesTable = loadActivitiesTable;

// --- Statistiche giornaliere (SOLO mie) ---
async function calcolaPercentualiPerData(filtro = "all") {
  const u = auth.currentUser;
  if (!u) { location.href = 'index.html'; return; }

  let dataYYYYMMDD = document.getElementById('statsDate')?.value;
  if (!dataYYYYMMDD) {
    dataYYYYMMDD = new Date().toISOString().slice(0,10);
    const inp = document.getElementById('statsDate');
    if (inp) inp.value = dataYYYYMMDD;
  }

  const snap = await userActivities(u.uid)
    .where("timestamp", ">=", isoDayStart(dataYYYYMMDD))
    .where("timestamp", "<=", isoDayEnd(dataYYYYMMDD))
    .orderBy("timestamp")
    .get();

  const items = [];
  snap.forEach(doc => items.push({ tag: doc.data().tag, timestamp: doc.data().timestamp }));

  // Prima attività del giorno successivo
  const d = new Date(dataYYYYMMDD); d.setDate(d.getDate() + 1);
  const nextDay = d.toISOString().slice(0,10);
  const nextSnap = await userActivities(u.uid)
    .where("timestamp", ">=", isoDayStart(nextDay))
    .orderBy("timestamp").limit(1).get();
  let nextDayActivity = null; nextSnap.forEach(doc => nextDayActivity = doc.data());

  let events = [];
  if (items.length > 0) {
    events.push({ tag: items[0].tag, timestamp: isoDayStart(dataYYYYMMDD) });
    events = events.concat(items);
  }
  if (items.length > 0) {
    const lastTime = items[items.length-1].timestamp;
    const end = isoDayEnd(dataYYYYMMDD);
    if (lastTime < end) events.push({ tag: nextDayActivity ? nextDayActivity.tag : "Sleep", timestamp: end });
    else events.push({ tag: items[items.length-1].tag, timestamp: end });
  }

  if (events.length < 2) {
    document.getElementById('statsResult').innerHTML =
      `<b>Statistiche del ${dataYYYYMMDD}</b><br>Nessuna attività trovata.`;
    if (statsPieChart) { statsPieChart.destroy(); statsPieChart = null; }
    return;
  }

  let tempoPerTag = {}, totMin = 0, minNonGestibili = 0, breakdown = {};
  for (let i = 1; i < events.length; i++) {
    const t1 = new Date(events[i-1].timestamp);
    const t2 = new Date(events[i].timestamp);
    const diff = Math.round((t2 - t1) / 60000);
    if (diff <= 0) continue;
    const tag = events[i].tag;

    if (NON_LIBERI.includes(tag)) {
      minNonGestibili += diff;
      breakdown[tag] = (breakdown[tag] || 0) + diff;
    }
    if (!(filtro === "free" && NON_LIBERI.includes(tag))) {
      tempoPerTag[tag] = (tempoPerTag[tag] || 0) + diff;
      totMin += diff;
    }
  }

  let html = `<b>Statistiche del ${dataYYYYMMDD} (${filtro === 'free' ? 'solo tempo gestibile' : 'tutte le attività'})</b><br>`;
  html += `(Totale: <b>${totMin} min</b> = ${(totMin/60).toFixed(1)}h)<br>`;

  if (filtro === "free") {
    const disponibili = 1440 - minNonGestibili;
    const perc = disponibili > 0 ? ((totMin / disponibili) * 100).toFixed(1) : '0.0';
    html += `<i>Usato: ${totMin} / ${disponibili} min → <b>${perc}%</b></i><br>`;
  }

  html += `<br><b>🕒 Breakdown 24h (non gestibile):</b><ul>`;
  let totaleNG = 0;
  for (const tag of NON_LIBERI) {
    if (breakdown[tag]) {
      totaleNG += breakdown[tag];
      html += `<li>${tag}: ${(breakdown[tag]/60).toFixed(1)}h</li>`;
    }
  }
  html += `<li><b>Totale non gestibile:</b> ${(totaleNG/60).toFixed(1)}h</li>`;
  html += `<li><b>Tempo teorico gestibile:</b> ${((1440 - totaleNG)/60).toFixed(1)}h</li>`;
  html += `</ul>`;

  html += `<table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
  for (const [tag, min] of Object.entries(tempoPerTag)) {
    const perc = totMin > 0 ? ((min / totMin) * 100).toFixed(1) : '0.0';
    html += `<tr><td>${tag}</td><td>${min}</td><td>${perc}%</td></tr>`;
  }
  html += `</table>`;

  document.getElementById('statsResult').innerHTML = html;

  const ctx = document.getElementById('statsPie').getContext('2d');
  if (statsPieChart) statsPieChart.destroy();
  statsPieChart = new Chart(ctx, {
    type: 'pie',
    data: { labels: Object.keys(tempoPerTag), datasets: [{ data: Object.values(tempoPerTag) }] },
    options: { plugins: { legend: { display: true, position: 'right' } } }
  });
}
window.calcolaPercentualiPerData = calcolaPercentualiPerData;

// Auto: quando la pagina è pronta e l'utente è loggato, popola tabella e precompila data
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(u => {
    if (!u) { location.href = 'index.html'; return; }
    loadActivitiesTable(u.uid);
    const statsDate = document.getElementById('statsDate');
    if (statsDate && !statsDate.value) statsDate.value = new Date().toISOString().slice(0,10);
  });
});
