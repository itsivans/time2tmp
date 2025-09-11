<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>Statistiche Attività</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="icon-192.png">
  <meta name="theme-color" content="#2196f3">

  <!-- Firebase (compat) -->
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    body { font-family: Arial, system-ui, sans-serif; padding: 12px; }
    input, button { margin: 4px; padding: 6px; font-size: 16px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #aaa; padding: 5px 8px; }
    th { background: #eee; }
    canvas { max-width: 100%; height: auto; }
    .tag { background: #eee; border-radius: 5px; padding: 2px 7px; margin-right: 5px; }
    .link-btn {
      display: block;
      margin-top: 20px;
      padding: 12px;
      background: #2196f3;
      color: white;
      text-align: center;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h2>📊 Statistiche Giornaliere</h2>
  <button onclick="calcolaPercentualiPerData()">Mostra Statistiche Oggi</button>
  Cambia data: <input type="date" id="statsDate">
  <div>
    <button onclick="calcolaPercentualiPerData('all')">TUTTE</button>
    <button onclick="calcolaPercentualiPerData('free')">Solo tempo gestibile</button>
  </div>
  <div id="statsResult"></div>
  <canvas id="statsPie" width="280" height="160"></canvas>

  <hr>
  <h2>🗕️ Statistiche Settimanali</h2>
  Dal: <input type="date" id="weekStart">
  Al: <input type="date" id="weekEnd">
  <div>
    <button onclick="calcolaPercentualiSettimana('all')">TUTTE</button>
    <button onclick="calcolaPercentualiSettimana('free')">Solo tempo gestibile</button>
  </div>
  <div id="weekStatsResult"></div>
  <canvas id="weekStatsPie" width="280" height="160"></canvas>

  <hr>
  <h2>📋 Tutte le attività</h2>
  <table id="activityTable">
    <thead>
      <tr>
        <th>Data</th><th>Ora</th><th>Tag</th><th>Attività</th>
      </tr>
    </thead>
    <tbody id="activityList"></tbody>
  </table>

  <a href="index.html" class="link-btn">📥 Torna all’inserimento</a>

  <!-- Inizializzazione Firebase + logica completa -->
  <script>
    // === Firebase init (stessa config dell'index) ===
    const firebaseConfig = {
      apiKey: "AIzaSyDEq8aUhdBPcjYM6H6909DldXAdjhRNWbI",
      authDomain: "time-ff7ed.firebaseapp.com",
      projectId: "time-ff7ed",
      storageBucket: "time-ff7ed.appspot.com",
      messagingSenderId: "842285944784",
      appId: "1:842285944784:web:de483548153abc956033d5",
      measurementId: "G-ZR0BNWGVXJ"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    const auth = firebase.auth();
    const db   = firebase.firestore();

    // === Costanti / stato ===
    const NON_LIBERI = ["Survive", "Sleep", "Work", "Slavery"];
    let statsPieChart = null, weekPieChart = null;

    // Helpers ISO "YYYY-MM-DDTHH:mm:ss"
    const isoDayStart = d => `${d}T00:00:00`;
    const isoDayEnd   = d => `${d}T23:59:59`;

    function userActivities(uid){ return db.collection(`users/${uid}/activities`); }

    // === Auth guard + bootstrap pagina ===
    document.addEventListener('DOMContentLoaded', () => {
      auth.onAuthStateChanged(u => {
        if (!u) { location.href = 'index.html'; return; }

        // Precompila date input (oggi e settimana corrente)
        const today = new Date().toISOString().slice(0,10);
        if (!document.getElementById('statsDate').value) document.getElementById('statsDate').value = today;

        const now = new Date();
        const day = now.getDay(); // 0 dom .. 6 sab
        const diffToMon = (day + 6) % 7;
        const monday = new Date(now); monday.setDate(now.getDate() - diffToMon);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const wStart = monday.toISOString().slice(0,10);
        const wEnd   = sunday.toISOString().slice(0,10);
        if (!document.getElementById('weekStart').value) document.getElementById('weekStart').value = wStart;
        if (!document.getElementById('weekEnd').value)   document.getElementById('weekEnd').value   = wEnd;

        // Popola tabella
        renderActivitiesTable(u.uid);
      });
    });

    // === Tabella "Tutte le attività" (SOLO mie) ===
    function renderActivitiesTable(uid) {
      userActivities(uid)
        .orderBy("timestamp", "desc")
        .get()
        .then(snapshot => {
          const activityList = document.getElementById('activityList');
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

    // === Statistiche giornaliere (SOLO mie) ===
    async function calcolaPercentualiPerData(filtro = "all") {
      const u = auth.currentUser;
      if (!u) { location.href = 'index.html'; return; }

      let dataYYYYMMDD = document.getElementById('statsDate').value;
      if (!dataYYYYMMDD) {
        dataYYYYMMDD = new Date().toISOString().slice(0,10);
        document.getElementById('statsDate').value = dataYYYYMMDD;
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

    // === Statistiche settimanali (SOLO mie) ===
    async function calcolaPercentualiSettimana(filtro = "all") {
      const u = auth.currentUser;
      if (!u) { location.href = 'index.html'; return; }

      let start = document.getElementById('weekStart').value;
      let end   = document.getElementById('weekEnd').value;

      // fallback: settimana corrente
      if (!start || !end) {
        const now = new Date();
        const day = now.getDay();
        const diffToMon = (day + 6) % 7;
        const monday = new Date(now); monday.setDate(now.getDate() - diffToMon);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        start = monday.toISOString().slice(0,10);
        end   = sunday.toISOString().slice(0,10);
        if (!document.getElementById('weekStart').value) document.getElementById('weekStart').value = start;
        if (!document.getElementById('weekEnd').value)   document.getElementById('weekEnd').value   = end;
      }

      // Helper: calcolo di un singolo giorno (riusa la logica giornaliera)
      async function computeDay(yyyyMmDd) {
        const snap = await userActivities(u.uid)
          .where("timestamp", ">=", isoDayStart(yyyyMmDd))
          .where("timestamp", "<=", isoDayEnd(yyyyMmDd))
          .orderBy("timestamp")
          .get();

        const items = [];
        snap.forEach(doc => items.push({ tag: doc.data().tag, timestamp: doc.data().timestamp }));
        if (items.length === 0) return { tempoPerTag: {}, totMin: 0, breakdown: {}, minNonGestibili: 0 };

        const d = new Date(yyyyMmDd); d.setDate(d.getDate() + 1);
        const nextDay = d.toISOString().slice(0,10);
        const nextSnap = await userActivities(u.uid)
          .where("timestamp", ">=", isoDayStart(nextDay))
          .orderBy("timestamp").limit(1).get();
        let nextDayActivity = null; nextSnap.forEach(doc => nextDayActivity = doc.data());

        let events = [{ tag: items[0].tag, timestamp: isoDayStart(yyyyMmDd) }, ...items];
        const endStr = isoDayEnd(yyyyMmDd);
        const lastTime = items[items.length - 1].timestamp;
        if (lastTime < endStr) events.push({ tag: nextDayActivity ? nextDayActivity.tag : "Sleep", timestamp: endStr });
        else events.push({ tag: items[items.length - 1].tag, timestamp: endStr });

        let tempoPerTag = {}, totMin = 0, minNonGestibili = 0, breakdown = {};
        for (let i=1; i<events.length; i++) {
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
        return { tempoPerTag, totMin, breakdown, minNonGestibili };
      }

      // Itera i giorni tra start e end (inclusi)
      const dayList = [];
      { const s = new Date(start), e = new Date(end);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
          dayList.push(d.toISOString().slice(0,10));
        }
      }

      // Aggrega
      let aggTempo = {}, aggTot = 0, aggBreak = {}, aggNG = 0;
      for (const dstr of dayList) {
        const res = await computeDay(dstr);
        aggTot += res.totMin;
        aggNG  += res.minNonGestibili;
        for (const [tag, min] of Object.entries(res.tempoPerTag)) {
          aggTempo[tag] = (aggTempo[tag] || 0) + min;
        }
        for (const [tag, min] of Object.entries(res.breakdown)) {
          aggBreak[tag] = (aggBreak[tag] || 0) + min;
        }
      }

      let html = `<b>Statistiche Settimanali ${start} → ${end} (${filtro === 'free' ? 'solo tempo gestibile' : 'tutte'})</b><br>`;
      html += `(Totale: <b>${aggTot} min</b> = ${(aggTot/60).toFixed(1)}h)<br>`;

      if (filtro === "free") {
        const giorni = dayList.length;
        const disponibili = (giorni * 1440) - aggNG;
        const perc = disponibili > 0 ? ((aggTot / disponibili) * 100).toFixed(1) : '0.0';
        html += `<i>Usato: ${aggTot} / ${disponibili} min → <b>${perc}%</b></i><br>`;
      }

      html += `<br><b>🕒 Breakdown non gestibile (settimana):</b><ul>`;
      let totNGh = 0;
      for (const tag of NON_LIBERI) {
        if (aggBreak[tag]) {
          totNGh += aggBreak[tag];
          html += `<li>${tag}: ${(aggBreak[tag]/60).toFixed(1)}h</li>`;
        }
      }
      html += `<li><b>Totale non gestibile:</b> ${(totNGh/60).toFixed(1)}h</li>`;
      html += `</ul>`;

      html += `<table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
      const total = Object.values(aggTempo).reduce((a,b)=>a+b,0);
      for (const [tag, min] of Object.entries(aggTempo)) {
        const perc = total > 0 ? ((min / total) * 100).toFixed(1) : '0.0';
        html += `<tr><td>${tag}</td><td>${min}</td><td>${perc}%</td></tr>`;
      }
      html += `</table>`;

      document.getElementById('weekStatsResult').innerHTML = html;

      const ctx = document.getElementById('weekStatsPie').getContext('2d');
      if (weekPieChart) weekPieChart.destroy();
      weekPieChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: Object.keys(aggTempo), datasets: [{ data: Object.values(aggTempo) }] },
        options: { plugins: { legend: { display: true, position: 'right' } } }
      });
    }
    window.calcolaPercentualiSettimana = calcolaPercentualiSettimana;

    // === Service Worker (ok tenerlo) ===
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('✅ Service Worker registrato'))
        .catch(err => console.error('❌ SW errore:', err));
    }
  </script>
</body>
</html>
