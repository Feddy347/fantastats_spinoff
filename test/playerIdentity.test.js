import test from 'node:test'
import assert from 'node:assert/strict'
import { makePlayerResolver } from '../lib/playerIdentity.js'
test('verified aliases, accents and homonyms',()=>{
 const resolve=makePlayerResolver([{id:5562,nome:'Thuram K.',squadra:'Juventus'},{id:4871,nome:'Thuram',squadra:'Inter'},{id:4317,nome:"N'Dicka",squadra:'Roma'},{id:7332,nome:'Bijlow',squadra:'Genoa'}])
 assert.equal(resolve('Thuram','Juventus').id,5562)
 assert.equal(resolve('Thuram','Inter').id,4871)
 assert.equal(resolve('N’Dicka','Roma').id,4317)
 assert.equal(resolve('Bilow','Genoa').id,7332)
 assert.equal(resolve('Thuram','Roma'),null)
})
test('ambiguous normalized name is rejected',()=>{
 const resolve=makePlayerResolver([{id:1,nome:'Koné',squadra:'Roma'},{id:2,nome:'Konè',squadra:'Roma'}])
 assert.equal(resolve('Kone','Roma'),null)
})
