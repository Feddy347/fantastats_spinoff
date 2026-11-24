// Exact name/team first, then unique punctuation/diacritic-normalized match,
// then explicitly verified quotation IDs. No fuzzy or global surname matching.
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const raw = (n,t) => String(n ?? '').trim().toLowerCase()+'|'+String(t ?? '').trim().toLowerCase()
const key = (n,t) => norm(n)+'|'+norm(t)
const aliases = [
  ["Pellegrini L","Roma",530],
  ["Pellegrino M.","Parma",7023],
  ["Lontani","Como",7561],
  ["Favasuli","Frosinone",7563],
  ["Chalobah T.","Chelsea",5641],
  ["Nicolussi Cav.","Fiorentina",4349],
  ["Dovbyk","Roma",6675],
  [
    "Mangas",
    "Fiorentina",
    7485
  ],
  [
    "Couto",
    "Juventus",
    6727
  ],
  [
    "Bilow",
    "Genoa",
    7332
  ],
  [
    "Lulli",
    "Sassuolo",
    7599
  ],
  [
    "Romano",
    "Roma",
    7311
  ],
  [
    "Thuram",
    "Juventus",
    5562
  ],
  [
    "Gudmundsson",
    "Fiorentina",
    5800
  ],
  [
    "Gudmundsson",
    "Lazio",
    5800
  ],
  [
    "Gudmundsson A.",
    "Lazio",
    5800
  ],
  [
    "Vicario",
    "Tottenham",
    4964
  ],
  [
    "Camarda",
    "Lecce",
    6519
  ],
  [
    "Milinkovic-Sa.",
    "Napoli",
    2170
  ],
  [
    "Floriani Muss.",
    "Lazio",
    7131
  ],
  [
    "Mandragora",
    "Torino",
    1933
  ]
]
export function makePlayerResolver(rows, historicalAliases = []) {
 const exact=new Map(), normalized=new Map(), byId=new Map()
 const add=(map,k,r)=>{if(!map.has(k))map.set(k,new Map());map.get(k).set(String(r.id),r)}
 for(const r of rows){byId.set(String(r.id),r);add(exact,raw(r.nome,r.squadra),r);add(normalized,key(r.nome,r.squadra),r)}
 for(const a of historicalAliases){const r=byId.get(String(a.id));if(r){add(exact,raw(a.nome,a.squadra),r);add(normalized,key(a.nome,a.squadra),r)}}
 // User-confirmed spelling/team correction: Anthony Oyono, not Oyon A.
 const oyono=rows.filter(r=>['oyonoa','anthonyoyono','oyonoanthony'].includes(norm(r.nome)) && norm(r.squadra)==='frosinone')
 if(oyono.length===1){add(exact,raw('Oyon A.','Udinese'),oyono[0]);add(normalized,key('Oyon A.','Udinese'),oyono[0])}
 const approved=new Map(aliases.map(([n,t,id])=>[key(n,t),String(id)]))
 return (name,team)=>{
  for(const [map,k] of [[exact,raw(name,team)],[normalized,key(name,team)]]){
   const candidates=map.get(k)
   if(candidates?.size===1)return [...candidates.values()][0]
   if(candidates?.size>1)return null
  }
  return byId.get(approved.get(key(name,team))) ?? null
 }
}
