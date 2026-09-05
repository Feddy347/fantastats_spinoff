// Fantastats Dashboard — Blocco 3.1
// Restyling premium del modal giocatore.
// Mantiene invariata tutta la logica di calcolo e usa i dati già generati dal Blocco 2.

(() => {
  const TEAM_THEMES = {
    'atalanta':['#111111','#1e5aa8'],
    'bologna':['#a71930','#17365d'],
    'cagliari':['#a71930','#17365d'],
    'como':['#1d4f91','#f7f7f7'],
    'cremonese':['#d71920','#c7c7c7'],
    'fiorentina':['#7d3c98','#4a235a'],
    'genoa':['#a71930','#17365d'],
    'hellas verona':['#f3c623','#1e4fa3'],
    'verona':['#f3c623','#1e4fa3'],
    'inter':['#1261a0','#111111'],
    'internazionale':['#1261a0','#111111'],
    'juventus':['#f6f6f6','#111111'],
    'lazio':['#86d5f6','#f8fbff'],
    'lecce':['#f1c40f','#c0392b'],
    'milan':['#d71920','#111111'],
    'napoli':['#66bce8','#1d6fa5'],
    'parma':['#f1c40f','#1e5aa8'],
    'pisa':['#111111','#1e5aa8'],
    'roma':['#f4b223','#8e1b1b'],
    'sassuolo':['#1f9d55','#111111'],
    'torino':['#7b1e2b','#4a1018'],
    'udinese':['#f7f7f7','#111111'],
    'venezia':['#f39c12','#1f1f1f'],
  }

  const ACTION_ICONS = {
    participationPlayed:'▶️',
    participation60:'⏱️',
    goals:'⚽',
    penaltyGoals:'⚽',
    assists:'🅰️',
    shotsOnTarget:'🎯',
    bigChances:'💡',
    penaltyWon:'✨',
    penaltyMissed:'🎯❌',
    passing:'✨',
    dribbles:'🌀',
    tackles:'🛡️',
    interceptions:'🛡️',
    clearances:'🧹',
    duels:'⚔️',
    lineClearance:'🧱',
    lastManTackle:'🛡️',
    keeperSaves:'🧤',
    penaltySave:'🧤',
    goalsConceded:'❌',
    cleanSheet:'🧱',
    fouls:'⚠️',
    yellowCard:'🟨',
    redCard:'🟥',
    ownGoals:'🥅',
    errorLeadToGoal:'⚠️',
    errorLeadToShot:'⚠️',
    penaltyConceded:'⚠️',
  }

  const style = document.createElement('style')
  style.textContent = `
  :root{
    --fs-red:#b42318;
    --fs-red-soft:#fde9e7;
    --fs-yellow:#d49a00;
    --fs-yellow-soft:#fff4cc;
    --fs-green:#2f8d55;
    --fs-green-soft:#e5f3e9;
    --fs-dark:#0e5b34;
    --fs-dark-soft:#dceee3;
  }

  .player-modal{
    width:min(980px,100%);
    max-height:92vh;
    border-radius:26px;
    overflow:auto;
    background:#fff;
    border:1px solid rgba(15,95,47,.18);
    box-shadow:0 36px 95px rgba(0,0,0,.34);
  }

  .player-modal .modal-head{
    position:relative;
    overflow:hidden;
    padding:0;
    min-height:170px;
    border-bottom:0;
    color:white;
    background:#166534;
  }

  .player-modal .modal-head::after{
    content:"";
    position:absolute;
    inset:0;
    background:
      radial-gradient(circle at 85% 15%,rgba(255,255,255,.22),transparent 34%),
      linear-gradient(115deg,rgba(0,0,0,.08),rgba(0,0,0,.26));
    pointer-events:none;
  }

  .fs3-head-inner{
    position:relative;
    z-index:2;
    display:grid;
    grid-template-columns:1fr 190px;
    gap:22px;
    align-items:end;
    min-height:170px;
    padding:28px 74px 26px 30px;
  }

  .fs3-head-eyebrow{
    font-size:11px;
    letter-spacing:.12em;
    text-transform:uppercase;
    font-weight:900;
    opacity:.88;
    margin-bottom:7px;
  }

  .player-modal .modal-head h3{
    margin:0;
    color:white;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:36px;
    line-height:1.03;
    text-shadow:0 2px 10px rgba(0,0,0,.22);
  }

  .player-modal .modal-head p{
    margin:8px 0 0;
    color:rgba(255,255,255,.9);
    font-size:13px;
    font-weight:700;
  }

  .fs3-head-rate{
    justify-self:end;
    width:170px;
    border:1px solid rgba(255,255,255,.42);
    background:rgba(255,255,255,.90);
    color:#173225;
    border-radius:20px;
    padding:14px 15px 13px;
    box-shadow:0 12px 30px rgba(0,0,0,.14);
    backdrop-filter:blur(7px);
  }

  .fs3-head-rate small{
    display:block;
    color:#587064;
    text-transform:uppercase;
    letter-spacing:.08em;
    font-size:10px;
    font-weight:900;
  }

  .fs3-head-rate strong{
    display:block;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:52px;
    line-height:1;
    margin:3px 0 7px;
    color:var(--fs-tone,#16723a);
  }

  .fs3-head-rate span{
    display:block;
    padding:5px 8px;
    border-radius:8px;
    color:white;
    background:var(--fs-tone,#16723a);
    font-size:10px;
    font-weight:900;
    text-align:center;
  }

  .player-modal .modal-close{
    position:absolute;
    right:18px;
    top:16px;
    z-index:4;
    border:1px solid rgba(255,255,255,.42);
    background:rgba(0,0,0,.18);
    color:white;
    box-shadow:none;
  }

  .modal-tabs{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:0;
    padding:0 24px;
    margin-top:-1px;
    border-bottom:1px solid var(--line);
    background:#fff;
  }

  .modal-tab{
    border:0;
    border-radius:0;
    background:#f3f6f4;
    color:#52665c;
    padding:14px 16px;
    cursor:pointer;
    font-weight:900;
    font-size:13px;
    border-bottom:3px solid transparent;
  }

  .modal-tab:first-child{border-radius:14px 0 0 14px}
  .modal-tab:last-child{border-radius:0 14px 14px 0}

  .modal-tab.active{
    color:#fff;
    background:#16723a;
    border-bottom-color:#0e5b34;
  }

  .modal-body{
    padding:22px 24px 26px;
  }

  .fs3-tab-panel{display:none}
  .fs3-tab-panel.active{display:block}

  .fs3-kpis{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:10px;
    margin-bottom:18px;
  }

  .fs3-kpi{
    border:1px solid rgba(15,95,47,.13);
    border-radius:14px;
    background:#fbfdfb;
    padding:14px;
    min-height:92px;
  }

  .fs3-kpi small{
    display:flex;
    gap:6px;
    align-items:center;
    color:#667970;
    font-size:10px;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.045em;
  }

  .fs3-kpi strong{
    display:block;
    margin-top:7px;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:28px;
    line-height:1;
    color:#163728;
  }

  .fs3-rate-ring{
    width:58px;
    height:58px;
    border-radius:50%;
    display:grid;
    place-items:center;
    margin-top:7px;
    background:
      radial-gradient(circle,#fff 54%,transparent 56%),
      conic-gradient(var(--fs-tone,#16723a) calc(var(--fs-pct,0)*1%),#e1e9e4 0);
  }

  .fs3-rate-ring span{
    font-size:17px;
    font-weight:900;
    color:var(--fs-tone,#16723a);
  }

  .fs3-section-title{
    margin:22px 0 10px;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:20px;
    color:#173225;
  }

  .fs3-main-grid{
    display:grid;
    grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);
    gap:16px;
  }

  .fs3-card{
    border:1px solid rgba(15,95,47,.14);
    border-radius:16px;
    background:#fff;
    padding:15px;
  }

  .fs3-season-grid{
    display:grid;
    grid-template-columns:repeat(6,minmax(0,1fr));
    gap:8px;
  }

  .fs3-season-stat{
    padding:11px 8px;
    background:#f5f8f6;
    border-radius:11px;
    text-align:center;
  }

  .fs3-season-stat span{
    display:block;
    font-size:17px;
    margin-bottom:3px;
  }

  .fs3-season-stat small{
    display:block;
    color:#6c7f75;
    font-size:9px;
    text-transform:uppercase;
    letter-spacing:.04em;
  }

  .fs3-season-stat strong{
    display:block;
    margin-top:4px;
    font-size:17px;
  }

  .fs3-last5{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:8px;
  }

  .fs3-last5-card{
    border:1px solid rgba(15,95,47,.13);
    border-radius:13px;
    padding:10px;
    background:#fff;
    min-height:108px;
  }

  .fs3-last5-card .gw{
    font-size:10px;
    font-weight:900;
    color:#214936;
  }

  .fs3-last5-card .ng{
    display:grid;
    place-items:center;
    height:74px;
    color:#849188;
    font-size:11px;
    font-weight:900;
  }

  .fs3-last5-score{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:21px;
    font-weight:900;
    margin:10px 0 5px;
  }

  .fs3-last5-rate{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:6px;
    font-size:10px;
    color:#64766c;
  }

  .fs3-dot{
    width:28px;
    height:28px;
    border-radius:50%;
    display:grid;
    place-items:center;
    background:var(--fs-tone,#16723a);
    color:white;
    font-size:9px;
    font-weight:900;
  }

  .fs3-percentile{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
  }

  .fs3-percentile-card{
    border:1px solid rgba(15,95,47,.13);
    border-radius:13px;
    padding:13px;
    background:#f9fbfa;
  }

  .fs3-percentile-card small{
    display:block;
    color:#667970;
    font-size:9px;
    text-transform:uppercase;
    letter-spacing:.045em;
  }

  .fs3-percentile-card strong{
    display:block;
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:23px;
    margin:4px 0 7px;
    color:var(--fs-tone,#16723a);
  }

  .fs3-percentile-track{
    height:8px;
    border-radius:99px;
    overflow:hidden;
    background:#e4ebe6;
  }

  .fs3-percentile-fill{
    height:100%;
    border-radius:99px;
    background:var(--fs-tone,#16723a);
  }

  .fs3-percentile-card span{
    display:block;
    margin-top:7px;
    color:#718078;
    font-size:9px;
  }

  .goal-band-box{
    margin:0;
    padding:15px;
    border:1px solid rgba(15,95,47,.13);
    border-radius:16px;
    background:#fff;
  }

  .goal-band-top{
    display:flex;
    justify-content:space-between;
    gap:12px;
    align-items:center;
    margin-bottom:10px;
    font-size:11px;
  }

  .goal-band-top strong{
    font-family:"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
    font-size:17px;
    color:#173225;
  }

  .goal-track{position:relative;height:30px;margin:0 9px}
  .goal-track-line{
    position:absolute;
    left:0;right:0;top:12px;height:9px;
    border-radius:99px;
    background:linear-gradient(90deg,#b42318 0 25%,#d49a00 25% 50%,#2f8d55 50% 75%,#0e5b34 75% 100%);
  }

  .goal-marker{
    position:absolute;
    top:7px;
    transform:translateX(-50%);
    width:12px;height:12px;border-radius:50%;
    background:white;border:2px solid #29483a;z-index:2
  }

  .goal-marker span{
    position:absolute;
    top:16px;left:50%;transform:translateX(-50%);
    font-size:8px;color:#677a70;white-space:nowrap
  }

  .goal-cursor{
    position:absolute;
    top:1px;
    transform:translateX(-50%);
    width:4px;height:25px;
    background:#14271e;
    border-radius:6px;
    z-index:3;
    box-shadow:0 1px 5px rgba(0,0,0,.18)
  }

  .goal-caption{
    margin-top:12px;
    padding:9px 10px;
    border-radius:10px;
    background:#f1f5f2;
    font-size:10px;
    color:#5e7066
  }

  .actions-note{
    margin:0 0 12px;
    padding:11px 12px;
    border-radius:11px;
    background:#f4f8f5;
    color:#5d7065;
    font-size:11px;
    border:1px solid rgba(15,95,47,.12)
  }

  .actions-wrap{
    overflow:auto;
    border:1px solid rgba(15,95,47,.13);
    border-radius:14px;
  }

  .actions-table{
    width:100%;
    border-collapse:collapse;
    min-width:760px;
  }

  .actions-table th{
    background:#eef5f0;
    color:#28533d;
    font-size:9px;
    text-transform:uppercase;
    letter-spacing:.045em;
    text-align:left;
    padding:10px 9px;
    white-space:nowrap;
  }

  .actions-table td{
    padding:9px;
    border-top:1px solid rgba(15,95,47,.09);
    font-size:11px;
    vertical-align:middle;
  }

  .actions-table tr:nth-child(even) td{background:#fbfcfb}
  .actions-table td.num{text-align:right;font-variant-numeric:tabular-nums}
  .actions-table td.action-name{font-weight:800}
  .action-icon{display:inline-grid;place-items:center;width:24px;margin-right:5px}
  .actions-table .positive{color:#16794a;font-weight:900}
  .actions-table .negative{color:#b42318;font-weight:900}

  .help-dot{
    display:inline-grid;
    place-items:center;
    width:15px;height:15px;border-radius:50%;
    background:#dce9e0;color:#315a43;
    font-size:9px;margin-left:3px;cursor:help
  }

  .fs3-scoreline{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
  .fs3-scoreline strong{font-size:12px}
  .fs3-scoreline small{font-size:10px;color:var(--muted);font-weight:800}

  .reg-link{display:inline-flex;align-items:center;text-decoration:none}

  @media(max-width:760px){
    .fs3-head-inner{grid-template-columns:1fr;padding:26px 64px 22px 20px}
    .fs3-head-rate{justify-self:start;width:150px}
    .player-modal .modal-head h3{font-size:30px}
    .fs3-kpis{grid-template-columns:repeat(2,1fr)}
    .fs3-main-grid{grid-template-columns:1fr}
    .fs3-season-grid{grid-template-columns:repeat(3,1fr)}
    .fs3-last5{grid-template-columns:repeat(5,minmax(82px,1fr));overflow:auto}
    .fs3-percentile{grid-template-columns:1fr}
    .modal-tabs{padding:0 14px}
  }`

  document.head.appendChild(style)

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
      <button class="modal-tab active" id="fs3PerfBtn" onclick="fs3SwitchModalTab('performance')">📊 Prestazione</button>
      <button class="modal-tab" id="fs3ActionsBtn" onclick="fs3SwitchModalTab('actions')">☷ Dettaglio azioni</button>`
    oldModalHead.insertAdjacentElement('afterend', tabs)
  }

  window.fs3SwitchModalTab = function(tab) {
    document.getElementById('fs3PerfBtn')?.classList.toggle('active', tab === 'performance')
    document.getElementById('fs3ActionsBtn')?.classList.toggle('active', tab === 'actions')
    document.getElementById('fs3Performance')?.classList.toggle('active', tab === 'performance')
    document.getElementById('fs3Actions')?.classList.toggle('active', tab === 'actions')
  }

  const rateFmt = v =>
    Number.isFinite(Number(v))
      ? String(Math.round(Number(v)))
      : '—'

  const signed = v => {
    const x = Number(v)
    if (!Number.isFinite(x)) return '—'
    return `${x > 0 ? '+' : ''}${fmt(x)}`
  }

  function normTeam(name) {
    return String(name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\b(fc|calcio|ssc|ac|as|us|hellas)\b/g,' ')
      .replace(/\s+/g,' ')
      .trim()
  }

  function teamTheme(name) {
    const raw = String(name ?? '').toLowerCase()
    const normalized = normTeam(name)

    for (const [key,value] of Object.entries(TEAM_THEMES)) {
      if (raw.includes(key) || normalized.includes(normTeam(key))) {
        return value
      }
    }

    return ['#1f7a3e','#0e5b34']
  }

  function rateTone(rate) {
    const r = Number(rate)
    if (!Number.isFinite(r) || r < 40) {
      return { color:'#b42318', soft:'#fde9e7', name:'rosso' }
    }
    if (r < 65) {
      return { color:'#d49a00', soft:'#fff4cc', name:'giallo' }
    }
    if (r < 80) {
      return { color:'#2f8d55', soft:'#e5f3e9', name:'verde' }
    }
    return { color:'#0e5b34', soft:'#dceee3', name:'verde scuro' }
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
      ? `6+ gol · ${fmt(s)} FP`
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

    return `<div class="fs3-last5">
      ${rows.map(r => {
        if (!r || r.status !== 'played') {
          return `<div class="fs3-last5-card">
            <div class="gw">GW${esc(r?.gw ?? '—')}</div>
            <div class="ng">N.G.</div>
          </div>`
        }

        const tone = rateTone(r.fsRate)

        return `<div class="fs3-last5-card" style="--fs-tone:${tone.color}">
          <div class="gw">GW${esc(r.gw)}</div>
          <div class="fs3-last5-score">${esc(fmt(r.fp))} FP</div>
          <div class="fs3-last5-rate">
            <span>FS Rate</span>
            <span class="fs3-dot">${esc(rateFmt(r.fsRate))}</span>
          </div>
        </div>`
      }).join('')}
    </div>`
  }

  function percentileCard(title, pct, sample, tone) {
    const p = Number(pct)
    const safe = Number.isFinite(p) ? Math.max(0,Math.min(100,p)) : 0

    return `<div class="fs3-percentile-card" style="--fs-tone:${tone.color}">
      <small>${esc(title)}</small>
      <strong>${Number.isFinite(p) ? `${Math.round(p)}° percentile` : '—'}</strong>
      <div class="fs3-percentile-track">
        <div class="fs3-percentile-fill" style="width:${safe}%"></div>
      </div>
      <span>${sample ? `Campione: ${sample} giocatori` : 'Campione non disponibile'}</span>
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
            <span class="label">${esc(key)}</span>
            <span class="value ${value>0?'positive':'negative'}">${value>0?'+':''}${fmt(value)}</span>
          </div>`).join('')}</div>`
    }

    return `<div class="actions-note">
      Le icone riprendono quelle già utilizzate nella dashboard per bonus e malus.
      In Fantastats 7 il <strong>×1,3</strong> compare solo quando realmente applicato.
      In Flop XI i valori sono già invertiti.
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
            const icon = ACTION_ICONS[a.key] || '•'

            return `<tr>
              <td class="action-name"><span class="action-icon">${icon}</span>${esc(a.label || a.key || '')}${a.note?` <span class="help-dot" title="${esc(a.note)}">?</span>`:''}</td>
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

  window.lineupHtml = function(team,c,gw,teamScore=null,progress=null){
    const actual = detailRows(c,gw,team)
    const base = ((((DATA.formations||{})[String(gw)]||{})[c.league]||{})[team]||[])

    if(!actual.length) {
      return `<div class="lineup"><h4>${esc(team)}</h4>${teamScore!=null?goalBar(c,teamScore,progress):''}<div class="note">Nessuna formazione valida/contributiva disponibile.</div></div>`
    }

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

      if(fanta7Bench.length) {
        extra = `<div class="bench-title">Panchina</div>${fanta7Bench.map(renderGray).join('')}`
      }
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
            <span class="medal">${i+1}</span>
            <span>${esc(r.team)}</span>
            <span class="rr-record">${n(r.wins)} V · ${n(r.draws)} N · ${n(r.losses)} P</span>
            <span class="rr-score">${fmt(r.score)}</span>
            <span class="pts">${fmt(r.points)} pt</span>
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
    const modalHead = document.querySelector('.player-modal .modal-head')

    const rate = Number(r.fs_rate)
    const rawRate = Number(r.fs_rate_raw)
    const displayRate = Number.isFinite(rate) ? rate : 0
    const label = r.fs_label || ''
    const season = r.season || {}
    const pct = r.percentiles || {}

    const tone = rateTone(displayRate)
    const [teamA,teamB] = teamTheme(r.squadra)

    if (modalHead) {
      modalHead.style.background =
        `linear-gradient(115deg,rgba(0,0,0,.10),rgba(0,0,0,.22)),linear-gradient(125deg,${teamA},${teamB})`
      modalHead.style.setProperty('--fs-tone',tone.color)
    }

    title.outerHTML = `<div class="fs3-head-copy">
      <div class="fs3-head-eyebrow">${esc(r.squadra || 'Fantastats')}</div>
      <h3 id="playerModalTitle">${esc(r.giocatore || 'Giocatore')}</h3>
      <p id="playerModalMeta">${esc(r.ruolo||'—')} · GW${gw} · ${esc(c.title)}${Number(r.sostituzione)===1?' · subentrato':''}</p>
    </div>`

    const headCopy = document.querySelector('.player-modal .fs3-head-copy')
    const closeBtn = document.querySelector('.player-modal .modal-close')

    if (modalHead) {
      const oldRate = modalHead.querySelector('.fs3-head-rate')
      oldRate?.remove()

      let inner = modalHead.querySelector('.fs3-head-inner')

      if (!inner) {
        inner = document.createElement('div')
        inner.className = 'fs3-head-inner'

        if (headCopy) inner.appendChild(headCopy)
        modalHead.insertBefore(inner, closeBtn)
      }

      const rateBox = document.createElement('div')
      rateBox.className = 'fs3-head-rate'
      rateBox.style.setProperty('--fs-tone',tone.color)
      rateBox.innerHTML = `
        <small>FS Rate</small>
        <strong>${esc(rateFmt(displayRate))}</strong>
        <span>${esc(label)}</span>`

      inner.appendChild(rateBox)
    }

    body.innerHTML = `
      <div id="fs3Performance" class="fs3-tab-panel active" style="--fs-tone:${tone.color}">
        <div class="fs3-kpis">
          <div class="fs3-kpi">
            <small>⚡ Fantapunti</small>
            <strong>${esc(fmt(r.punteggio))}</strong>
          </div>

          <div class="fs3-kpi" style="--fs-tone:${tone.color};--fs-pct:${Math.max(0,Math.min(100,displayRate))}">
            <small>📊 FS Rate</small>
            <div class="fs3-rate-ring"><span>${esc(rateFmt(displayRate))}</span></div>
          </div>

          <div class="fs3-kpi">
            <small>⏱️ Minuti</small>
            <strong>${esc(fmt(r.minuti))}</strong>
          </div>

          <div class="fs3-kpi">
            <small>🎯 Miglior FP stagione</small>
            <strong>${season.bestFp==null?'—':esc(fmt(season.bestFp))}</strong>
          </div>
        </div>

        <div class="fs3-main-grid">
          <div>
            <div class="fs3-section-title">Ultime 5 giornate</div>
            ${last5Html(season.last5 || [])}

            <div class="fs3-section-title">Statistiche stagionali</div>
            <div class="fs3-card">
              <div class="fs3-season-grid">
                <div class="fs3-season-stat"><span>👕</span><small>Presenze</small><strong>${esc(fmt(season.appearances ?? 0))}</strong></div>
                <div class="fs3-season-stat"><span>⏱️</span><small>Minuti</small><strong>${esc(fmt(season.minutes ?? 0))}</strong></div>
                <div class="fs3-season-stat"><span>📈</span><small>Media FP</small><strong>${season.avgFp==null?'—':esc(fmt(season.avgFp))}</strong></div>
                <div class="fs3-season-stat"><span>⭐</span><small>Miglior FP</small><strong>${season.bestFp==null?'—':esc(fmt(season.bestFp))}</strong></div>
                <div class="fs3-season-stat"><span>🎯</span><small>Media FS</small><strong>${season.avgFsRate==null?'—':esc(rateFmt(season.avgFsRate))}</strong></div>
                <div class="fs3-season-stat"><span>★</span><small>Miglior FS</small><strong>${season.bestFsRate==null?'—':esc(rateFmt(season.bestFsRate))}</strong></div>
              </div>
            </div>
          </div>

          <div>
            ${goalBar(c,r.punteggio,{
              nextThreshold:
                c?.goalBands?.thresholds?.find(t=>Number(t)>Number(r.punteggio)) ?? null,
              missing:
                (() => {
                  const next = c?.goalBands?.thresholds?.find(t=>Number(t)>Number(r.punteggio))
                  return next == null ? null : Math.max(0,Number(next)-Number(r.punteggio))
                })()
            })}

            <div class="fs3-section-title">Percentili</div>
            <div class="fs3-percentile">
              ${percentileCard(`Serie A · ruolo ${r.ruolo||'—'}`,pct.serieA,pct.serieASample,tone)}
              ${percentileCard(`${DATA.leagues[c.league]?.name || 'Lega'} · ruolo ${r.ruolo||'—'}`,pct.league,pct.leagueSample,tone)}
            </div>

            <div class="fs3-section-title">Prestazione</div>
            <div class="fs3-card">
              <div style="font-size:11px;color:#62756b;line-height:1.55">
                <strong style="display:block;font-size:15px;color:${tone.color};margin-bottom:4px">${esc(label)}</strong>
                ${rawRate < 0
                  ? `Rating teorico ${esc(rateFmt(rawRate))}. La scala grafica parte da 0, ma il valore negativo resta registrato.`
                  : `FS Rate ${esc(rateFmt(displayRate))}. I Fantapunti restano il valore competitivo utilizzato per risultati e classifiche.`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="fs3Actions" class="fs3-tab-panel">
        <div class="fs3-section-title" style="margin-top:0">Tutte le azioni e i relativi punteggi</div>
        ${actionsHtml(r)}
      </div>
    `

    fs3SwitchModalTab('performance')
    backdrop.classList.add('open')
    document.body.style.overflow = 'hidden'
  }

  if ((location.hash || '').startsWith('#gw/')) {
    try { route() } catch {}
  }
})()
