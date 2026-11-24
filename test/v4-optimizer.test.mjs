import {test} from 'node:test'
import assert from 'node:assert/strict'
import {bestLegal,candidate} from '../v4/optimizer.js'
test('max weight eligible, no duplicate, coverage before points',()=>{
 const m=[{id:'example',slotObjs:[{roles:['P']},{roles:['D']},{roles:['C']}]}]
 const result=bestLegal([{id:1,roles:['P'],score:-5},{id:2,roles:['D','C'],score:20},{id:3,roles:['D'],score:10},{id:4,roles:['D'],score:2}],m)
 assert.equal(result.covered,3);assert.equal(result.score,25);assert.deepEqual(result.players.map(p=>p.id),[1,3,2])
})
test('candidate requires played and score; goalkeeper phase consistent',()=>{
 assert.equal(candidate({id:1,minuti:0,punteggio_classic:5,ruolo_classic:'D'},'classic'),null)
 assert.deepEqual(candidate({id:1,minuti:90,punteggio_classic:8,ruolo_classic:'D'},'classic'),{id:1,roles:['D'],score:8})
})
