const CONFIG=window.APP_CONFIG||{};
const sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
const APP_URL='https://frano-web.github.io/Tanko/';
const RESET_URL=APP_URL+'reset-password.html';
const JAROCIN={lat:51.9727,lng:17.5026};
const $=id=>document.getElementById(id);
const FUEL_LABEL={pb95:'PB95',pb98:'PB98',on:'ON',lpg:'LPG'};
const state={user:null,profile:null,cars:[],activeCarId:null,fuel:localStorage.getItem('tanko_fuel')||'pb95',liters:Number(localStorage.getItem('tanko_liters')||45),location:null,stations:[],favorites:new Map(),ranking:[],map:null,markers:[],deferredInstall:null,authMode:'login',photoFile:null,ocrSource:'photo',selectedStation:null,selectedFavoriteStation:null,chart:null,onboardingIndex:0,adminStatus:'new',realtime:null,stationPickerMap:null,stationPickerMarker:null,theme:localStorage.getItem('tanko_theme')||'system'};
let audioCtx=null;

function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2600)}
function savePrefs(){localStorage.setItem('tanko_fuel',state.fuel);localStorage.setItem('tanko_liters',state.liters)}
function fuelLabel(v){return FUEL_LABEL[v]||String(v).toUpperCase()}
function fmt(v){return v==null||!isFinite(Number(v))?'—':Number(v).toFixed(2).replace('.',',')}
function activeCar(){return state.cars.find(c=>String(c.id)===String(state.activeCarId))||state.cars.find(c=>c.is_active)||state.cars[0]||null}
function ageHours(ts){return ts?(Date.now()-new Date(ts).getTime())/36e5:Infinity}
function humanAge(ts){if(!ts)return'brak aktualnej ceny';const m=Math.max(0,Math.round((Date.now()-new Date(ts))/60000));if(m<60)return`${m} min temu`;const h=Math.round(m/60);if(h<48)return`${h} godz. temu`;return`${Math.round(h/24)} dni temu`}
function hav(a,b){const R=6371,d1=(b.lat-a.lat)*Math.PI/180,d2=(b.lng-a.lng)*Math.PI/180,l1=a.lat*Math.PI/180,l2=b.lat*Math.PI/180;const q=Math.sin(d1/2)**2+Math.cos(l1)*Math.cos(l2)*Math.sin(d2/2)**2;return 2*R*Math.asin(Math.sqrt(q))}
function stationDistance(s){return hav(state.location||JAROCIN,{lat:s.lat,lng:s.lng})}
function confidence(s){const h=ageHours(s.updatedAt);let score=0;if(h<3)score+=55;else if(h<24)score+=42;else if(h<72)score+=25;else score+=7;if(s.priceSource==='photo')score+=25;else if(s.priceSource==='partner')score+=30;else if(s.priceSource==='confirmation')score+=15;else score+=8;score+=Math.min(20,(s.confirmations||0)*5);if(score>=75)return{label:'wysoka',cls:'high',score};if(score>=45)return{label:'średnia',cls:'mid',score};return{label:'niska',cls:'low',score}}
function playSound(type='tap'){if(!state.profile?.sounds_enabled)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);const map={tap:[420,.045],success:[690,.10],coin:[880,.16],error:[180,.12]};const [f,d]=map[type]||map.tap;o.frequency.setValueAtTime(f,audioCtx.currentTime);if(type==='coin')o.frequency.exponentialRampToValueAtTime(1220,audioCtx.currentTime+d);g.gain.setValueAtTime(.06,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);o.start();o.stop(audioCtx.currentTime+d)}catch(e){}}
function awardAnimation(delta){if(delta<=0)return;const b=$('pointsBurst');b.querySelector('span').textContent=`+${delta}`;b.classList.remove('hidden');b.style.animation='none';void b.offsetWidth;b.style.animation='burst .9s ease';playSound('coin');navigator.vibrate?.(30);setTimeout(()=>b.classList.add('hidden'),900)}

