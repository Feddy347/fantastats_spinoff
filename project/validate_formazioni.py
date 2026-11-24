import argparse, pathlib, re, json, unicodedata
from openpyxl import load_workbook
P=argparse.ArgumentParser(); P.add_argument('file'); P.add_argument('--sources',default='.'); P.add_argument('--gw',type=int,required=True); a=P.parse_args()
root=pathlib.Path(a.sources); f=pathlib.Path(a.file); errors=[]; warnings=[]
def check(ok,msg):
    if not ok: errors.append(msg)
def norm(v): return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(v or '')).lower())
def txt(v): return str(v or '').strip()
def rows(s):
    it=s.values; h=next(it); return [dict(zip(h,r)) for r in it if any(v is not None for v in r)]
def book(n): return load_workbook(root/n,read_only=True,data_only=True)
w=load_workbook(f,read_only=True,data_only=True); model=book('formazioni_GW12.xlsx'); l=book('listone_slug.xlsx'); roster=rows(book('rose.xlsx')['Rose']); players=rows(l.worksheets[0])
byid={str(p['id']):p for p in players}; index={}
def add(n,t,p): index.setdefault((norm(n),norm(t)),{})[str(p['id'])]=p
for p in players: add(p['nome'],p['squadra'],p)
if 'Alias_storici' in l.sheetnames:
    for r in rows(l['Alias_storici']):
        if str(r['id']) in byid: add(r['nome'],r['squadra'],byid[str(r['id'])])
js=(root/'playerIdentity.js').read_text(encoding='utf8')
aliases={}
for n,t,i in re.findall(r'\[\s*["\']([^"\']+)["\']\s*,\s*["\']([^"\']+)["\']\s*,\s*(\d+)\s*\]',js):
    aliases[(norm(n),norm(t))]=byid.get(i)
for alias,team,names,target in [('Oyon A.','Udinese',['oyonoa','anthonyoyono','oyonoanthony'],'frosinone'),('Zambo Angui.','Napoli',['zamboanguissa','anguissa','anguissaz','zamboanguissaf'],'napoli')]:
    hit=[p for p in players if norm(p['nome']) in names and norm(p['squadra'])==target]
    if len(hit)==1: add(alias,team,hit[0])
def resolve(n,t):
    k=(norm(n),norm(t)); hits=index.get(k,{})
    return next(iter(hits.values())) if len(hits)==1 else aliases.get(k) if not hits else None
def seq(v,start): return all(type(x)==int for x in v) and sorted(v)==list(range(start,start+len(v)))
check(1<=a.gw<=38 and f.name==f'formazioni_GW{a.gw}.xlsx','Nome file/GW')
check(set(w.sheetnames)=={'Classic','Mantra','calendario_classic'},'Fogli')
teams={}; counts={}
for league,num in [('Classic',10),('Mantra',6)]:
    if league not in w.sheetnames: continue
    check(next(w[league].values)==next(model[league].values),league+' intestazioni')
    data=rows(w[league]); teams[league]={txt(r.get('utente')) for r in data}; counts[league]={'teams':len(teams[league]),'starters':0,'bench':0}
    expected={txt(r['utente']) for r in roster if txt(r['lega']).lower()==league.lower()}
    check(len(teams[league])==num and teams[league]<=expected,league+' fantasquadre')
    for t in teams[league]:
        rr=[r for r in data if txt(r.get('utente'))==t]; st=[r for r in rr if r.get('tipo')=='Titolare']; be=[r for r in rr if r.get('tipo')=='Panchina']; prefix=league+'/'+t
        counts[league]['starters']+=len(st); counts[league]['bench']+=len(be)
        check(len(st)==11 and seq([r.get('slot_index') for r in st],0),prefix+' titolari/slot')
        check(seq([r.get('ordine_panchina') for r in be],1),prefix+' panchina')
        check(len(st)+len(be)==len(rr),prefix+' tipo')
        ids=set(); rosterids={str(r['id']) for r in roster if txt(r['lega']).lower()==league.lower() and txt(r['utente'])==t}
        for r in rr:
            label=prefix+'/'+txt(r.get('giocatore')); p=resolve(r.get('giocatore'),r.get('squadra'))
            check(r.get('fanta')==league and bool(txt(r.get('giocatore'))) and bool(txt(r.get('squadra'))),label+' campi')
            if not p: errors.append(label+' identità irrisolta'); continue
            i=str(p['id']); check(i not in ids,label+' duplicato'); ids.add(i)
            check(bool(p.get('sorare_slug')) and bool(p.get('role_fantastats')),label+' slug/ruolo FS')
            if i not in rosterids: warnings.append(label+' fuori rosa')
            allowed={x.strip().lower() for x in re.split('[;/]',txt(p.get('role_classic' if league=='Classic' else 'role_mantra')))}
            if not txt(r.get('ruolo')) or not any(x.strip().lower() in allowed for x in re.split('[;/]',txt(r.get('ruolo')))): warnings.append(label+' ruolo da verificare')
if 'calendario_classic' in w.sheetnames:
    check(next(w['calendario_classic'].values)==next(model['calendario_classic'].values),'Calendario intestazioni')
    cal=rows(w['calendario_classic']); pairs=[(txt(r.get('home')),txt(r.get('away'))) for r in cal]; names=[x for pair in pairs for x in pair]
    check(len(pairs)==5 and len(set(names))==10 and set(names)==teams.get('Classic',set()),'Calendario Classic')
    refpath=root/'calendario_fantacalcio.json'
    ref=next((r for r in json.loads(refpath.read_text()) if r['gw']==a.gw),None) if refpath.exists() else None
    if ref: check(sorted(pairs)==sorted((r['home'],r['away']) for r in ref['matches']),'Calendario GW non corrisponde')
    else: warnings.append('Calendario GW non disponibile: confrontare screenshot e confermare')
print(json.dumps({'gw':a.gw,'counts':counts,'errors':errors,'warnings':warnings},ensure_ascii=False,indent=2))
raise SystemExit(1 if errors else 0)
