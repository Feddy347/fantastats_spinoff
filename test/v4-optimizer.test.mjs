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

import {playerLeaders,macroRoles,unlimitedGoalProgress,historyPoint,valueTones} from '../v4/optimizer.js'
test('home leaders use objective scores, exclude nonplayed and split macro roles',()=>{
 const rows=[{id:1,minuti:90,ruolo_classic:'A',punteggio_classic:8,punteggio_fantastats:9,punteggio_flop_classic:-2},{id:2,minuti:0,ruolo_classic:'A',punteggio_classic:99},{id:1,minuti:90,ruolo_classic:'A',punteggio_classic:4,punteggio_fantastats:5,punteggio_flop_classic:1},{id:3,minuti:90,ruolo_classic:'P',punteggio_classic:-1}];
 const r=playerLeaders(rows);assert.deepEqual(r.normal.A,[{id:1,fp:12,played:2}]);assert.equal(r.fantastats.A[0].fp,14);assert.equal(r.flop.A[0].fp,-1);assert.deepEqual(macroRoles('D; C'),['D','C']);
})
test('unlimited goal bands extend normal and flop',()=>{assert.deepEqual(unlimitedGoalProgress(111,[55,63,71,79,87,95]),{goals:8,nextThreshold:119,missing:8,progress:0});assert.equal(unlimitedGoalProgress(11,[-25,-19,-13,-7,-1,5]).nextThreshold,17);assert.equal(unlimitedGoalProgress(0,[55,63]).nextThreshold,55)})
test('zero only if documented, negative values preserved, best/worst correct',()=>{assert.equal(historyPoint({minuti:0},'classic'),0);assert.equal(historyPoint(undefined,'classic'),null);assert.equal(historyPoint({minuti:80,scores:{classic:{fp:-2}}},'classic'),-2);assert.deepEqual(valueTones([5,2,null,5]),['positive','negative','','positive']);assert.deepEqual(valueTones([5,2],-1),['negative','positive']);assert.deepEqual(valueTones([0,0]),['',''])})