function resolvedTheme(pref=state.theme){if(pref==='system')return 

// Tanko 1.1.1 UI safety helpers
if (typeof window.renderOnboarding !== 'function') {
  window.renderOnboarding = function(){
    const slidesArr = Array.from(document.querySelectorAll('#onboardingDialog .slide'));
    slidesArr.forEach((s,i)=>s.classList.toggle('hidden',i!==state.onboardingIndex));
    document.querySelectorAll('#onboardingDialog .dots i').forEach((d,i)=>d.classList.toggle('active',i===state.onboardingIndex));
    const next=$('onboardingNext'); if(next) next.textContent=state.onboardingIndex>=slidesArr.length-1?'Zaczynamy':'Dalej';
  };
}
if (typeof window.showOnboarding !== 'function') {
  window.showOnboarding = function(force=false){
    if(!force && (state.profile?.onboarding_completed || localStorage.getItem('tanko_onboarding_completed')==='1')) return;
    state.onboardingIndex=0; window.renderOnboarding();
    const dlg=$('onboardingDialog'); if(dlg && !dlg.open) dlg.showModal();
  };
}
if (typeof window.finishOnboarding !== 'function') {
  window.finishOnboarding = function(){
    const dlg=$('onboardingDialog'); if(dlg?.open) dlg.close();
    localStorage.setItem('tanko_onboarding_completed','1');
    if(state.profile){state.profile.onboarding_completed=true; renderProfile();}
    if(state.user) sb.from('profiles').update({onboarding_completed:true}).eq('id',state.user.id).then(()=>{}).catch(()=>{});
  };
}

const profileSettings = document.querySelector('#profileScreen .settings-card');
if(profileSettings){
  profileSettings.addEventListener('click', async (e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    e.stopPropagation();
    const id=btn.id;
    if(id==='changeNickname'){ $('nicknameInput').value=state.profile?.nickname||''; if(!$('nicknameDialog').open)$('nicknameDialog').showModal(); }
    else if(id==='changePassword'){ $('changePasswordForm').reset(); if(!$('changePasswordDialog').open)$('changePasswordDialog').showModal(); }
    else if(id==='themeButton'){ if(!$('themeDialog').open)$('themeDialog').showModal(); applyTheme(state.theme); }
    else if(id==='infoCorner'){ if(!$('infoDialog').open)$('infoDialog').showModal(); }
    else if(id==='showTutorial'){ window.showOnboarding(true); }
  }, {capture:false});
}

window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';return pref}
function applyTheme(pref=state.theme){state.theme=pref||'system';localStorage.setItem('tanko_theme',state.theme);document.documentElement.dataset.theme=resolvedTheme(state.theme);const label={system:'System',light:'Jasny',dark:'Ciemny'}[state.theme]||'System';if($('themeState'))$('themeState').textContent=label;document.querySelectorAll('.theme-option').forEach(b=>b.classList.toggle('active',b.dataset.theme===state.theme))}
function resetPhotoFlow(){state.photoFile=null;state.ocrSource='photo';$('pylonPhoto').value='';$('ocrPanel').classList.add('hidden');$('photoPreview').classList.add('hidden');$('photoPreview').removeAttribute('src');$('ocrStatus').classList.add('hidden');$('ocrRawWrap').classList.add('hidden');$('ocrRawText').textContent='';$('ocrFields').innerHTML=''}

function normalizeStation(r){return{id:r.id,name:r.name,address:r.address||'',lat:Number(r.latitude),lng:Number(r.longitude),brand:r.brand||'',externalId:r.external_id||'',photo:r.photo_url||'',prices:{pb95:r.pb95==null?null:Number(r.pb95),pb98:r.pb98==null?null:Number(r.pb98),on:r.on_price==null?null:Number(r.on_price),lpg:r.lpg==null?null:Number(r.lpg)},updatedAt:r.price_updated_at,latestReportId:r.latest_report_id,priceSource:r.price_source,confirmations:Number(r.confirmations||0)}}
function calcStations(){const pos=state.location||JAROCIN,car=activeCar();const rows=state.stations.filter(s=>Number(s.prices[state.fuel])>0).map(s=>{const distance=hav(pos,{lat:s.lat,lng:s.lng}),price=Number(s.prices[state.fuel]),travel=car?distance*2*Number(car.consumption)/100*price:0;return{...s,distance,price,travel,conf:confidence(s)}});const nearest=[...rows].sort((a,b)=>a.distance-b.distance)[0];const baseline=nearest?nearest.price*state.liters:0;return rows.map(s=>{const total=s.price*state.liters+s.travel,saving=baseline-total;return{...s,total,saving,rankScore:total+(100-s.conf.score)*.006}}).sort((a,b)=>a.rankScore-b.rankScore)}

function renderHome(){document.querySelectorAll('.fuel').forEach(b=>b.classList.toggle('active',b.dataset.fuel===state.fuel));$('litersValue').textContent=state.liters;$('pointsValue').textContent=state.profile?.points||0;const car=activeCar();$('carSwitcherText').textContent=car?`${car.name}${car.engine?' · '+car.engine:''}`:'Dodaj samochód';const ranked=calcStations(),best=ranked[0];if(!best){$('bestStationName').textContent='Brak aktualnych cen';$('bestPrice').textContent='—';$('bestDistance').textContent='—';$('bestSaving').textContent='—';$('bestConfidence').textContent='—';$('worthBadge').textContent='Na mapie zobaczysz stacje. Dodaj pierwszą aktualną cenę, aby uruchomić ranking.';$('topStations').innerHTML='<div class="empty-card">Brak aktualnych cen dla wybranego paliwa.</div>';$('bestFavorite').classList.remove('active');$('favoritePreview').innerHTML=renderFavoriteMini();return}
state.selectedStation=best;$('bestStationName').textContent=best.name;$('bestPrice').textContent=fmt(best.price);$('bestDistance').textContent=`${best.distance.toFixed(1).replace('.',',')} km`;$('bestSaving').textContent=best.saving>0?`${best.saving.toFixed(2).replace('.',',')} zł`:'0,00 zł';$('bestConfidence').textContent=best.conf.label;$('bestFavorite').classList.toggle('active',state.favorites.has(String(best.id)));$('bestFavorite').textContent=state.favorites.has(String(best.id))?'★':'☆';const w=$('worthBadge');if(!car){w.className='worth neutral';w.textContent='Dodaj samochód, aby uwzględnić koszt dojazdu.'}else if(best.saving>5){w.className='worth good';w.textContent=`Warto jechać — realna oszczędność ok. ${best.saving.toFixed(2).replace('.',',')} zł.`}else if(best.saving>1){w.className='worth ok';w.textContent='Oszczędność jest niewielka, ale nadal dodatnia.'}else{w.className='worth bad';w.textContent='Nie warto nadrabiać drogi tylko dla tej ceny.'}
$('topStations').innerHTML=ranked.slice(0,3).map((s,i)=>`<button class="station-card open-station" data-id="${s.id}"><div class="station-rank">${i+1}</div><div class="station-main"><strong>${esc(s.name)}</strong><span>${s.distance.toFixed(1).replace('.',',')} km · ${humanAge(s.updatedAt)}</span><span><i class="confidence-dot confidence-${s.conf.cls}"></i>${s.conf.label} wiarygodność</span></div><div class="station-price"><strong>${fmt(s.price)}</strong><span>zł/l</span></div></button>`).join('');$('favoritePreview').innerHTML=renderFavoriteMini()}
function renderFavoriteMini(){const favs=[...state.favorites.values()].map(f=>state.stations.find(s=>String(s.id)===String(f.station_id))).filter(Boolean);if(!favs.length)return'<div class="empty-card" style="min-width:100%">Dodaj gwiazdką stacje, do których często wracasz.</div>';return favs.slice(0,6).map(s=>`<button class="favorite-mini open-station" data-id="${s.id}"><strong>★ ${esc(s.name)}</strong><span>${esc(s.address||'')}</span><b>${fmt(s.prices[state.fuel])} <small>zł/l</small></b></button>`).join('')}
function renderCars(){const car=activeCar();$('carsList').innerHTML=state.cars.length?state.cars.map(c=>`<div class="car-row ${String(car?.id)===String(c.id)?'active-car':''}"><div class="car-icon">🚗</div><div class="car-copy"><strong>${esc(c.name)}</strong><span>${esc(c.engine||'')} · ${fuelLabel(c.fuel)} · ${Number(c.consumption).toFixed(1)} l/100 km</span></div><div class="car-actions"><button class="choose-car" data-id="${c.id}">${String(car?.id)===String(c.id)?'Aktywne':'Wybierz'}</button><button class="remove-car" data-id="${c.id}">Usuń</button></div></div>`).join(''):'<div class="empty-card">Dodaj pierwszy samochód. Zostanie zapisany na koncie i będzie dostępny po każdym logowaniu.</div>';$('carPickerList').innerHTML=state.cars.map(c=>`<button class="car-row pick-car" data-id="${c.id}"><div class="car-icon">🚗</div><div class="car-copy"><strong>${esc(c.name)}</strong><span>${esc(c.engine||'')} · ${Number(c.consumption).toFixed(1)} l/100 km</span></div><span>›</span></button>`).join('')||'<div class="empty-card">Brak samochodów.</div>'}
function renderFavoritesProfile(){const arr=[...state.favorites.values()];$('profileFavorites').innerHTML=arr.length?arr.map(f=>{const s=state.stations.find(x=>String(x.id)===String(f.station_id));if(!s)return'';return`<div class="favorite-row"><div class="favorite-copy"><strong>★ ${esc(s.name)}</strong><span>${esc(s.address)} · ${f.notify_new_price?'powiadomienia włączone':'powiadomienia wyłączone'}</span></div><div class="favorite-actions"><button class="fav-notify" data-id="${s.id}">${f.notify_new_price?'🔔':'🔕'}</button><button class="fav-open" data-id="${s.id}">›</button></div></div>`}).join(''):'<div class="empty-card">Nie masz jeszcze ulubionych stacji.</div>'}
function renderRanking(){const me=state.ranking.findIndex(x=>x.id===state.user?.id);$('myRankCard').innerHTML=`<span>Twoja pozycja</span><strong>${me>=0?'#'+(me+1):'—'}</strong><span> · ${state.profile?.points||0} pkt · reputacja ${Number(state.profile?.reputation||1).toFixed(2)}</span>`;$('rankingList').innerHTML=state.ranking.length?state.ranking.map((u,i)=>`<div class="rank-row"><div class="rank-pos">${i<3?['🥇','🥈','🥉'][i]:i+1}</div><div class="rank-avatar">${esc((u.nickname||'?')[0].toUpperCase())}</div><div class="rank-user"><strong>${esc(u.nickname||'Użytkownik')}</strong><span>reputacja ${Number(u.reputation||1).toFixed(2)}</span></div><div class="rank-points">${Number(u.points||0)} pkt</div></div>`).join(''):'<div class="empty-card">Ranking jest pusty.</div>'}
function renderProfile(){$('profileNickname').textContent=state.profile?.nickname||'Użytkownik';$('profileEmail').textContent=state.user?.email||'—';$('profileAvatar').textContent=(state.profile?.nickname||state.user?.email||'T')[0].toUpperCase();$('profileReputation').textContent=`Reputacja ${Number(state.profile?.reputation||1).toFixed(2)}`;$('nicknameState').textContent=state.profile?.nickname||'›';$('soundState').textContent=state.profile?.sounds_enabled?'włączone':'wyłączone';$('locationStatus').textContent=state.location?'włączona':'wyłączona';$('adminEntry').classList.toggle('hidden',state.profile?.role!=='admin');applyTheme(state.profile?.theme||state.theme);renderCars();renderFavoritesProfile()}
function renderAll(){renderHome();renderProfile();renderRanking();if(state.map)renderMap()}

async function loadProfile(){const hadProfile=!!state.profile,old=state.profile?.points||0;const {data,error}=await sb.from('profiles').select('*').eq('id',state.user.id).single();if(error)return console.warn(error);state.profile=data;state.theme=data.theme||state.theme||'system';applyTheme(state.theme);if(hadProfile&&Number(data.points)>Number(old))awardAnimation(Number(data.points)-Number(old));renderAll()}
async function loadCars(){const {data,error}=await sb.from('cars').select('*').eq('user_id',state.user.id).order('created_at');if(error)return toast('Nie udało się wczytać samochodów.');state.cars=(data||[]).map(c=>({id:c.id,name:c.name,engine:c.engine,fuel:c.fuel_type,consumption:Number(c.consumption),is_active:c.is_active}));state.activeCarId=state.cars.find(c=>c.is_active)?.id||state.cars[0]?.id||null;if(activeCar())state.fuel=activeCar().fuel;savePrefs();renderAll()}
async function loadFavorites(){const {data,error}=await sb.from('favorite_stations').select('*').eq('user_id',state.user.id);if(error)return console.warn(error);state.favorites=new Map((data||[]).map(x=>[String(x.station_id),x]));renderAll()}
async function loadRanking(){const {data,error}=await sb.from('profiles').select('id,nickname,points,reputation').order('points',{ascending:false}).limit(100);if(!error){state.ranking=data||[];renderRanking()}}
async function loadStations(){const {data,error}=await sb.from('stations_with_latest_prices').select('*').limit(3000);if(error)return console.warn(error);state.stations=(data||[]).map(normalizeStation);fillStationSelect();renderAll()}
function fillStationSelect(){const sel=$('reportStation');if(!sel)return;const arr=[...state.stations].sort((a,b)=>stationDistance(a)-stationDistance(b));sel.innerHTML=arr.map(s=>`<option value="${s.id}">${esc(s.name)}${s.address?' — '+esc(s.address):''}</option>`).join('')}

async function syncNearbyOSM(center=state.location||JAROCIN,radius=30000){$('mapStatus').textContent='Pobieranie stacji z OpenStreetMap…';const q=`[out:json][timeout:25];(node[\"amenity\"=\"fuel\"](around:${Math.min(radius,30000)},${center.lat},${center.lng});way[\"amenity\"=\"fuel\"](around:${Math.min(radius,30000)},${center.lat},${center.lng}););out center tags;`;try{const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});const json=await res.json();const existing=new Set(state.stations.map(s=>s.externalId).filter(Boolean));const rows=json.elements.map(e=>({external_id:`osm:${e.type}:${e.id}`,name:e.tags?.brand||e.tags?.name||'Stacja paliw',brand:e.tags?.brand||null,address:[e.tags?.['addr:street'],e.tags?.['addr:housenumber'],e.tags?.['addr:city']].filter(Boolean).join(' ')||null,latitude:e.lat??e.center?.lat,longitude:e.lon??e.center?.lon,source:'osm'})).filter(x=>x.latitude&&x.longitude&&!existing.has(x.external_id));if(rows.length){const {error}=await sb.from('stations').insert(rows.slice(0,400));if(error&&!String(error.message).includes('duplicate'))console.warn(error)}await loadStations();$('mapStatus').textContent=`${state.stations.length} stacji w bazie`}catch(e){console.warn(e);$('mapStatus').textContent='Nie udało się odświeżyć stacji z OSM.'}}

