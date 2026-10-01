'use strict';
// No runtime dependencies; shared with the Node contract tests.
const OfflineProfile = (() => {
  const BUILD = '69f127f0211f91000793391a';
  const clone = value => JSON.parse(JSON.stringify(value));
  function fresh() {
    return {format:'demacia-rising-offline',version:1,build:BUILD,gameData:{},wallets:{mgs_opal_shield:100,mgs_opal_turn:5000},missions:[],updatedAt:new Date().toISOString()};
  }
  function validate(value) {
    if (!value || value.format !== 'demacia-rising-offline' || value.version !== 1 || value.build !== BUILD) throw new Error('Bản lưu không đúng định dạng hoặc phiên bản game.');
    if (!value.gameData || typeof value.gameData !== 'object' || Array.isArray(value.gameData)) throw new Error('Dữ liệu tiến trình không hợp lệ.');
    if (!value.wallets || !['mgs_opal_shield','mgs_opal_turn'].every(k => Number.isSafeInteger(value.wallets[k]) && value.wallets[k] >= 0)) throw new Error('Dữ liệu tài nguyên không hợp lệ.');
    if (!Array.isArray(value.missions) || !value.missions.every(m => m && typeof m.internalName === 'string' && typeof m.status === 'string')) throw new Error('Dữ liệu nhiệm vụ không hợp lệ.');
    if (Object.keys(value.gameData).length && (!value.gameData.PlayerGameState || !Array.isArray(value.gameData.SaveFiles))) throw new Error('Bản lưu thiếu trạng thái game hoặc ô lưu.');
    if (Object.keys(value.gameData).length) {
      const state=value.gameData.PlayerGameState;
      if (!Number.isSafeInteger(state.CurrentTurn) || state.CurrentTurn < 1 || !Number.isSafeInteger(state.TurnsToSpend) || state.TurnsToSpend < 0 || !Array.isArray(state.ResourceSystemState?.Resources)) throw new Error('Trạng thái lượt chơi không hợp lệ.');
    }
    return clone(value);
  }
  function dataObject(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Game gửi dữ liệu lưu không hợp lệ.');
    return clone(parsed);
  }
  function playerEvent(profile, eventName, data) {
    const next = clone(profile);
    if (eventName === 'login') return {profile:next,response:{success:true,playerGameData:{gameData:next.gameData}}};
    if (eventName === 'play_turn') {
      next.gameData = dataObject(data);
      // The Unity build owns simulation and serializes the entire player state.
      // Offline grants replace currencies earned by playing online LoL matches.
      const state=next.gameData.PlayerGameState;
      if (!state) throw new Error('Sự kiện lượt chơi thiếu trạng thái game.');
      // Echo the game's committed balance so reloading cannot refund spending.
      if (Number.isSafeInteger(next.gameData.LastSeenSilverShieldValue)) next.wallets.mgs_opal_shield=next.gameData.LastSeenSilverShieldValue;
      if (Number.isSafeInteger(state.TurnsToSpend)) next.wallets.mgs_opal_turn=state.TurnsToSpend;
      next.gameData.TransactionList=[];
    } else if (eventName === 'seen_shields') {
      const amount=typeof data === 'number' ? data : (data?.LastSeenSilverShieldValue ?? data?.lastSeenSilverShieldValue);
      if (Object.keys(next.gameData).length && Number.isSafeInteger(amount)) next.gameData.LastSeenSilverShieldValue=amount;
    } else {
      throw new Error('Sự kiện game chưa được hỗ trợ: ' + eventName);
    }
    next.updatedAt = new Date().toISOString();
    return {profile:next,response:{success:true,playerGameData:{gameData:next.gameData}}};
  }
  return {BUILD,fresh,validate,dataObject,playerEvent,clone};
})();
if (typeof module !== 'undefined') module.exports = OfflineProfile;
