import test from 'node:test'
import assert from 'node:assert/strict'
import {bestPartialLineup} from '../lib/partialFs7.js'
import {modulesFor} from '../lib/roleSystems.js'
import {resolveLineupScore} from '../lib/resolver.js'
const modules=modulesFor('fantastats')
const roles=new Map([[1,'POR'],[2,'DC'],[3,'T'],[4,'ES'],[5,'Tq'],[6,'ATT'],[7,'ATT'],[8,'DC'],[9,'C']])
const get=id=>(roles.get(id)||'').split(';')
test('Missing C leaves exactly one slot empty and scores the six selected players',()=>{
 const lineup=bestPartialLineup([1,2,3,4,5,6],[7,8],modules,get)
 assert.equal(lineup.covered,6)
 assert.equal(lineup.starters.length,7)
 assert.equal(lineup.starters.find(r=>r.playerId===null).slotRole,'C')
 assert.deepEqual(new Set(lineup.starters.filter(r=>r.playerId!==null).map(r=>r.playerId)),new Set([1,2,3,4,5,6]))
 const result=resolveLineupScore({...lineup,statsById:new Map([...roles].map(([id])=>[id,{mins_played:90}])),roleById:roles,modules})
 assert.equal(result.totalScore,18)
 assert.equal(result.contributions.filter(r=>r.playerId===null).length,1)
})
test('Full coverage takes precedence over fewer reserves',()=>{
 const lineup=bestPartialLineup([1,2,3,4,5,6],[7,8,9],modules,get)
 assert.equal(lineup.covered,7)
 assert(lineup.starters.some(r=>r.playerId===9))
})
test('Multiple missing roles do not duplicate players',()=>{
 const lineup=bestPartialLineup([1,2,3],[],modules,get)
 assert.equal(lineup.covered,3)
 assert.equal(new Set(lineup.starters.filter(r=>r.playerId!==null).map(r=>r.playerId)).size,3)
})
