/* Local manager controller. User text is rendered with textContent, never HTML. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), A=TempoAdminAuth, D=TempoCustomPuzzles;
  if (!TempoAuth.requireAdmin()) return;
  document.body.classList.remove('checking-admin');
  window.addEventListener('pageshow', () => {
    if (!TempoAuth.requireAdmin()) return;
  });
  const board=new TempoStudyBoard($('admin-board'));
  let selected=null, dirty=false, preview=null, cursor=0;
  function message(text,error=false) {$('admin-status').textContent=text;$('admin-status').dataset.error=String(error);}
  function allowDiscard() {return !dirty || window.confirm('Discard your unsaved puzzle changes?');}
  $('admin-workspace').hidden=false;
  $('admin-password-section').hidden=false;
  $('admin-identity').textContent=A.account()?.displayName || 'Rohit';
  function readForm() {
    return {...(selected||{}),theme:$('admin-title').value,category:$('admin-category').value,difficulty:$('admin-level').value,
      detail:$('admin-detail').value,fen:$('admin-fen').value,line:$('admin-line').value.trim().split(/\s+/),
      explanation:$('admin-explanation').value,mate:$('admin-mate').checked,published:$('admin-published').checked};
  }
  function invalidatePreview() {
    preview=null;cursor=0;$('admin-prev').disabled=$('admin-next').disabled=true;$('admin-play').hidden=true;
    $('admin-preview-status').textContent='Validate to preview the current form.';$('admin-moves').textContent='';
    board.render(new TempoChess.Game());
  }
  function fill(p=null) {
    selected=p;dirty=false;$('admin-puzzle-form').reset();
    $('editor-title').textContent=p?'Edit puzzle':'New puzzle';
    for(const [id,key] of [['admin-title','theme'],['admin-category','category'],['admin-level','difficulty'],['admin-detail','detail'],['admin-fen','fen'],['admin-explanation','explanation']])
      $(id).value=p?.[key] || (key==='category'?'Mate':key==='difficulty'?'Beginner':'');
    $('admin-line').value=p?.line.join(' ')||'';$('admin-mate').checked=p?.mate===true;$('admin-published').checked=p?.published===true;
    invalidatePreview();if(p)showPreview();
  }
  function renderPreview() {
    const g=TempoGameData.position(preview.fen);
    for(const u of preview.line.slice(0,cursor))g.move(TempoChess.square(u.slice(0,2)),TempoChess.square(u.slice(2,4)),u[4]);
    board.render(g);$('admin-prev').disabled=cursor===0;$('admin-next').disabled=cursor===preview.line.length;
    $('admin-preview-status').textContent=`Valid solution · ${cursor} of ${preview.line.length} half-moves shown · ${g.status().over?g.status().reason:(g.state.turn==='w'?'White':'Black')+' to move'}`;
    $('admin-moves').textContent=g.history.map(m=>`${m.number}${m.color==='w'?'.':'…'} ${m.san}`).join(' ');
  }
  function showPreview() {
    preview=D.validate(readForm());cursor=0;renderPreview();
    $('admin-play').hidden=!(selected?.published && !dirty);
    if(!$('admin-play').hidden)$('admin-play').href='play.html?view=puzzles&puzzle='+encodeURIComponent(D.playId(selected));
  }
  function refreshList() {
    try {
      const all=D.list(),q=$('admin-search').value.trim().toLowerCase(),level=$('admin-filter-level').value,state=$('admin-filter-state').value;
      const visible=all.filter(p=>(!q || [p.theme,p.category,p.detail].join(' ').toLowerCase().includes(q)) && (!level||p.difficulty===level) && (!state||p.published===(state==='published')));
      $('admin-count').textContent=`${all.length} custom · ${all.filter(p=>p.published).length} published · ${visible.length} shown`;
      $('admin-list').replaceChildren();
      for(const p of visible) {
        const row=document.createElement('article');row.className='admin-puzzle-row';
        const info=document.createElement('div'),title=document.createElement('h3'),meta=document.createElement('p');
        title.textContent=p.theme;meta.textContent=`${p.published?'Published':'Draft'} · ${p.category} · ${p.difficulty} · ${p.line.length} half-moves`;
        info.append(title,meta);const actions=document.createElement('div');actions.className='admin-actions';
        function button(label,fn) {const b=document.createElement('button');b.type='button';b.className='pill secondary';b.textContent=label;b.setAttribute('aria-label',label+' '+p.theme);b.addEventListener('click',()=>{try{fn();}catch(e){message(e.message,true);}});actions.append(b);}
        button('Edit',()=>{if(!allowDiscard())return;fill(p);$('admin-title').focus();message('Editing '+p.theme+'.');});
        button(p.published?'Unpublish':'Publish',()=>{
          if(selected?.id===p.id && !allowDiscard())return;
          const updated=D.save({...p,published:!p.published});if(selected?.id===p.id)fill(updated);refreshList();message(updated.published?'Puzzle published in this browser.':'Puzzle saved as a draft.');
        });
        button('Delete',()=>{
          if(!window.confirm(`Delete “${p.theme}”? This removes the custom puzzle from this browser and cannot be undone.`))return;
          if(selected?.id===p.id && !allowDiscard())return;
          D.remove(p.id);if(selected?.id===p.id)fill();refreshList();message('Custom puzzle deleted.');
        });
        row.append(info,actions);$('admin-list').append(row);
      }
      if(!visible.length){const p=document.createElement('p');p.textContent=all.length?'No puzzles match these filters.':'No custom puzzles yet. Create one or load the example.';$('admin-list').append(p);}
    } catch(e) {message(e.message,true);}
  }
  $('admin-logout').addEventListener('click',()=>{if(!allowDiscard())return;A.logout();location.replace('login.html');});
  $('admin-password-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const button=form.querySelector('button[type=submit]');
    button.disabled=true;
    try {
      if($('admin-new-password').value!==$('admin-confirm-password').value)throw Error('The new passwords do not match.');
      await A.changePassword($('admin-current-password').value,$('admin-new-password').value);
      form.reset();message('Administrator password changed. The new password remains active after reload.');
    }catch(error){message(error.message,true);}finally{button.disabled=false;}
  });
  $('admin-puzzle-form').addEventListener('input',()=>{dirty=true;invalidatePreview();});
  $('admin-puzzle-form').addEventListener('submit',e=>{
    e.preventDefault();try{const saved=D.save(readForm());fill(saved);refreshList();message(saved.published?'Puzzle saved and published in this browser.':'Draft saved. Publish it when you are ready.');}catch(error){message(error.message,true);}
  });
  $('admin-preview').addEventListener('click',()=>{try{showPreview();message('Position and solution moves are valid.');}catch(e){invalidatePreview();message(e.message,true);}});
  $('admin-new').addEventListener('click',()=>{if(!allowDiscard())return;fill();message('New draft. Nothing is saved until you choose Save puzzle.');$('admin-title').focus();});
  $('admin-example').addEventListener('click',()=>{
    if(!allowDiscard())return;
    const p=TempoPuzzles.find(p=>p.id==='tactic-1');
    fill({...p,line:[p.solution],published:false});selected=null;dirty=true;$('editor-title').textContent='New puzzle';$('admin-title').value=p.theme+' — example';$('admin-play').hidden=true;
    message('Example loaded. Edit it and save to create your own copy.');
  });
  $('admin-prev').addEventListener('click',()=>{if(preview&&cursor>0){cursor--;renderPreview();}});
  $('admin-next').addEventListener('click',()=>{if(preview&&cursor<preview.line.length){cursor++;renderPreview();}});
  $('admin-flip').addEventListener('click',()=>board.flip());
  $('admin-theme').addEventListener('click',()=>TempoTheme.toggle());
  $('admin-refresh').addEventListener('click',refreshList);
  for(const id of ['admin-search','admin-filter-level','admin-filter-state'])$(id).addEventListener(id==='admin-search'?'input':'change',refreshList);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('storage',e=>{
    if(e.key==='tempo-accounts-v1'||e.key===null){location.replace('login.html');}
    if(e.key==='tempo-custom-puzzles-v1' && A.active()){refreshList();message('The collection changed in another tab. Reopen a puzzle before editing it.');}
  });
  try{board.render(new TempoChess.Game());}catch(e){message(e.message,true);}
})();
