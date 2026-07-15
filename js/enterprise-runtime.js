/* Prudent Redact v11 enterprise runtime */
'use strict';
(function(){
  const IDLE_LIMIT = 30 * 60 * 1000;
  const IDLE_WARNING = 2 * 60 * 1000;
  let idleTimer = 0, warnTimer = 0, lastActivity = Date.now(), lastFocused = null;
  const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function iconMenu(){return '<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
  function iconClose(){return '<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
  function enhanceShell(){
    const shell=document.getElementById('appShell'), top=document.querySelector('.topbar'), side=document.querySelector('.sidebar');
    if(!shell||!top||!side||shell.dataset.enterpriseEnhanced==='1') return;
    shell.dataset.enterpriseEnhanced='1';
    if(!document.querySelector('.skip-link')){const skip=document.createElement('a');skip.className='skip-link';skip.href='#mainContent';skip.textContent='Skip to main content';document.body.prepend(skip)}
    const main=shell.querySelector('.main,main'); if(main&&!main.id) main.id='mainContent'; if(main) main.tabIndex=-1;
    const menu=document.createElement('button'); menu.type='button';menu.className='topbar-mobile-menu';menu.setAttribute('aria-label','Open navigation');menu.setAttribute('aria-expanded','false');menu.innerHTML=iconMenu();top.prepend(menu);
    const primary=document.createElement('a');primary.className='mobile-primary-action';primary.href='/dashboard#upload';primary.textContent='New';primary.setAttribute('aria-label','New redaction');top.querySelector('.topbar-right')?.prepend(primary);
    const close=document.createElement('button');close.type='button';close.className='sidebar-close';close.setAttribute('aria-label','Close navigation');close.innerHTML=iconClose();side.prepend(close);
    const backdrop=document.createElement('div');backdrop.className='sidebar-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.appendChild(backdrop);
    const collapse=document.createElement('button');collapse.type='button';collapse.className='sidebar-collapse-btn';collapse.setAttribute('aria-label','Collapse navigation');collapse.innerHTML='<span aria-hidden="true">‹</span>';side.appendChild(collapse);
    side.querySelectorAll('.nav-link').forEach(a=>{ const nodes=[...a.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()); nodes.forEach(n=>{const span=document.createElement('span');span.className='nav-link-label';span.textContent=n.textContent.trim();n.replaceWith(span)}); });
    function open(){lastFocused=document.activeElement;side.classList.add('drawer-open');backdrop.classList.add('open');document.body.classList.add('drawer-lock');menu.setAttribute('aria-expanded','true');close.focus()}
    function shut(){side.classList.remove('drawer-open');backdrop.classList.remove('open');document.body.classList.remove('drawer-lock');menu.setAttribute('aria-expanded','false');lastFocused?.focus?.()}
    menu.addEventListener('click',open);close.addEventListener('click',shut);backdrop.addEventListener('click',shut);side.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{if(innerWidth<=1100)shut()}));
    collapse.addEventListener('click',()=>{shell.classList.toggle('sidebar-collapsed');const c=shell.classList.contains('sidebar-collapsed');sessionStorage.setItem('pr_sidebar_collapsed',c?'1':'0');collapse.innerHTML=`<span aria-hidden="true">${c?'›':'‹'}</span>`;collapse.setAttribute('aria-label',c?'Expand navigation':'Collapse navigation')});
    if(innerWidth>1100&&sessionStorage.getItem('pr_sidebar_collapsed')==='1'){shell.classList.add('sidebar-collapsed');collapse.innerHTML='<span aria-hidden="true">›</span>'}
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&side.classList.contains('drawer-open'))shut();if(e.key==='Tab'&&side.classList.contains('drawer-open')){const items=[...side.querySelectorAll(focusable)].filter(x=>x.offsetParent!==null);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
    addMobileTableClasses();
  }
  function addMobileTableClasses(){document.querySelectorAll('.tbl').forEach(t=>{const wrap=t.parentElement;if(wrap&&!wrap.classList.contains('mobile-card-table')&&t.querySelectorAll('thead th').length<=7)wrap.classList.add('mobile-card-table')})}
  function clearSensitiveClientState(){
    document.querySelectorAll('iframe').forEach(f=>{if(String(f.src).startsWith('blob:')){try{URL.revokeObjectURL(f.src)}catch{} f.removeAttribute('src')}});
    document.querySelectorAll('input[type="password"],input[autocomplete="one-time-code"]').forEach(i=>i.value='');
  }
  function resetIdle(){lastActivity=Date.now();clearTimeout(idleTimer);clearTimeout(warnTimer);if(!window.Session?.valid?.())return;warnTimer=setTimeout(showIdleWarning,IDLE_LIMIT-IDLE_WARNING);idleTimer=setTimeout(expireIdle,IDLE_LIMIT)}
  function showIdleWarning(){if(document.getElementById('idleSecurityDialog'))return;const bg=document.createElement('div');bg.className='modal-bg open';bg.id='idleSecurityDialog';bg.setAttribute('role','presentation');bg.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="idleTitle"><div class="modal-title" id="idleTitle">Session inactivity warning</div><p style="color:var(--ink3);line-height:1.6">Your local workspace will sign out in 2 minutes because there has been no activity. This protects documents on shared devices.</p><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn btn-secondary" id="idleSignOut">Sign out</button><button class="btn btn-primary" id="idleStay">Stay signed in</button></div></div>';document.body.appendChild(bg);bg.querySelector('#idleStay').onclick=()=>{bg.remove();resetIdle()};bg.querySelector('#idleSignOut').onclick=()=>expireIdle();bg.querySelector('#idleStay').focus()}
  function expireIdle(){clearSensitiveClientState();try{Object.keys(localStorage).filter(k=>k.startsWith('pr_pdfops_')||k.startsWith('pr_review_')).forEach(k=>localStorage.removeItem(k))}catch{}window.Session?.clear?.();location.replace('/login?reason=expired')}
  function wireIdle(){['pointerdown','keydown','touchstart','scroll'].forEach(evt=>document.addEventListener(evt,()=>{if(Date.now()-lastActivity>1000)resetIdle()},{passive:true}));resetIdle()}
  function secureExternalLinks(){document.querySelectorAll('a[target="_blank"]').forEach(a=>{a.rel='noopener noreferrer'})}
  function normalizeForms(){document.querySelectorAll('input,select,textarea').forEach(el=>{if(!el.id&&el.name)el.id=el.name});document.querySelectorAll('button:not([type])').forEach(b=>b.type='button')}
  function start(){enhanceShell();secureExternalLinks();normalizeForms();wireIdle();const obs=new MutationObserver(()=>{addMobileTableClasses();secureExternalLinks()});obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('pagehide',()=>{if(!document.body.dataset.preserveSensitiveView)clearSensitiveClientState()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0));else setTimeout(start,0);
})();