function initMap(){if(state.map)return;state.map=L.map('map',{zoomControl:false}).setView([JAROCIN.lat,JAROCIN.lng],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map);L.control.zoom({position:'bottomleft'}).addTo(state.map);renderMap()}
function renderMap(){if(!state.map)return;state.markers.forEach(m=>m.remove());state.markers=[];for(const s of state.stations){const p=s.prices[state.fuel],conf=confidence(s),color=p?(conf.cls==='high'?'#0f8f5b':conf.cls==='mid'?'#d39a16':'#b54444'):'#64748b';const html=`<div class="map-price-pin" style="--pin:${color}">${p?fmt(p):'—'}</div>`;const icon=L.divIcon({className:'',html,iconSize:[52,32],iconAnchor:[26,16]});const m=L.marker([s.lat,s.lng],{icon}).addTo(state.map);m.bindPopup(`<div class="map-popup"><b>${esc(s.name)}</b><small>${esc(s.address||'')}</small><strong>${p?fmt(p)+' zł/l · '+humanAge(s.updatedAt):'Brak ceny '+fuelLabel(state.fuel)}</strong><div class="popup-actions"><button class="popup-open" data-open="${s.id}">Szczegóły</button>${p?`<button class="popup-confirm" data-confirm="${s.id}">Potwierdź</button>`:''}</div></div>`);state.markers.push(m)}if(state.location){L.circleMarker([state.location.lat,state.location.lng],{radius:7,color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1}).addTo(state.map)}}

