// Fantastats Dashboard — Blocco 3
// UI add-on: FS Rate, fasce gol, modal Prestazione/Dettaglio azioni.
// Caricare DOPO lo script inline principale di dashboard.html.

(() => {
  const style = document.createElement('style')
  style.textContent = `
  .fs3-scoreline{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
  .fs3-scoreline strong{font-size:12px}
  .fs3-scoreline small{font-size:10px;color:var(--muted);font-weight:700}
  .goal-band-box{margin:0 0 14px;padding:12px 12px 10px;border:1px solid var(--line);border-radius:12px;background:#f4faf6}
  .goal-band-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:9px;font-size:11px}
  .goal-band-top strong{color:var(--accent)}
  .goal-track{position:relative;height:26px;margin:0 9px}
  .goal-track-line{position:absolute;left:0;right:0;top:12px;height:3px;background:#b9d8c3;border-radius:99px}
  .goal-marker{position:absolute;top:5px;transform:translateX(-50%);width:15px;height:15px;border-radius:50%;background:white;border:3px solid var(--accent);z-index:2}
  .goal-marker span{position:absolute;top:16px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--muted);white-space:nowrap}
  .goal-cursor{position:absolute;top:1px;transform:translateX(-50%);width:5px;height:23px;background:var(--warn);border-radius:6px;z-index:3;box-shadow:0 1px 5px rgba(0,0,0,.15)}
  .goal-caption{margin-top:12px;font-size:10px;color:var(--muted)}
  .player-modal{width:min(930px,100%)}
  .modal-tabs{display:flex;gap:7px;padding:0 24px 14px;border-bottom:1px solid var(--line)}
  .modal-tab{border:1px solid var(--line);background:#fff;color:var(--muted);padding:8px 13px;border-radius:10px;cursor:pointer;font-weight:800}
  .modal-tab.active{background:#dff1e5;color:var(--accent);border-color:#c8e5d1}
  .fs3-tab-panel{display:none}
  .fs3-tab-panel.active{display:block}
  .rating-hero{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center;padding:18px;border-radius:18px;background:#eaf6ed;border:1px solid var(--line);margin-bottom:16px}
  .rating-number{font-size:54px;line-height:1;font-weight:900;color:var(--accent);font-variant-numeric:tabular-nums}
  .rating-number small{display:block;font-size:11px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px}
  .rating-label{font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;font-size:22px;font-weight:800;margin-bottom:8px}
  .rating-scale{height:10px;border-radius:99px;background:#d6e9dc;overflow:hidden}
  .rating-fill{height:100%;background:linear-gradient(90deg,#7cab8d,#16723a);border-radius:99px}
  .rating-note{font-size:10px;color:var(--muted);margin-top:5px}
  .perf-title{margin:18px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);font-weight:900}
  .perf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
  .perf-card{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fbfffc}
  .perf-card small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .perf-card strong{font-size:18px;color:var(--text)}
  .percentile-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .percentile-card{padding:13px 14px;border:1px solid var(--line);border-radius:13px;background:#f4faf6}
  .percentile-card small{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em}
  .percentile-card strong{display:block;font-size:24px;color:var(--accent);margin:3px 0}
  .percentile-card span{font-size:10px;color:var(--muted)}
  .last5{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
  .last5-card{padding:9px;border:1px solid var(--line);border-radius:11px;background:#fff;text-align:center;min-width:0}
  .last5-card .gw{font-weight:900;font-size:11px;color:var(--accent)}
  .last5-card .ng{display:grid;place-items:center;height:76px;color:var(--muted);font-size:12px;font-weight:800}
  .last5-bars{height:62px;display:flex;align-items:flex-end;justify-content:center;gap:5px;margin:5px 0}
  .last5-bar{width:15px;min-height:2px;border-radius:5px 5px 2px 2px}
  .last5-bar.fp{background:#86b497}
  .last5-bar.rate{background:#16723a}
  .last5-values{font-size:9px;color:var(--muted);line-height:1.35}
  .legend{display:flex;gap:14px;font-size:10px;color:var(--muted);margin:5px 0 9px}
  .legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px}
  .legend .fp{background:#86b497}.legend .rate{background:#16723a}
  .actions-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px}
  .actions-table{width:100%;border-collapse:collapse;min-width:730px}
  .actions-table th{background:#e6f4ea;color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.04em;text-align:left;padding:10px 9px;white-space:nowrap}
  .actions-table td{padding:9px;border-top:1px solid rgba(15,95,47,.10);font-size:11px}
  .actions-table td.num{text-align:right;font-variant-numeric:tabular-nums}
  .actions-table .positive{color:var(--good);font-weight:800}
  .actions-table .negative{color:var(--bad);font-weight:800}
  .help-dot{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#cfe7d6;color:var(--accent);font-size:10px;margin-left:3px;cursor:help}
  .actions-note{margin:0 0 12px;padding:10px 12px;border-radius:11px;background:#f4faf6;color:var(--muted);font-size:11px}
  .reg-link{display:inline-flex;align-items:center;text-decoration:none}
  @media(max-width:700px){
    .rating-hero{grid-template-columns:1fr}
    .perf-grid{grid-template-columns:repeat(2,1fr)}
    .percentile-grid{grid-template-columns:1fr}
    .last5{grid-template-columns:repeat(5,minmax(72px,1fr));overflow:auto}
    .modal-tabs{padding-left:16px;padding-right:16px}
  }`
  document.head.appendChild(style)

  // Regolamento nella topbar, senza dover riscrivere l'HTML originale.
  const nav = document.querySelector('.nav-actions')
  if (nav && !nav.querySelector('[data-fs3-reg]')) {
    const a = document.createElement('a')
    a.href = 'regolamento.html'
    a.className = 'ghost reg-link'
    a.dataset.fs3Reg = '1'
    a.textContent = 'Regolamento'
    nav.appendChild(a)
  }

  const oldModalHead = document.querySelector('.player-modal .modal-head')
  if (oldModalHead && !document.getElementById('fs3ModalTabs')) {
    const tabs = document.createElement('div')
    tabs.id = 'fs3ModalTabs'
    tabs.className = 'modal-tabs'
    tabs.innerHTML = `
      <button class="modal-tab active" id="fs3PerfBtn" onclick="fs3SwitchModalTab('performance')">Prestazione</button>
      <button class="modal-tab" id="fs3ActionsBtn" onclick="fs3SwitchModalTab('actions')">Dettaglio azioni</button>`
    oldModalHead.insertAdjacentElement('afterend', tabs)
  }

  window.fs3SwitchModalTab = function(tab) {
    document.getElementById('fs3PerfBtn')?.classList.toggle('active', tab === 'performance')
    document.getElementById('fs3ActionsBtn')?.classList.toggle('active', tab === 'actions')
    document.getElementById('fs3Performance')?.classList.toggle('active', tab === 'performance')
    document.getElementById('fs3Actions')?.classList.toggle('active', tab === 'actions')
  }

  const rateFmt = v => Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : '—'
  const signed = v => {
    const x = Number(v)
    if (!Number.isFinite(x)) return '—'
    return `${x > 0 ? '+' : ''}${fmt(x)}`
  }

  function goalBar(c, score, progress) {
    const thresholds = c?.goalBands?.thresholds || []
    if (!thresholds.length) return ''

    const s = Number(score)
    const first = Number(thresholds[0])
    const last = Number(thresholds[thresholds.length - 1])
    const step = thresholds.length > 1 ? Number(thresholds[1]) - first : 1
    const low = first - step
    const high = last
    const pos = Math.max(0, Math.min(100, ((s - low) / (high - low || 1)) * 100))

    const next = progress?.nextThreshold
    const missing = progress?.missing

    const caption = next == null
      ? `Oltre la 6ª fascia · ${fmt(s)} FP`
      : `Prossima fascia: ${fmt(next)} FP · mancano ${fmt(missing)} FP`

    return `<div class="goal-band-box">
      <div class="goal-band-top"><strong>Fasce gol</strong><span>${fmt(s)} FP</span></div>
      <div class="goal-track">
        <div class="goal-track-line"></div>
        ${thresholds.map((t,i)=>`<div class="goal-marker" style="left:${(i/(thresholds.length-1))*100}%"><span>${esc(fmt(t))}</span></div>`).join('')}
        <div class="goal-cursor" style="left:${pos}%"></div>
      </div>
      <div class="goal-caption">${esc(caption)}</div>
    </div>`
  }

  function last5Html(last5) {
    const rows = Array.isArray(last5) ? last5 : []
    const played = rows.filter(r => r?.status === 'played' && Number.isFinite(Number(r.fp)))
    const maxAbsFp = Math.max(1, ...played.map(r => Math.abs(Number(r.fp))))

    return `<div class="legend"><span><i class="fp"></i>FP</span><span><i class="rate"></i>FS Rate</span></div>
      <div class="last5">
        ${rows.map(r => {
          if (!r || r.status !== 'played') {
            return `<div class="last5-card"><div class="gw">GW${esc(r?.gw ?? '—')}</div><div class="ng">N.G.</div></div>`
          }
          const fpH = Math.max(4, Math.min(58, Math.abs(Number(r.fp)) / maxAbsFp * 58))
          const rateH = Math.max(4, Math.min(58, Math.max(0, Number(r.fsRate)) / 100 * 58))
          return `<div class="last5-card">
            <div class="gw">GW${esc(r.gw)}</div>
            <div class="last5-bars">
              <div class="last5-bar fp" style="height:${fpH}px" title="${esc(fmt(r.fp))} FP"></div>
              <div class="last5-bar rate" style="height:${rateH}px" title="FS Rate ${esc(rateFmt(r.fsRate))}"></div>
            </div>
            <div class="last5-values">${esc(fmt(r.fp))} FP<br>FS ${esc(rateFmt(r.fsRate))}</div>
          </div>`
        }).join('')}
      </div>`
  }

  function actionsHtml(r) {
    let actions = Array.isArray(r.action_details) ? r.action_details : []
    const role = String(r.ruolo || '').trim().toLowerCase()
    const isKeeper = ['p','por'].includes(role)

    actions = actions.filter(a => !a?.goalkeeperOnly || isKeeper)

    if (!actions.length) {
      const entries = Object.entries(r.breakdown || {})
        .map(([key,value]) => [key, Number(value || 0)])
        .filter(([,value]) => Math.abs(value) > 0.000001)

      if (!entries.length) {
        return `<div class="breakdown-empty">Dettaglio azioni non disponibile per questa giornata. Rilanciando la GW verrà rigenerato.</div>`
      }

      return `<div class="actions-note">Questa GW contiene ancora il breakdown precedente al Blocco 1. Il dettaglio completo sarà disponibile dopo il ricalcolo della giornata.</div>
        <div class="breakdown-list">${entries.map(([key,value])=>`
          <div class="breakdown-row">
            <span class="label">${esc((window.breakdownLabels||{})[key]||key)}</span>
            <span class="value ${value>0?'positive':'negative'}">${value>0?'+':''}${fmt(value)}</span>
          </div>`).join('')}</div>`
    }

    return `<div class="actions-note">
      In Fantastats 7 il <strong>×1,3</strong> può applicarsi alle azioni della fase opposta allo slot per i giocatori a ruolo singolo.
      In Flop XI i valori mostrati sono già invertiti.
    </div>
    <div class="actions-wrap">
      <table class="actions-table">
        <thead><tr>
          <th>Azione</th>
          <th>Quantità</th>
          <th>Valore unitario</th>
          <th>Modificatore ruolo <span class="help-dot" title="In Fantastats 7, per giocatori a ruolo singolo, alcune azioni della fase opposta allo slot valgono ×1,3.">?</span></th>
          <th>Bonus soglia <span class="help-dot" title="Mostra il bonus o malus aggiuntivo quando una soglia statistica è stata raggiunta.">?</span></th>
          <th>Totale</th>
        </tr></thead>
        <tbody>
          ${actions.map(a => {
            const t = Number(a.total ?? 0)
            const th = Number(a.thresholdAdjustment ?? 0)
            return `<tr>
              <td>${esc(a.label || a.key || '')}${a.note?` <span class="help-dot" title="${esc(a.note)}">?</span>`:''}</td>
              <td class="num">${esc(fmt(a.quantity ?? 0))}</td>
              <td class="num">${esc(signed(a.unitValue ?? 0))}</td>
              <td class="num">${a.roleModifier === 'x1.3' ? '×1,3' : 'No'}</td>
              <td class="num">${Math.abs(th) > 0.000001 ? esc(signed(th)) : 'No'}</td>
              <td class="num ${t>0?'positive':t<0?'negative':''}">${esc(signed(t))}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>`
  }

  // Override della formazione: aggiunge FP + FS Rate e barra fasce.
  window.lineupHtml = function(team,c,gw,teamScore=null,progress=null){
    const actual = detailRows(c,gw,team)
    const base = ((((DATA.formations||{})[String(gw)]||{})[c.league]||{})[team]||[])

    if(!actual.length) {
      return `<div class="lineup"><h4>${esc(team)}</h4>${teamScore!=null?goalBar(c,teamScore,progress):''}<div class="note">Nessuna formazione valida/contributiva disponibile.</div></div>`
    }

    const actualIds = new Set(actual.map(r=>String(r.player_id)))
    const baseStarters = base.filter(r=>String(r.tipo).toLowerCase().includes('titol'))
    const baseBench = base.filter(r=>!String(r.tipo).toLowerCase().includes('titol'))
    const baseStarterBySlot = new Map(baseStarters.map(r=>[Number(r.slot_index),r]))

    const renderActual = r => {
      const substituted = Number(r.sostituzione) === 1
      return `<div class="player-row ${substituted?'sub-in':''}">
        <span class="role">${esc(r.ruolo||'')}</span>
        <span><button class="player-link" onclick="openPlayerBreakdown('${c.id}',${gw},decodeURIComponent('${encodeURIComponent(team)}'),${JSON.stringify(r.player_id)})">${esc(r.giocatore)}</button> <small style="color:var(--muted)">· ${esc(r.squadra||'')}</small>${substituted?'<span class="sub-label">subentrato</span>':''}</span>
        <span class="fs3-scoreline"><strong>${fmt(r.punteggio)} FP</strong><small>FS Rate ${rateFmt(r.fs_rate)}</small></span>
      </div>`
    }

    const renderGray = r => `<div class="player-row did-not-play">
      <span class="role">${esc(r.ruolo||'')}</span>
      <span>${esc(r.giocatore)} <small>· ${esc(r.squadra||'')}</small></span>
      <span class="pscore">N.G.</span>
    </div>`

    let startersHtml = ''

    if(c.scoreMode === 'fanta7'){
      startersHtml = actual.map(renderActual).join('')
    } else {
      for(const r of actual){
        const original = baseStarterBySlot.get(Number(r.slot_index))
        if(original && String(original.giocatore)!==String(r.giocatore)){
          startersHtml += renderGray(original)
          startersHtml += `<div class="lineup-sub-note">↳ sostituito da ${esc(r.giocatore)}</div>`
        }
        startersHtml += renderActual(r)
      }
    }

    let extra = ''

    if(c.scoreMode === 'fanta7'){
      const excludedStarters = baseStarters.filter(r=>!actual.some(a=>String(a.giocatore)===String(r.giocatore)))
      const otherBench = baseBench.filter(r=>!actual.some(a=>String(a.giocatore)===String(r.giocatore)))
      const fanta7Bench = [...excludedStarters,...otherBench]
      if(fanta7Bench.length) extra = `<div class="bench-title">Panchina</div>${fanta7Bench.map(renderGray).join('')}`
    } else {
      const unusedBench = baseBench.filter(r=>!actual.some(a=>String(a.giocatore)===String(r.giocatore)))
      if(unusedBench.length){
        extra = `<div class="bench-title">Panchina non utilizzata</div>${unusedBench.map(r=>`
          <div class="player-row">
            <span class="role">${esc(r.ruolo||'')}</span>
            <span>${esc(r.giocatore)} <small style="color:var(--muted)">· ${esc(r.squadra||'')}</small></span>
            <span class="pscore">${r.stats&&n(r.stats.minuti)>0?fmt(r.stats.punteggio):'N.G.'}</span>
          </div>`).join('')}`
      }
    }

    return `<div class="lineup"><h4>${esc(team)}</h4>${teamScore!=null?goalBar(c,teamScore,progress):''}${startersHtml}${extra}</div>`
  }

  window.directMatches = function(c,gw,p){
    return `<div class="match-list">${p.matches.map((m,i)=>`
      <div class="match-card">
        <div class="scoreline">
          <div class="teamname">${esc(m.home)}</div>
          <div class="result">${esc(m.result)}</div>
          <div class="teamname away">${esc(m.away)}</div>
        </div>
        <div class="fantapts"><span>${fmt(m.homeScore)} Fantapunti</span><span>${fmt(m.awayScore)} Fantapunti</span></div>
        <button class="details-btn" onclick="toggleLineup('lu${c.id}${gw}${i}',this)">Mostra formazioni e voti ▾</button>
        <div class="lineups" id="lu${c.id}${gw}${i}">
          ${lineupHtml(m.home,c,gw,m.homeScore,m.homeProgress)}
          ${lineupHtml(m.away,c,gw,m.awayScore,m.awayProgress)}
        </div>
      </div>`).join('')}</div>`
  }

  window.roundRobin = function(c,gw,p){
    return `<div class="note">Ogni squadra affronta tutte le altre nella stessa GW: 3 punti per vittoria, 1 per pareggio, 0 per sconfitta.</div>
      <div class="panel" style="margin-bottom:16px">
        <h3>Riepilogo GW${gw}</h3>
        <div class="rankboard">${p.board.map((r,i)=>`
          <div class="rr-summary">
            <span class="medal">${i+1}</span><span>${esc(r.team)}</span>
            <span class="rr-record">${n(r.wins)} V · ${n(r.draws)} N · ${n(r.losses)} P</span>
            <span class="rr-score">${fmt(r.score)}</span><span class="pts">${fmt(r.points)} pt</span>
          </div>`).join('')}</div>
      </div>
      <div class="match-list">${p.matches.map((m,i)=>`
        <div class="match-card">
          <div class="scoreline">
            <div class="teamname">${esc(m.home)}</div>
            <div class="result">${fmt(m.homeGoals)}-${fmt(m.awayGoals)}</div>
            <div class="teamname away">${esc(m.away)}</div>
          </div>
          <div class="fantapts"><span>${fmt(m.homeScore)} Fantapunti</span><span>${fmt(m.awayScore)} Fantapunti</span></div>
          <button class="details-btn" onclick="toggleLineup('rr${c.id}${gw}${i}',this)">Mostra formazioni e voti ▾</button>
          <div class="lineups" id="rr${c.id}${gw}${i}">
            ${lineupHtml(m.home,c,gw,m.homeScore,m.homeProgress)}
            ${lineupHtml(m.away,c,gw,m.awayScore,m.awayProgress)}
          </div>
        </div>`).join('')}</div>`
  }

  window.openPlayerBreakdown = function(compId,gw,team,playerId){
    const c = compById[compId]
    if(!c) return

    const rows = detailRows(c,gw,team)
    const r = rows.find(x=>String(x.player_id)===String(playerId))
    if(!r) return

    const title = document.getElementById('playerModalTitle')
    const meta = document.getElementById('playerModalMeta')
    const body = document.getElementById('playerModalBody')
    const backdrop = document.getElementById('playerModalBackdrop')

    title.textContent = r.giocatore || 'Giocatore'
    meta.textContent = `${r.squadra||''} · ${r.ruolo||''} · GW${gw} · ${c.title}${Number(r.sostituzione)===1?' · subentrato':''}`

    const rate = Number(r.fs_rate)
    const rawRate = Number(r.fs_rate_raw)
    const displayRate = Number.isFinite(rate) ? rate : 0
    const label = r.fs_label || ''
    const season = r.season || {}
    const pct = r.percentiles || {}

    body.innerHTML = `
      <div id="fs3Performance" class="fs3-tab-panel active">
        <div class="rating-hero">
          <div class="rating-number"><small>FS Rate</small>${esc(rateFmt(displayRate))}</div>
          <div>
            <div class="rating-label">${esc(label)}</div>
            <div class="rating-scale"><div class="rating-fill" style="width:${Math.max(0,Math.min(100,displayRate))}%"></div></div>
            <div class="rating-note">${rawRate < 0 ? `Rating teorico ${esc(rateFmt(rawRate))} · la scala grafica parte da 0` : 'Scala interpretativa 0–100 · i Fantapunti restano il valore competitivo'}</div>
          </div>
        </div>

        <div class="perf-title">Prestazione GW${gw}</div>
        <div class="perf-grid">
          <div class="perf-card"><small>Fantapunti</small><strong>${esc(fmt(r.punteggio))}</strong></div>
          <div class="perf-card"><small>FS Rate</small><strong>${esc(rateFmt(r.fs_rate))}</strong></div>
          <div class="perf-card"><small>Minuti</small><strong>${esc(fmt(r.minuti))}</strong></div>
          <div class="perf-card"><small>Ruolo</small><strong>${esc(r.ruolo||'—')}</strong></div>
          <div class="perf-card"><small>Squadra</small><strong>${esc(r.squadra||'—')}</strong></div>
          <div class="perf-card"><small>Giornata</small><strong>GW${gw}</strong></div>
        </div>

        <div class="perf-title">Stagione</div>
        <div class="perf-grid">
          <div class="perf-card"><small>Media FP</small><strong>${season.avgFp==null?'—':esc(fmt(season.avgFp))}</strong></div>
          <div class="perf-card"><small>Media FS Rate</small><strong>${season.avgFsRate==null?'—':esc(rateFmt(season.avgFsRate))}</strong></div>
          <div class="perf-card"><small>Miglior Rating</small><strong>${season.bestFsRate==null?'—':esc(rateFmt(season.bestFsRate))}</strong></div>
          <div class="perf-card"><small>Miglior FP</small><strong>${season.bestFp==null?'—':esc(fmt(season.bestFp))}</strong></div>
          <div class="perf-card"><small>Presenze</small><strong>${esc(fmt(season.appearances ?? 0))}</strong></div>
          <div class="perf-card"><small>Minuti</small><strong>${esc(fmt(season.minutes ?? 0))}</strong></div>
        </div>

        <div class="perf-title">Ultime 5 GW</div>
        ${last5Html(season.last5 || [])}

        <div class="perf-title">Confronto ruolo · GW${gw}</div>
        <div class="percentile-grid">
          <div class="percentile-card">
            <small>Serie A · ruolo ${esc(r.ruolo||'—')}</small>
            <strong>${pct.serieA==null?'—':`${Math.round(pct.serieA)}° percentile`}</strong>
            <span>${pct.serieASample ? `Campione: ${pct.serieASample} giocatori` : 'Campione non disponibile'}</span>
          </div>
          <div class="percentile-card">
            <small>${esc(DATA.leagues[c.league]?.name || 'Lega')} · ruolo ${esc(r.ruolo||'—')}</small>
            <strong>${pct.league==null?'—':`${Math.round(pct.league)}° percentile`}</strong>
            <span>${pct.leagueSample ? `Campione: ${pct.leagueSample} giocatori` : 'Campione non disponibile'}</span>
          </div>
        </div>
      </div>

      <div id="fs3Actions" class="fs3-tab-panel">
        ${actionsHtml(r)}
      </div>
    `

    fs3SwitchModalTab('performance')
    backdrop.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  // Se la pagina è già su una GW quando il file viene caricato, ridisegna
  // subito con le funzioni del Blocco 3.
  if ((location.hash || '').startsWith('#gw/')) {
    try { route() } catch {}
  }
})()
