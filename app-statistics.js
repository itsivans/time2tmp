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
  
          let lastTime = items.length ? items[items.length-1].timestamp : null;
          if (lastTime && lastTime < dataYYYYMMDD + "T23:59:59") {
            let fillTag = nextDayActivity ? nextDayActivity.tag : "Sleep";
            events.push({ tag: fillTag, timestamp: dataYYYYMMDD + "T23:59:59" });
          } else if (items.length > 0) {
            events.push({ tag: items[items.length-1].tag, timestamp: dataYYYYMMDD + "T23:59:59" });
          }
  
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
  
          let risultato = `<b>Statistiche del ${dataYYYYMMDD} (${filtro==='free'?'solo tempo gestibile':'tutte le attività'})</b><br>
            (Totale minuti tracciati: <b>${totaliMinuti}</b>)<br><table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
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
            data: { labels: Object.keys(tempoPerTag), datasets: [{ data: Object.values(tempoPerTag) }] },
            options: { plugins: { legend: { display: true, position: 'right' } } }
          });
        });
      });
  }
  
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
        snapshot.forEach(doc => {
          let d = doc.data();
          items.push({ tag: d.tag, timestamp: d.timestamp });
        });
  
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
            if (items.length && items[items.length-1].timestamp < weekEnd) {
              items.push({ tag: next ? next.tag : "Sleep", timestamp: weekEnd });
            }
  
            let tempoPerTag = {}, totaliMinuti = 0;
            for (let i = 1; i < items.length; i++) {
              let t1 = new Date(items[i-1].timestamp);
              let t2 = new Date(items[i].timestamp);
              let diffMin = Math.round((t2-t1)/60000);
              if (diffMin < 0) continue;
              let tag = items[i].tag;
              if (filtro === "free" && NON_LIBERI.includes(tag)) continue;
              tempoPerTag[tag] = (tempoPerTag[tag]||0) + diffMin;
              totaliMinuti += diffMin;
            }
  
            let risultato = `<b>Statistiche dal ${start} al ${end} (${filtro==='free'?'solo tempo gestibile':'tutte le attività'})</b><br>
              (Totale minuti: <b>${totaliMinuti}</b>)<br><table><tr><th>Tag</th><th>Minuti</th><th>%</th></tr>`;
            Object.entries(tempoPerTag).forEach(([tag, minuti]) => {
              let perc = ((minuti / totaliMinuti) * 100).toFixed(1);
              risultato += `<tr><td>${tag}</td><td>${minuti}</td><td>${perc}%</td></tr>`;
            });
            risultato += "</table>";
            document.getElementById('weekStatsResult').innerHTML = risultato;
  
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
  
  // Espone le funzioni per i bottoni HTML
  window.calcolaPercentualiPerData = calcolaPercentualiPerData;
  window.calcolaPercentualiSettimana = calcolaPercentualiSettimana;
  