async function requestLocation(){if(!navigator.geolocation)return toast('Ta przeglądarka nie obsługuje lokalizacji.');navigator.geolocation.getCurrentPosition(async p=>{state.location={lat:p.coords.latitude,lng:p.coords.longitude};$('locationBanner').classList.add('hidden');if(state.map)state.map.setView([state.location.lat,state.location.lng],13);renderAll();await syncNearbyOSM(state.location)},()=>toast('Nie udało się uzyskać lokalizacji.'),{enableHighAccuracy:true,timeout:12000,maximumAge:60000})}

async function addCar(){const row={user_id:state.user.id,name:$('carName').value.trim(),engine:$('carEngine').value.trim()||null,fuel_type:$('carFuel').value,consumption:Number($('carConsumption').value),is_active:true};await sb.from('cars').update({is_active:false}).eq('user_id',state.user.id);const {error}=await sb.from('cars').insert(row);if(error)return toast(error.message);playSound('success');await loadCars();$('carForm').reset();$('carDialog').close()}
async function setActiveCar(id){await sb.from('cars').update({is_active:false}).eq('user_id',state.user.id);const {error}=await sb.from('cars').update({is_active:true}).eq('id',id).eq('user_id',state.user.id);if(error)return toast(error.message);$('carPickerDialog').close();playSound('tap');await loadCars()}
async function deleteCar(id){if(!confirm('Usunąć ten samochód?'))return;await sb.from('cars').delete().eq('id',id).eq('user_id',state.user.id);await loadCars()}

