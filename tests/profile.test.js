const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../web/profile.js');
const committed={GameStateVersion:1,PlayerGameState:{CurrentTurn:2,TurnsToSpend:5000,ResourceSystemState:{Resources:[{Resource:0,Amount:90}]},TownSystemState:{Towns:[{Name:'Zeffira',Buildings:['Barracks','Lumberyard']}]},FtuxSystemState:{Phase:40}},PlayerSettings:{MainVolume:1},SaveFiles:[],TransactionList:[],LastSeenSilverShieldValue:90};
test('fresh login lets Unity initialize its own new game',() => {
  const p=P.fresh(),r=P.playerEvent(p,'login',{});
  assert.deepEqual(r.response.playerGameData.gameData,{});
  assert.equal(r.profile.wallets.mgs_opal_turn,5000);
});
test('committed turn persists buildings and spent shields without a reload refund',() => {
  const p=P.fresh(),r=P.playerEvent(p,'play_turn',committed);
  assert.equal(r.profile.wallets.mgs_opal_shield,90);
  assert.equal(r.profile.wallets.mgs_opal_turn,5000);
  assert.deepEqual(r.response.playerGameData.gameData,committed);
  assert.deepEqual(P.playerEvent(r.profile,'login',{}).response.playerGameData.gameData,committed);
  assert.deepEqual(p.gameData,{});
  assert.deepEqual(P.playerEvent(r.profile,'play_turn',committed).profile.wallets,r.profile.wallets);
});
test('export/import round trip keeps game state and rejects invalid backups',() => {
  const p=P.playerEvent(P.fresh(),'play_turn',committed).profile;
  assert.deepEqual(P.validate(JSON.parse(JSON.stringify(p))),p);
  for(const bad of [null,{}, {...p,build:'wrong'}, {...p,wallets:{mgs_opal_shield:-1,mgs_opal_turn:10}}, {...p,gameData:{PlayerGameState:{}}}, {...p,gameData:{...committed,PlayerGameState:{...committed.PlayerGameState,TurnsToSpend:-1}}}]) assert.throws(() => P.validate(bad));
});
test('save payload supports Unity JSON strings and rejects unexpected events',() => {
  assert.deepEqual(P.dataObject(JSON.stringify(committed)),committed);
  assert.throws(() => P.dataObject('null'));
  assert.throws(() => P.playerEvent(P.fresh(),'unknown',{}));
});
test('committing a turn acknowledges pending transactions exactly once',() => {
  const input=P.clone(committed);input.TransactionList=[{itemId:'offline-building',amount:10}];
  const output=P.playerEvent(P.fresh(),'play_turn',input);
  assert.deepEqual(output.profile.gameData.TransactionList,[]);
  assert.equal(output.profile.wallets.mgs_opal_shield,90);
  assert.equal(input.TransactionList.length,1);
});
