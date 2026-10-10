/* Shared custom content; personal attempts remain in each player's profile. */
(() => {
  'use strict';
  const key = 'tempo-custom-puzzles-v1', builtins = [...TempoPuzzles];
  const categories = ['Mate','Fork','Material','Defence'];
  const levels = ['Beginner','Intermediate','Advanced'];
  let loadError = '';
  function text(value,label,max) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw Error(`${label} is required (up to ${max} characters).`);
    return value.trim();
  }
  function validate(input) {
    const theme=text(input.theme,'Title',80), detail=text(input.detail,'Instructions',500), explanation=text(input.explanation,'Explanation',2000);
    if (!categories.includes(input.category) || !levels.includes(input.difficulty)) throw Error('Choose a theme and difficulty from the list.');
    const game=TempoGameData.position(text(input.fen,'FEN',120));
    if (game.status().over) throw Error('The starting position must allow play.');
    const fen=TempoGameData.fen(game.state);
    const line=Array.isArray(input.line) ? [...input.line] : String(input.line || '').trim().split(/\s+/);
    if (!line.length || line.length > 31 || line.length % 2 === 0) throw Error('Use 1–31 moves, ending with the solving side: an odd number of half-moves.');
    for (const [i,uci] of line.entries()) {
      if (typeof uci !== 'string' || !/^([a-h][1-8]){2}[qrbn]?$/.test(uci) || game.status().over) throw Error(`Move ${i+1} is not legal. Use coordinate notation, such as e2e4.`);
      const m=game.move(TempoChess.square(uci.slice(0,2)),TempoChess.square(uci.slice(2,4)),uci[4]);
      if (!m || m.needsPromotion) throw Error(`Move ${i+1} is not legal or needs a promotion letter (q, r, b or n).`);
    }
    if (input.mate === true && game.status().reason !== 'Checkmate') throw Error('The solution must end in checkmate when the mate option is selected.');
    return {theme,category:input.category,difficulty:input.difficulty,detail,explanation,fen,line,mate:input.mate===true,published:input.published===true};
  }
  function list() {
    const raw=localStorage.getItem(key);
    if (!raw) return [];
    let values;
    try { values=JSON.parse(raw); } catch { throw Error('Custom puzzle data could not be read. It has not been overwritten.'); }
    if (!Array.isArray(values) || values.length > 200) throw Error('Custom puzzle data is invalid. It has not been overwritten.');
    const ids=new Set();
    return values.map(p=>{
      if (!p || !/^custom-[a-zA-Z0-9-]+$/.test(p.id) || ids.has(p.id) || !Number.isInteger(p.revision) || p.revision<1) throw Error('Custom puzzle data is invalid. It has not been overwritten.');
      ids.add(p.id);
      return {...validate(p),id:p.id,revision:p.revision,updatedAt:p.updatedAt};
    });
  }
  const playId = p => `${p.id}-r${p.revision}`;
  function refresh() {
    let values=[];loadError='';
    try { values=list(); } catch(error) {loadError=error.message;}
    const published=values.filter(p=>p.published).map(p=>{
      const result={...p,id:playId(p),custom:true,solution:p.line[0]};
      if(p.line.length===1)delete result.line;
      return result;
    });
    TempoPuzzles.splice(0,TempoPuzzles.length,...builtins,...published);
  }
  function requireAdmin() {
    if (!globalThis.TempoAdminAuth?.active()) throw Error('Sign in to the local puzzle manager first.');
  }
  function persist(values) {
    try { localStorage.setItem(key,JSON.stringify(values)); }
    catch { throw Error('Could not save custom puzzles. Browser storage may be full or blocked.'); }
    refresh();
    window.dispatchEvent(new Event('tempo-custom-puzzles-change'));
  }
  function save(input) {
    requireAdmin();
    const value=validate(input), values=list(), index=values.findIndex(p=>p.id===input.id);
    if (input.id && index<0) throw Error('This custom puzzle was not found. Refresh the list.');
    if(index<0 && values.length>=200)throw Error('The local manager can keep up to 200 custom puzzles.');
    const old=values[index];
    if(old && input.updatedAt !== old.updatedAt)throw Error("This puzzle changed in another tab. Refresh the list and reopen it before saving.");
    const changed=old && (old.fen!==value.fen || JSON.stringify(old.line)!==JSON.stringify(value.line) || old.mate!==value.mate);
    const id=old?.id || 'custom-'+(globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
    const result={...value,id,revision:old ? old.revision+(changed?1:0) : 1,updatedAt:Math.max(Date.now(),(old?.updatedAt || 0)+1)};
    if(index>=0)values[index]=result;else values.push(result);
    persist(values);return result;
  }
  function remove(id) {
    requireAdmin();const values=list();
    if(!values.some(p=>p.id===id))throw Error('Custom puzzle not found. Built-in puzzles cannot be deleted here.');
    persist(values.filter(p=>p.id!==id));
  }
  refresh();
  globalThis.TempoCustomPuzzles=Object.freeze({validate,list,save,remove,refresh,playId,error:()=>loadError});
})();