async function toggleFavorite(station,forceNotify=null){if(!station)return;const key=String(station.id),current=state.favorites.get(key);if(current){await sb.from('favorite_stations').delete().eq('user_id',state.user.id).eq('station_id',station.id);state.favorites.delete(key);toast('Usunięto z ulubionych.');renderAll();return}const row={user_id:state.user.id,station_id:station.id,notify_new_price:false,last_seen_price_report_id:station.latestReportId||null};const {data,error}=await sb.from('favorite_stations').insert(row).select().single();if(error)return toast(error.message);state.favorites.set(key,data);state.selectedFavoriteStation=station;renderAll();playSound('success');if(forceNotify===true)return setFavoriteNotify(station.id,true);$('favoriteNotifyDialog').showModal()}
async function setFavoriteNotify(stationId,on){if(on&&'Notification'in window&&Notification.permission==='default'){const perm=await Notification.requestPermission();if(perm!=='granted'){toast('Powiadomienia nie zostały włączone.');on=false}}const {error}=await sb.from('favorite_stations').update({notify_new_price:on}).eq('user_id',state.user.id).eq('station_id',stationId);if(error)return toast(error.message);const f=state.favorites.get(String(stationId));if(f)f.notify_new_price=on;$('favoriteNotifyDialog').close();renderAll();toast(on?'Powiadomienia włączone.':'Powiadomienia wyłączone.')}

