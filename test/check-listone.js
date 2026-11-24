import XLSX from 'xlsx'
const wb=XLSX.readFile('listone_slug.xlsx')
const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
const ids=[7485,6727,7599,4705,7311,5562,4871,4317,6042,6618,5800,4964,7618,6833,6752,6519,2170,5589,1933,5734,7131]
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
for(const r of rows)if(ids.includes(Number(r.id))||/bilow|bijlow|gudmundsson|thuram|milinkovic|floriani/.test(norm(r.nome)))console.log('LISTONE_CHECK '+JSON.stringify(r))
