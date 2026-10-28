/* Notifikasi reservasi masuk: ikon pesan + kotak masuk. Berjalan setelah admin login. */
(function(){
  const API='api/notifications.php', POLL=15000;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let items=[], unread=0, knownUnread=null, started=false;
  const selected=new Set(), seenIds=new Set(), highlight=new Set();

  const host=document.querySelector('.admin-header-right'); if(!host) return;
  const wrap=document.createElement('div'); wrap.className='nf-wrap';
  wrap.innerHTML=`<button class="nf-bell" id="nfBell" aria-label="Pesan masuk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><span class="nf-badge" id="nfBadge">0</span></button>`;
  host.insertBefore(wrap,host.firstChild);
  const bell=wrap.querySelector('#nfBell'), badge=wrap.querySelector('#nfBadge');
  // Panel ditaruh di <body> (posisi fixed) supaya tidak terpotong oleh header yang overflow:hidden
  const panel=document.createElement('div'); panel.className='nf-panel'; panel.id='nfPanel'; document.body.appendChild(panel);
  function place(){ const r=bell.getBoundingClientRect();
    if(r.bottom<0){ panel.classList.remove('open'); return; }
    const top=Math.max(8,r.bottom+8);
    // Lebar & posisi dihitung agar panel selalu berada penuh di dalam layar (termasuk HP)
    const vw=document.documentElement.clientWidth, w=Math.min(380,vw-16);
    const left=Math.min(Math.max(8,r.right-w),vw-w-8);
    panel.style.top=top+'px'; panel.style.left=left+'px'; panel.style.right='auto'; panel.style.width=w+'px';
    panel.style.maxHeight=Math.max(220,innerHeight-top-12)+'px'; }
  addEventListener('resize',()=>{ if(panel.classList.contains('open')) place(); });
  addEventListener('scroll',()=>{ if(panel.classList.contains('open')) place(); },{passive:true});
  const baseTitle=document.title;

  // Umur pesan dihitung server (age_seconds) agar tidak terpengaruh beda zona waktu
  function ago(born){ const d=(Date.now()-born)/1000; if(isNaN(d)) return '';
    if(d<60) return 'baru saja'; if(d<3600) return Math.floor(d/60)+' mnt lalu';
    if(d<86400) return Math.floor(d/3600)+' jam lalu'; return Math.floor(d/86400)+' hari lalu'; }

  // Suara notifikasi: "ding-dong" tegas diulang 3x (sekitar 2,5 detik)
  let actx=null;
  function audio(){ if(!actx){ const C=window.AudioContext||window.webkitAudioContext; if(C) actx=new C(); } return actx; }
  document.addEventListener('click',()=>{ const a=audio(); if(a&&a.state==='suspended') a.resume(); });
  function beep(){
    try{
      const a=audio(); if(!a) return; if(a.state==='suspended') a.resume();
      const notes=[988,1319], dur=0.3, gap=0.04, rep=3, pause=0.18;
      let t=a.currentTime+0.05;
      for(let r=0;r<rep;r++){
        notes.forEach(f=>{
          [['triangle',1,0.5],['square',2,0.07]].forEach(([type,mult,vol])=>{
            const o=a.createOscillator(), g=a.createGain();
            o.type=type; o.frequency.value=f*mult/(type==='square'?2:1);
            g.gain.setValueAtTime(0.0001,t);
            g.gain.exponentialRampToValueAtTime(vol,t+0.008);
            g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
            o.connect(g); g.connect(a.destination); o.start(t); o.stop(t+dur+0.02);
          });
          t+=dur+gap;
        });
        t+=pause;
      }
    }catch(e){}
  }

  function renderBadge(){ badge.style.display=unread>0?'inline-flex':'none'; badge.textContent=unread>99?'99+':unread;
    document.title=unread>0?`(${unread}) ${baseTitle}`:baseTitle; }

  async function post(body,silent){
    try{
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok){ if(!silent) alert('Gagal menyimpan perubahan (kode '+r.status+'). Coba muat ulang halaman.'); return false; }
      return true;
    }catch(e){ if(!silent) alert('Tidak bisa terhubung ke server.'); return false; }
  }


  // Membuka kotak masuk = semua pesan dianggap sudah dibaca (angka di ikon hilang),
  // tapi pesan yang baru tetap ditebalkan selama kotak masuk terbuka.
  function markAllSeen(){
    const un=items.filter(i=>!+i.admin_seen); if(!un.length) return;
    un.forEach(i=>{ highlight.add(+i.id); i.admin_seen=1; });
    unread=0; renderBadge();
    post({all:true},true);
  }
  function openPanel(){
    highlight.clear(); place(); panel.classList.add('open'); markAllSeen(); renderList();
    if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  }

  function renderList(){
    [...selected].forEach(id=>{ if(!items.some(i=>+i.id===id)) selected.delete(id); });
    const n=selected.size, allChecked=items.length>0 && n===items.length;
    panel.innerHTML=
      `<div class="nf-head"><span>Pesan Masuk${highlight.size?` (${highlight.size} baru)`:''}</span><span><button id="nfSnd" title="Tes suara notifikasi">🔊</button> <button id="nfAll">Tandai semua dibaca</button></span></div>`+
      (items.length?`<div class="nf-tools"><label class="nf-selall"><input type="checkbox" id="nfSelAll" ${allChecked?'checked':''}> ${n?`${n} dipilih`:'Pilih semua'}</label>${n?`<button id="nfReadSel">✓ Tandai dibaca</button><button id="nfDelSel" class="danger">🗑 Hapus</button>`:''}</div>`:'')+
      (items.length?items.map(i=>`<div class="nf-item ${(+i.admin_seen && !highlight.has(+i.id))?'':'unread'}" data-id="${i.id}"><input type="checkbox" class="nf-chk" data-id="${i.id}" ${selected.has(+i.id)?'checked':''} aria-label="Pilih pesan"><div class="nf-av">${esc((i.parent_name||'?')[0].toUpperCase())}</div><div class="nf-body"><div class="nf-row"><span class="nf-from">${esc(i.parent_name)}</span><span class="nf-time">${ago(i._born)}</span></div><div class="nf-sub">Reservasi baru: ${esc(i.service_name||'-')}</div><div class="nf-prev">${esc(i.baby_name)} • ${esc(i.booking_date)} ${esc(i.booking_time)}</div></div></div>`).join('')
        :'<div class="nf-empty">Belum ada pesan masuk.</div>');

    panel.querySelector('#nfSnd').onclick=beep;
    panel.querySelector('#nfAll').onclick=async()=>{ highlight.clear(); if(await post({all:true})) await load(); else renderList(); };
    const sa=panel.querySelector('#nfSelAll');
    if(sa) sa.onchange=()=>{ selected.clear(); if(sa.checked) items.forEach(i=>selected.add(+i.id)); renderList(); };
    panel.querySelectorAll('.nf-chk').forEach(c=>{
      c.onclick=e=>e.stopPropagation();
      c.onchange=()=>{ c.checked?selected.add(+c.dataset.id):selected.delete(+c.dataset.id); renderList(); };
    });
    const rs=panel.querySelector('#nfReadSel');
    if(rs) rs.onclick=async()=>{ if(await post({action:'read',ids:[...selected]})){ selected.clear(); await load(); } };
    const ds=panel.querySelector('#nfDelSel');
    if(ds) ds.onclick=async()=>{
      if(!confirm(`Hapus ${selected.size} notifikasi dari kotak masuk?\n\nData reservasinya TIDAK ikut terhapus dan tetap ada di daftar Reservasi.`)) return;
      if(await post({action:'hide',ids:[...selected]})){ selected.clear(); await load(); }
    };
    panel.querySelectorAll('.nf-item').forEach(el=>el.onclick=()=>openBooking(+el.dataset.id));
  }

  // Klik notifikasi: tandai dibaca, tutup kotak masuk, lalu gulir ke kartu reservasinya
  async function openBooking(id){
    const i=items.find(x=>+x.id===id);
    if(i && !+i.admin_seen){ i.admin_seen=1; unread=Math.max(0,unread-1); renderBadge(); post({ids:[id]}); }
    panel.classList.remove('open');
    const tab=document.querySelector('.subtabs button[data-sub="bookings"]'); if(tab) tab.click();
    const fs=document.getElementById('filterStatus'), fd=document.getElementById('filterDate');
    if(fs) fs.value='all'; if(fd) fd.value='';
    if(typeof renderBookingList==='function') await renderBookingList();
    const card=document.querySelector(`.booking-item[data-booking-id="${id}"]`);
    if(card){ card.scrollIntoView({behavior:'smooth',block:'center'}); card.classList.add('nf-flash'); setTimeout(()=>card.classList.remove('nf-flash'),3500); }
    else { alert('Reservasi ini tidak ditemukan di daftar. Mungkin sudah dihapus.'); }
  }


  /* ---------- Pop-up reservasi baru ---------- */
  const toasts=document.createElement('div'); toasts.id='nfToasts'; document.body.appendChild(toasts);
  function addToast(html,onMain,mainLabel){
    const t=document.createElement('div'); t.className='nf-toast';
    t.innerHTML=`<button class="nf-x" aria-label="Tutup">×</button>${html}<div class="nf-tact"><button class="nf-go">${mainLabel}</button><button class="nf-later">Nanti</button></div>`;
    t.querySelector('.nf-x').onclick=t.querySelector('.nf-later').onclick=()=>t.remove();
    t.querySelector('.nf-go').onclick=()=>{ t.remove(); onMain(); };
    toasts.appendChild(t);
    while(toasts.children.length>4) toasts.firstChild.remove();
  }
  function showToast(i){
    addToast(`<div class="nf-ttl">🔔 Reservasi baru</div><div class="nf-tbody"><b>${esc(i.parent_name)}</b> memesan <b>${esc(i.service_name||'-')}</b><br>${esc(i.baby_name)} • ${esc(i.booking_date)} ${esc(i.booking_time)}</div>`,
      ()=>openBooking(+i.id),'Lihat reservasi');
  }
  function summaryToast(text){
    addToast(`<div class="nf-ttl">🔔 Pesan masuk</div><div class="nf-tbody">${esc(text)}</div>`,
      openPanel,'Buka kotak masuk');
  }

  async function load(){
    try{
      const r=await fetch(API,{cache:'no-store'}); const d=await r.json(); if(d.error) return;
      const t0=Date.now(); items=d.items; unread=d.unread;
      items.forEach(i=>{ i._born=t0-(+i.age_seconds)*1000; });
      // Deteksi reservasi baru berdasarkan id (lebih akurat daripada membandingkan jumlah)
      const first=knownUnread===null;
      const fresh=items.filter(i=>!seenIds.has(+i.id) && !+i.admin_seen);
      items.forEach(i=>seenIds.add(+i.id));
      if(first){
        let shown=false; try{ shown=sessionStorage.getItem('nfSum')==='1'; }catch(e){}
        if(unread>0 && !shown){ summaryToast(`Ada ${unread} reservasi belum dibaca`); try{ sessionStorage.setItem('nfSum','1'); }catch(e){} }
      } else if(fresh.length){
        bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring'); beep();
        fresh.slice(0,3).forEach(showToast);
        if(fresh.length>3) summaryToast(`+${fresh.length-3} reservasi baru lainnya`);
        const n=fresh[0];
        if('Notification' in window && Notification.permission==='granted')
          new Notification('Reservasi baru 🔔',{body:`${n.parent_name} — ${n.service_name||''} ${n.booking_date} ${n.booking_time}`});
        if(typeof renderBookingList==='function') renderBookingList();
      }
      knownUnread=unread; renderBadge();
      if(panel.classList.contains('open')){ markAllSeen(); renderList(); }
    }catch(e){}
  }

  bell.onclick=e=>{ e.stopPropagation(); if(panel.classList.contains('open')) panel.classList.remove('open'); else openPanel(); };
  // composedPath dipakai karena isi panel di-render ulang saat diklik
  document.addEventListener('click',e=>{ const p=e.composedPath(); if(!p.includes(wrap)&&!p.includes(panel)) panel.classList.remove('open'); });

  setInterval(()=>{ const c=document.getElementById('adminContent'); if(c && c.style.display!=='none'){ started=true; load(); } },POLL);
  const t=setInterval(()=>{ const c=document.getElementById('adminContent'); if(c&&c.style.display!=='none'){ clearInterval(t); if(!started){started=true; load();} } },1000);
})();