async function openStationDetails(id){const s=state.stations.find(x=>String(x.id)===String(id));if(!s)return;state.selectedStation=s;$('detailsName').textContent=s.name;await sb.from('recent_stations').upsert({user_id:state.user.id,station_id:s.id,last_opened_at:new Date().toISOString()});const c=confidence(s);$('detailsBody').innerHTML=`<div class="details-meta"><div><span>${fuelLabel(state.fuel)}</span><strong>${fmt(s.prices[state.fuel])} zł/l</strong></div><div><span>AKTUALIZACJA</span><strong>${humanAge(s.updatedAt)}</strong></div><div><span>WIARYGODNOŚĆ</span><strong>${c.label}</strong></div></div><p class="history-note">${esc(s.address||'Brak adresu')} · źródło ceny: ${esc(s.priceSource||'brak')}</p>`;$('detailsFavorite').textContent=state.favorites.has(String(s.id))?'★ Usuń z ulubionych':'☆ Dodaj do ulubionych';$('stationDetailsDialog').showModal();await loadPriceHistory(s.id)}
async function loadPriceHistory(stationId){const since=new Date(Date.now()-30*864e5).toISOString();const {data}=await sb.from('price_reports').select('prices,created_at').eq('station_id',stationId).gte('created_at',since).order('created_at');const pts=(data||[]).map(x=>({x:new Date(x.created_at).getTime(),y:Number(x.prices?.[state.fuel])})).filter(x=>x.y>0);if(state.chart)state.chart.destroy();const ctx=$('priceChart');state.chart=new Chart(ctx,{type:'line',data:{datasets:[{label:fuelLabel(state.fuel),data:pts,borderColor:'#0f8f5b',backgroundColor:'rgba(15,143,91,.08)',fill:true,tension:.3,pointRadius:2}]},options:{parsing:false,responsive:true,plugins:{legend:{display:false}},scales:{x:{type:'linear',ticks:{callback:v=>new Date(v).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'}),maxTicksLimit:5}},y:{ticks:{callback:v=>Number(v).toFixed(2)}}}}})}

async function confirmPrice(id){const s=state.stations.find(x=>String(x.id)===String(id));if(!s)return;if(!state.location)return toast('Włącz GPS. Cenę można potwierdzić tylko będąc przy stacji.');const d=hav(state.location,{lat:s.lat,lng:s.lng});if(d>0.5)return toast(`Jesteś za daleko od stacji (${d.toFixed(1).replace('.',',')} km). Podejdź bliżej, aby potwierdzić cenę.`);const prices={};for(const f of Object.keys(FUEL_LABEL))if(Number(s.prices[f])>0)prices[f]=Number(s.prices[f]);const {error}=await sb.from('price_reports').insert({station_id:s.id,user_id:state.user.id,prices,latitude:state.location.lat,longitude:state.location.lng,source:'confirmation'});if(error)return toast(error.message);toast('Cena potwierdzona. +2 pkt');playSound('success');await Promise.all([loadStations(),loadProfile(),loadRanking()])}


function navigateToStation(s){if(!s)return;window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,'_blank')}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));if(id==='mapScreen'){setTimeout(()=>{initMap();state.map.invalidateSize()},60)}playSound('tap')}

async function setupRealtime(){if(state.realtime)sb.removeChannel(state.realtime);state.realtime=sb.channel('tanko-live').on('postgres_changes',{event:'INSERT',schema:'public',table:'price_reports'},async payload=>{const fav=state.favorites.get(String(payload.new.station_id));if(!fav)return;await loadStations();if(fav.notify_new_price){const s=state.stations.find(x=>String(x.id)===String(payload.new.station_id));const msg=`Nowa cena na ${s?.name||'ulubionej stacji'}`;toast(msg);if('Notification'in window&&Notification.permission==='granted'&&document.hidden)new Notification('Tanko',{body:msg,icon:'./icon-192.png'})}}).subscribe()}

function setupBusinessContact(){const email=String(CONFIG.BUSINESS_EMAIL||'').trim();const link=$('businessEmailLink'),txt=$('businessContactText');if(email){txt.textContent=`E-mail do współpracy: ${email}`;link.href=`mailto:${email}?subject=Tanko%20-%20współpraca`;link.classList.remove('hidden')}else{txt.textContent='Adres do współpracy można ustawić w config.js (BUSINESS_EMAIL).';link.classList.add('hidden')}}
async function bootUser(user){setupBusinessContact();state.user=user;$('authView').classList.add('hidden');$('appView').classList.remove('hidden');await Promise.all([loadProfile(),loadCars(),loadStations(),loadFavorites(),loadRanking()]);await setupRealtime();renderAll();setTimeout(()=>showOnboarding(false),250);if(navigator.geolocation)requestLocation()}
async function handleAuth(){const {data:{session}}=await sb.auth.getSession();if(session?.user)return bootUser(session.user);$('authView').classList.remove('hidden');$('appView').classList.add('hidden')}

// EVENTS
document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{state.authMode=b.dataset.auth;document.querySelectorAll('[data-auth]').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').textContent=state.authMode==='login'?'Zaloguj się':'Załóż konto';$('authPassword').autocomplete=state.authMode==='login'?'current-password':'new-password'});
$('authForm').onsubmit=async e=>{e.preventDefault();const email=$('authEmail').value.trim(),password=$('authPassword').value;if(state.authMode==='login'){const {error}=await sb.auth.signInWithPassword({email,password});if(error)return toast(error.message);const {data:{user}}=await sb.auth.getUser();if(user)bootUser(user)}else{const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:APP_URL}});if(error)return toast(error.message);toast(data.session?'Konto utworzone.':'Sprawdź e-mail i potwierdź konto przez link.')}};
$('forgotPassword').onclick=()=>{$('resetEmail').value=$('authEmail').value;$('resetDialog').showModal()};$('closeReset').onclick=()=>$('resetDialog').close();$('resetRequestForm').onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.resetPasswordForEmail($('resetEmail').value.trim(),{redirectTo:RESET_URL});if(error)return toast(error.message);$('resetDialog').close();toast('Link do zmiany hasła został wysłany.')};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
$('enableLocation').onclick=requestLocation;$('changeLocation').onclick=requestLocation;
$('carSwitcher').onclick=()=>state.cars.length?$('carPickerDialog').showModal():$('carDialog').showModal();$('addCarBtn').onclick=()=>$('carDialog').showModal();$('closeCar').onclick=()=>$('carDialog').close();$('closeCarPicker').onclick=()=>$('carPickerDialog').close();$('carForm').onsubmit=e=>{e.preventDefault();addCar()};
document.addEventListener('click',e=>{const c=e.target.closest('.choose-car,.pick-car');if(c)setActiveCar(c.dataset.id);const d=e.target.closest('.remove-car');if(d)deleteCar(d.dataset.id);const os=e.target.closest('.open-station,.fav-open');if(os)openStationDetails(os.dataset.id);const po=e.target.closest('[data-open]');if(po)openStationDetails(po.dataset.open);const pc=e.target.closest('[data-confirm]');if(pc)confirmPrice(pc.dataset.confirm);const fn=e.target.closest('.fav-notify');if(fn){const f=state.favorites.get(String(fn.dataset.id));setFavoriteNotify(fn.dataset.id,!f?.notify_new_price)}const rr=e.target.closest('[data-report][data-action]');if(rr)updateAdminReport(rr.dataset.report,rr.dataset.action);const rn=e.target.closest('.route-nav');if(rn){const s=state.stations.find(x=>String(x.id)===String(rn.dataset.id));navigateToStation(s)}const ds=e.target.closest('[data-delete-station]');if(ds)deleteStationAdmin(ds.dataset.deleteStation)});
document.querySelectorAll('.fuel').forEach(b=>b.onclick=()=>{state.fuel=b.dataset.fuel;savePrefs();renderAll()});$('minusLiters').onclick=()=>{state.liters=Math.max(5,state.liters-5);savePrefs();renderHome()};$('plusLiters').onclick=()=>{state.liters=Math.min(100,state.liters+5);savePrefs();renderHome()};
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));$('showAllMap').onclick=()=>showScreen('mapScreen');$('centerMap').onclick=()=>{if(state.location)state.map?.setView([state.location.lat,state.location.lng],14);else requestLocation()};
$('addStationBtn').onclick=openStationDialog;$('closeStation').onclick=()=>$('stationDialog').close();$('stationSearchAddress').onclick=findStationAddress;$('stationUseLocation').onclick=()=>{if(!state.location)return requestLocation();state.stationPickerMap?.setView([state.location.lat,state.location.lng],17);setStationPickerPoint(state.location.lat,state.location.lng)};$('stationForm').onsubmit=e=>{e.preventDefault();addManualStation()};
$('pylonPhoto').onchange=e=>{if(e.target.files?.[0])runOCR(e.target.files[0])};$('manualPriceBtn').onclick=()=>{state.ocrSource='manual';state.photoFile=null;$('ocrPanel').classList.remove('hidden');$('photoPreview').classList.add('hidden');$('ocrStatus').classList.remove('hidden');$('ocrStatus').textContent='Wpisz ceny, które widzisz na stacji.';makeOcrFields()};$('retakePhoto').onclick=()=>{resetPhotoFlow();$('pylonPhoto').click()};$('cancelPhoto').onclick=resetPhotoFlow;$('savePrices').onclick=savePrices;
$('bestFavorite').onclick=()=>toggleFavorite(state.selectedStation);$('navigateBest').onclick=()=>navigateToStation(state.selectedStation);$('openBestDetails').onclick=()=>state.selectedStation&&openStationDetails(state.selectedStation.id);$('closeStationDetails').onclick=()=>$('stationDetailsDialog').close();$('detailsFavorite').onclick=()=>toggleFavorite(state.selectedStation);$('detailsNavigate').onclick=()=>navigateToStation(state.selectedStation);$('detailsReport').onclick=()=>{$('stationDetailsDialog').close();$('reportDialog').showModal()};$('closeReport').onclick=()=>$('reportDialog').close();$('reportForm').onsubmit=e=>{e.preventDefault();submitStationReport()};
$('enableFavoriteNotify').onclick=()=>setFavoriteNotify(state.selectedFavoriteStation.id,true);$('skipFavoriteNotify').onclick=()=>$('favoriteNotifyDialog').close();
$('routeHero').onclick=$('mapRouteFab').onclick=()=>{$('routeResult').innerHTML='';$('routeDialog').showModal()};$('closeRoute').onclick=()=>$('routeDialog').close();$('calculateRoute').onclick=calculateRoute;
$('changeNickname').onclick=()=>{$('nicknameInput').value=state.profile?.nickname||'';$('nicknameDialog').showModal()};$('closeNickname').onclick=()=>$('nicknameDialog').close();$('nicknameForm').onsubmit=async e=>{e.preventDefault();const nickname=$('nicknameInput').value.trim();if(nickname.length<2)return toast('Nick musi mieć co najmniej 2 znaki.');const {error}=await sb.from('profiles').update({nickname}).eq('id',state.user.id);if(error)return toast(error.message);state.profile.nickname=nickname;$('nicknameDialog').close();renderAll();toast('Nick został zmieniony.')};
$('changePassword').onclick=()=>{$('changePasswordForm').reset();$('changePasswordDialog').showModal()};$('closeChangePassword').onclick=()=>$('changePasswordDialog').close();$('changePasswordForm').onsubmit=async e=>{e.preventDefault();const a=$('newPassword').value,b=$('newPassword2').value;if(a!==b)return toast('Hasła nie są identyczne.');const {error}=await sb.auth.updateUser({password:a});if(error)return toast(error.message);$('changePasswordDialog').close();$('changePasswordForm').reset();toast('Hasło zostało zmienione.');playSound('success')};
$('themeButton').onclick=()=>{$('themeDialog').showModal();applyTheme(state.theme)};$('closeTheme').onclick=()=>$('themeDialog').close();document.querySelectorAll('.theme-option').forEach(b=>b.onclick=async()=>{const theme=b.dataset.theme;applyTheme(theme);const {error}=await sb.from('profiles').update({theme}).eq('id',state.user.id);if(error)return toast(error.message);state.profile.theme=theme;$('themeDialog').close();toast('Wygląd został zapisany.')});
$('infoCorner').onclick=()=>$('infoDialog').showModal();$('closeInfo').onclick=()=>$('infoDialog').close();
$('soundToggle').onclick=async()=>{const next=!state.profile.sounds_enabled;await sb.from('profiles').update({sounds_enabled:next}).eq('id',state.user.id);state.profile.sounds_enabled=next;if(next)playSound('success');renderProfile()};$('showTutorial').onclick=()=>showOnboarding(true);
const skipOnboarding=$('skipOnboarding'), onboardingNext=$('onboardingNext');
skipOnboarding.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();finishOnboarding()});
onboardingNext.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(state.onboardingIndex<slides.length-1){state.onboardingIndex++;renderOnboarding();playSound('tap')}else{finishOnboarding()}});
$('onboardingDialog').addEventListener('cancel',e=>{e.preventDefault();finishOnboarding()});
$('adminEntry').onclick=async()=>{state.adminStatus='new';document.querySelectorAll('.admin-filters .seg').forEach(x=>x.classList.toggle('active',x.dataset.status==='new'));$('adminDialog').showModal();await loadAdminReports()};$('closeAdmin').onclick=()=>$('adminDialog').close();document.querySelectorAll('.admin-filters .seg').forEach(b=>b.onclick=async()=>{state.adminStatus=b.dataset.status;document.querySelectorAll('.admin-filters .seg').forEach(x=>x.classList.toggle('active',x===b));await loadAdminReports()});
$('pointsChip').onclick=()=>showScreen('rankingScreen');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('installBanner').classList.remove('hidden')});$('installBtn').onclick=async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('installBanner').classList.add('hidden')};$('installDismiss').onclick=()=>{$('installBanner').classList.add('hidden');localStorage.setItem('tanko_install_dismissed',Date.now())};
if(localStorage.getItem('tanko_install_dismissed')&&Date.now()-Number(localStorage.getItem('tanko_install_dismissed'))<7*864e5)$('installBanner').classList.add('hidden');



