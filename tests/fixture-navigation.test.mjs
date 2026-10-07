import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureCategoryTabs, resolveFixtureSelection } from '../assets/js/fixture-navigation.js';
const match = (group,a,b,extra={}) => ({categoria:'2014',grupo:group,equipo_local_id:a,equipo_visitante_id:b,estado:'OFICIAL',goles_local:0,goles_visitante:0,...extra});
const complete = () => [match('A','a1','a2'),match('B','b1','b2')];
const ids = games => fixtureCategoryTabs(games).map(t=>t.id);
test('Both completed groups collapse into one category, with group choices retained',()=>{
 const tabs=fixtureCategoryTabs(complete());
 assert.deepEqual(tabs,[{id:'2014',category:'2014',group:null,groups:['A','B'],merged:true}]);
});
test('A pending or live match in either group keeps separate categories',()=>{
 for(const estado of ['PROGRAMADO','EN_VIVO','EN_REVISION']) {
  assert.deepEqual(ids([match('A','a1','a2'),match('B','b1','b2',{estado})]),['2014 GRP A','2014 GRP B']);
 }
 assert.deepEqual(ids([match('A','a1','a2',{goles_local:null}),match('B','b1','b2')]),['2014 GRP A','2014 GRP B']);
});
test('Byes do not delay completion and a single group is never collapsed',()=>{
 assert.deepEqual(ids([...complete(),match('B','b1',null,{estado:'PROGRAMADO'})]),['2014']);
 assert.deepEqual(ids([match('A','a1','a2')]),['2014 GRP A']);
});
test('Missing pairings or an unplayed known group prevent premature merging',()=>{
 const rows=[{categoria:'2014',grupo:'A',equipo_id:'a3'}];
 assert.equal(fixtureCategoryTabs(complete(),rows).some(t=>t.merged),false);
 assert.equal(fixtureCategoryTabs([match('A','a1','a2')],[{categoria:'2014',grupo:'B',equipo_id:'b1'}]).some(t=>t.merged),false);
 assert.equal(fixtureCategoryTabs([...complete(),match(null,'a1','b1')]).some(t=>t.merged),false);
});
test('Completion is per category and independent of standings ties',()=>{
 const rows=['a1','a2','b1','b2'].map((id,i)=>({categoria:'2014',grupo:i<2?'A':'B',equipo_id:id,pts:1,dg:0,gf:0}));
 const games=[...complete(),match('A','x1','x2',{categoria:'2015'}),match('B','y1','y2',{categoria:'2015',estado:'PROGRAMADO'})];
 assert.deepEqual(fixtureCategoryTabs(games,rows).map(t=>t.id),['2014','2015 GRP A','2015 GRP B']);
});
test('Previous group URLs and selections still resolve after merging and reopening',()=>{
 const merged=fixtureCategoryTabs(complete());
 assert.equal(resolveFixtureSelection(merged,'2014 GRP B').group,'B');
 assert.equal(resolveFixtureSelection(merged,'2014','B').group,'B');
 const open=fixtureCategoryTabs([match('A','a1','a2'),match('B','b1','b2',{estado:'PROGRAMADO'})]);
 assert.equal(resolveFixtureSelection(open,'2014','B').tab.id,'2014 GRP B');
 assert.equal(resolveFixtureSelection(merged,'missing','C').group,'A');
});
