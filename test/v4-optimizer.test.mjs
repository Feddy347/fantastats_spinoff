import {test} from 'node:test'
import assert from 'node:assert/strict'
import {bestLegal,candidate,forecastSeven} from '../v4/optimizer.js'
test('max weight eligible, no duplicate, coverage before points',()=>{
 const m=[{id:'example',slotObjs:[{roles:['P']},{roles:['D']},{roles:['C']}]}]
 const result=bestLegal([{id:1,roles:['P'],score:-5},{id:2,roles:['D','C'],score:20},{id:3,roles:['D'],score:10},{id:4,roles:['D'],score:2}],m)
 assert.equal(result.covered,3);assert.equal(result.score,25);assert.deepEqual(result.players.map(p=>p.id),[1,3,2])
})
test('candidate requires played and score; goalkeeper phase consistent',()=>{
 assert.equal(candidate({id:1,minuti:0,punteggio_classic:5,ruolo_classic:'D'},'classic'),null)
 assert.deepEqual(candidate({id:1,minuti:90,punteggio_classic:8,ruolo_classic:'D'},'classic'),{id:1,roles:['D'],score:8})
})

test('forecast uses past weeks only, respects exclusions and maximizes cover',()=>{
 const mod=[{id:'toy',slotObjs:[{roles:['POR']},{roles:['DC']}]}];
 const roster=[{id:1,ruolo_fantastats:'POR'},{id:2,ruolo_fantastats:'DC'},{id:3,ruolo_fantastats:'DC'}];
 const rec=(gw,fp)=>({gw,minuti:90,scores:{fantastats:{fp}}});
 const h={1:[rec(1,4),rec(2,4)],2:[rec(1,10),rec(2,10),rec(3,999)],3:[rec(1,8),rec(2,8)]};
 const result=forecastSeven(roster,h,[1,2],mod,{excluded:['2']});
 assert.equal(result.best.covered,2);assert.deepEqual(result.best.players.map(p=>p.id),['1','3']);assert.equal(result.best.score,12);
 assert.equal(forecastSeven(roster,h,[1,2],mod).best.score,14);
});