// Tanko 1.1.1 UI safety helpers
if (typeof window.renderOnboarding !== 'function') {
  window.renderOnboarding = function(){
    const slidesArr = Array.from(document.querySelectorAll('#onboardingDialog .slide'));
    slidesArr.forEach((s,i)=>s.classList.toggle('hidden',i!==state.onboardingIndex));
    document.querySelectorAll('#onboardingDialog .dots i').forEach((d,i)=>d.classList.toggle('active',i===state.onboardingIndex));
    const next=$('onboardingNext'); if(next) next.textContent=state.onboardingIndex>=slidesArr.length-1?'Zaczynamy':'Dalej';
  };
}
if (typeof window.showOnboarding !== 'function') {
  window.showOnboarding = function(force=false){
    if(!force && (state.profile?.onboarding_completed || localStorage.getItem('tanko_onboarding_completed')==='1')) return;
    state.onboardingIndex=0; window.renderOnboarding();
    const dlg=$('onboardingDialog'); if(dlg && !dlg.open) dlg.showModal();
  };
}
if (typeof window.finishOnboarding !== 'function') {
  window.finishOnboarding = function(){
    const dlg=$('onboardingDialog'); if(dlg?.open) dlg.close();
    localStorage.setItem('tanko_onboarding_completed','1');
    if(state.profile){state.profile.onboarding_completed=true; renderProfile();}
    if(state.user) sb.from('profiles').update({onboarding_completed:true}).eq('id',state.user.id).then(()=>{}).catch(()=>{});
  };
}

const profileSettings = document.querySelector('#profileScreen .settings-card');
if(profileSettings){
  profileSettings.addEventListener('click', async (e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    e.stopPropagation();
    const id=btn.id;
    if(id==='changeNickname'){ $('nicknameInput').value=state.profile?.nickname||''; if(!$('nicknameDialog').open)$('nicknameDialog').showModal(); }
    else if(id==='changePassword'){ $('changePasswordForm').reset(); if(!$('changePasswordDialog').open)$('changePasswordDialog').showModal(); }
    else if(id==='themeButton'){ if(!$('themeDialog').open)$('themeDialog').showModal(); applyTheme(state.theme); }
    else if(id==='infoCorner'){ if(!$('infoDialog').open)$('infoDialog').showModal(); }
    else if(id==='showTutorial'){ window.showOnboarding(true); }
  }, {capture:false});
}

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(state.theme==='system')applyTheme('system')});applyTheme(state.theme);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.warn);
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user&&!state.user)bootUser(session.user)});
handleAuth();
