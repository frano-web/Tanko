const CONFIG = window.APP_CONFIG || {};
const hasSupabase = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase);
const sb = hasSupabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const state = {
  user: null,
  fuel: localStorage.getItem('fuel') || 'pb95',
  liters: Number(localStorage.getItem('liters') || 45),
  location: null,
  cars: JSON.parse(localStorage.getItem('cars') || '[]'),
  activeCarId: localStorage.getItem('activeCarId'),
  points: Number(localStorage.getItem('points') || 120),
  map: null,
  markers: [],
  deferredInstall: null,
  authMode: 'login'
};

// Dane startowe interfejsu; połączenie z bazą może je zastąpić danymi stacji.
let stations = [
  {id:1,name:'MOYA',address:'Jarocin',lat:51.9732,lng:17.5067,prices:{pb95:5.94,pb98:6.39,on:5.99,lpg:2.89},updatedAt:Date.now()-18*60000,confirmations:4},
  {id:2,name:'ORLEN',address:'Jarocin',lat:51.9688,lng:17.4958,prices:{pb95:5.99,pb98:6.44,on:6.04,lpg:2.92},updatedAt:Date.now()-58*60000,confirmations:7},
  {id:3,name:'Shell',address:'Jarocin',lat:51.9617,lng:17.5195,prices:{pb95:6.04,pb98:6.49,on:6.09,lpg:2.95},updatedAt:Date.now()-8*3600000,confirmations:2},
  {id:4,name:'Circle K',address:'Jarocin',lat:51.9821,lng:17.4824,prices:{pb95:6.09,pb98:6.55,on:6.11,lpg:2.97},updatedAt:Date.now()-31*3600000,confirmations:1},
  {id:5,name:'Stacja niezależna',address:'okolice Jarocina',lat:51.9915,lng:17.5330,prices:{pb95:5.91,pb98:6.35,on:5.97,lpg:2.86},updatedAt:Date.now()-74*3600000,confirmations:1}
];

const popularCars = {
  'Audi A4 B6 1.8T': {engine:'1.8T',fuel:'pb95',consumption:9.0},
  'Volkswagen Passat B6 2.0 TDI': {engine:'2.0 TDI',fuel:'on',consumption:6.2},
  'Volkswagen Golf V 1.9 TDI': {engine:'1.9 TDI',fuel:'on',consumption:5.6},
  'Škoda Octavia II 1.9 TDI': {engine:'1.9 TDI',fuel:'on',consumption:5.5},
  'BMW E90 320d': {engine:'2.0d',fuel:'on',consumption:6.0},
  'Opel Astra H 1.6': {engine:'1.6',fuel:'pb95',consumption:7.5}
};

function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function saveLocal(){localStorage.setItem('cars',JSON.stringify(state.cars));localStorage.setItem('activeCarId',state.activeCarId||'');localStorage.setItem('fuel',state.fuel);localStorage.setItem('liters',state.liters);localStorage.setItem('points',state.points)}
function activeCar(){return state.cars.find(c=>String(c.id)===String(state.activeCarId))||state.cars[0]||null}
function fuelLabel(f){return ({pb95:'PB95',pb98:'PB98',on:'ON',lpg:'LPG'})[f]||f.toUpperCase()}
function ageHours(ts){return (Date.now()-new Date(ts).getTime())/3600000}
function freshness(ts){const h=ageHours(ts);if(h<3)return {label:'ŚWIEŻA',cls:'fresh',score:1};if(h<24)return {label:'AKTUALNA',cls:'fresh',score:.9};if(h<72)return {label:'STARSZA',cls:'stale',score:.7};return {label:'NIEPEWNA',cls:'stale',score:.45}}
function haversine(a,b){const R=6371, dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;const x=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))}

function calcStations(){
  const car=activeCar();
  const pos=state.location || {lat:51.972,lng:17.502};
  const chosenFuel=state.fuel;
  const valid=stations.filter(s=>Number(s.prices?.[chosenFuel])>0).map(s=>{
    const distance=haversine(pos,{lat:s.lat,lng:s.lng});
    const price=Number(s.prices[chosenFuel]);
    const consumption=car?.consumption||7.5;
    const travelFuel=(distance*2)*consumption/100;
    const travelCost=travelFuel*price;
    return {...s,distance,price,travelCost};
  });
  const nearest=valid.slice().sort((a,b)=>a.distance-b.distance)[0];
  const baseline=nearest? nearest.price*state.liters : 0;
  return valid.map(s=>{
    const total=s.price*state.liters+s.travelCost;
    const saving=baseline-total;
    const f=freshness(s.updatedAt);
    const score=(baseline-total)*2 - s.distance*.08 + f.score*4;
    return {...s,total,saving,score,f};
  }).sort((a,b)=>b.score-a.score);
}

function renderHome(){
  document.querySelectorAll('.fuel').forEach(b=>b.classList.toggle('active',b.dataset.fuel===state.fuel));
  $('litersValue').textContent=state.liters;
  $('pointsValue').textContent=state.points;
  const car=activeCar();
  $('carSwitcher').textContent=car ? `${car.name}${car.engine?' · '+car.engine:''} ▾` : 'Dodaj samochód ▾';
  const ranked=calcStations();
  const best=ranked[0];
  if(!best){return}
  $('bestStationName').textContent=best.name;
  $('bestPrice').textContent=best.price.toFixed(2).replace('.',',');
  $('bestDistance').textContent=`${best.distance.toFixed(1).replace('.',',')} km`;
  $('bestSaving').textContent=best.saving>0?`+${best.saving.toFixed(2).replace('.',',')} zł`:'najbliżej';
  $('bestFreshness').textContent=best.f.label;
  $('bestFreshness').className=`confidence ${best.f.cls}`;
  const badge=$('worthBadge');
  if(!car){badge.textContent='Dodaj samochód, aby policzyć realny koszt dojazdu';badge.className='worth neutral'}
  else if(best.saving>5){badge.textContent=`🟢 Warto jechać — po dojeździe zostaje ok. ${best.saving.toFixed(2).replace('.',',')} zł oszczędności`;badge.className='worth good'}
  else if(best.saving>1){badge.textContent='🟡 Oszczędność jest niewielka';badge.className='worth medium'}
  else{badge.textContent='🔴 Nie warto nadrabiać drogi tylko dla ceny';badge.className='worth bad'}
  $('topStations').innerHTML=ranked.slice(0,3).map((s,i)=>`<div class="station-item" data-station="${s.id}"><div class="station-main"><div class="rank-badge">${['🥇','🥈','🥉'][i]}</div><div><strong>${s.name}</strong><div class="sub">${s.distance.toFixed(1).replace('.',',')} km · ${s.confirmations} potwierdzeń</div><div class="${s.f.cls==='fresh'?'fresh-text':'stale-text'}">${humanAge(s.updatedAt)}</div></div></div><div class="station-price"><strong>${s.price.toFixed(2).replace('.',',')}</strong><div class="sub">zł/l</div></div></div>`).join('');
}
function humanAge(ts){const m=Math.round((Date.now()-new Date(ts).getTime())/60000);if(m<60)return `aktualizacja ${m} min temu`;const h=Math.round(m/60);if(h<48)return `aktualizacja ${h} godz. temu`;return `aktualizacja ${Math.round(h/24)} dni temu`}

function renderRanking(){
  const users=[['Kamil',980],['Dawid',state.points],['Michał',640],['Ola',515],['Bartek',460]].sort((a,b)=>b[1]-a[1]);
  $('rankingList').innerHTML=users.map((u,i)=>`<div class="rank-item"><div class="station-main"><div class="rank-badge">${i<3?['🥇','🥈','🥉'][i]:i+1}</div><div><strong>${u[0]}</strong><div class="sub">aktywny reporter</div></div></div><div class="right"><strong>${u[1]}</strong><div class="sub">pkt</div></div></div>`).join('');
}
function renderCars(){
  const car=activeCar();
  $('carsList').innerHTML=state.cars.length?state.cars.map(c=>`<div class="car-item ${car?.id===c.id?'active':''}"><div><strong>${c.name}</strong><div class="sub">${c.engine||'silnik własny'} · ${fuelLabel(c.fuel)} · ${Number(c.consumption).toFixed(1)} l/100 km</div></div><div class="car-actions"><button class="tiny-btn choose-car" data-id="${c.id}">${car?.id===c.id?'Aktywne':'Wybierz'}</button><button class="tiny-btn remove-car" data-id="${c.id}">Usuń</button></div></div>`).join(''):'<div class="car-item"><div><strong>Nie masz jeszcze samochodu</strong><div class="sub">Dodaj auto, aby liczyć koszt dojazdu.</div></div></div>';
  $('defaultFuelLabel').textContent=fuelLabel(state.fuel);
  $('profileEmail').textContent=state.user?.email||'Użytkownik demo';
  $('locationStatus').textContent=state.location?'włączona':'wyłączona';
  renderCarPicker();
}
function renderCarPicker(){
  $('carPickerList').innerHTML = state.cars.map(c=>`<button class="car-item pick-car" data-id="${c.id}" style="width:100%;text-align:left"><div><strong>${c.name}</strong><div class="sub">${c.engine||''} · ${Number(c.consumption).toFixed(1)} l/100 km</div></div><span>›</span></button>`).join('') || '<p class="muted">Najpierw dodaj samochód.</p>';
}

async function loadStations(){
  if(!hasSupabase)return;
  try{
    const {data,error}=await sb.from('stations_with_latest_prices').select('*').limit(500);
    if(error) throw error;
    if(data?.length){stations=data.map(r=>({id:r.id,name:r.name,address:r.address,lat:Number(r.latitude),lng:Number(r.longitude),prices:{pb95:r.pb95,pb98:r.pb98,on:r.on_price,lpg:r.lpg},updatedAt:r.price_updated_at||r.updated_at,confirmations:r.confirmations||1}));}
  }catch(e){console.warn('Stations fallback:',e.message)}
}

function initMap(){
  if(state.map || !window.L)return;
  const center=state.location||{lat:51.972,lng:17.502};
  state.map=L.map('map',{zoomControl:false}).setView([center.lat,center.lng],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map);
  L.control.zoom({position:'bottomright'}).addTo(state.map);
  renderMapMarkers();
}
function renderMapMarkers(){
  if(!state.map)return;
  state.markers.forEach(m=>m.remove());state.markers=[];
  calcStations().forEach(s=>{
    const color=s.f.cls==='fresh'?'#10b981':'#f59e0b';
    const icon=L.divIcon({className:'',html:`<div style="background:${color};color:#fff;border:3px solid #fff;box-shadow:0 3px 12px #0003;border-radius:15px;padding:7px 9px;font-weight:900;font-size:12px;white-space:nowrap">${s.price.toFixed(2)} zł</div>`});
    const m=L.marker([s.lat,s.lng],{icon}).addTo(state.map).bindPopup(`<b>${s.name}</b><br>${fuelLabel(state.fuel)}: ${s.price.toFixed(2)} zł/l<br>${humanAge(s.updatedAt)}`);state.markers.push(m);
  });
  if(state.location){const m=L.circleMarker([state.location.lat,state.location.lng],{radius:7}).addTo(state.map).bindPopup('Twoja lokalizacja');state.markers.push(m)}
}

async function requestLocation(){
  if(!navigator.geolocation){toast('Ta przeglądarka nie obsługuje GPS.');return}
  navigator.geolocation.getCurrentPosition(pos=>{
    state.location={lat:pos.coords.latitude,lng:pos.coords.longitude};
    $('locationBanner').classList.add('hidden');renderHome();renderCars();
    if(state.map){state.map.setView([state.location.lat,state.location.lng],14);renderMapMarkers()}
    toast('Lokalizacja włączona.');
  },()=>toast('Nie udało się uzyskać lokalizacji. Sprawdź uprawnienia przeglądarki.'),{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}

async function signInOrRegister(e){
  e.preventDefault();const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(hasSupabase){
    const fn=state.authMode==='login'?sb.auth.signInWithPassword({email,password}):sb.auth.signUp({email,password});
    const {data,error}=await fn;if(error){toast(error.message);return}state.user=data.user||data.session?.user;if(state.authMode==='register'&&!data.session)toast('Sprawdź e-mail i potwierdź konto.');else enterApp();
  }else{
    localStorage.setItem('demoEmail',email);state.user={id:'demo',email};enterApp();
  }
}
async function resetPassword(){const email=$('resetEmail').value.trim();if(!email)return;if(hasSupabase){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:'https://frano-web.github.io/Tanko/reset-password.html'});if(error)toast(error.message);else toast('Link do resetu hasła został wysłany.')}else toast('Nie udało się wysłać wiadomości. Spróbuj ponownie później.')}
async function logout(){if(hasSupabase)await sb.auth.signOut();localStorage.removeItem('demoEmail');state.user=null;$('appView').classList.add('hidden');$('authView').classList.remove('hidden')}

function enterApp(){
  $('authView').classList.add('hidden');$('appView').classList.remove('hidden');renderAll();
  if(!state.cars.length)setTimeout(()=>$('carDialog').showModal(),350);
}
function renderAll(){renderHome();renderCars();renderRanking();if(state.map)renderMapMarkers()}

function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));if(id==='mapScreen'){setTimeout(()=>{initMap();state.map?.invalidateSize()},80)}if(id==='rankingScreen')renderRanking();if(id==='profileScreen')renderCars()}

function mockOCR(){
  const near=calcStations()[0]||stations[0];
  $('ocrFields').innerHTML=['pb95','pb98','on','lpg'].map(f=>`<div class="ocr-row"><strong>${fuelLabel(f)}</strong><input data-ocr-fuel="${f}" type="number" step="0.01" value="${near.prices[f]||''}" placeholder="np. 5.99" /></div>`).join('');
  $('ocrPanel').classList.remove('hidden');
  toast('Zdjęcie zostało dodane. Sprawdź ceny przed zapisaniem.');
}
async function savePriceReport(){
  const vals={};document.querySelectorAll('[data-ocr-fuel]').forEach(i=>{if(i.value)vals[i.dataset.ocrFuel]=Number(i.value)});
  const nearest=calcStations().slice().sort((a,b)=>a.distance-b.distance)[0];if(!nearest)return;
  if(hasSupabase && state.user){
    const {error}=await sb.from('price_reports').insert({station_id:nearest.id,user_id:state.user.id,prices:vals,latitude:state.location?.lat,longitude:state.location?.lng,source:'photo'});if(error){toast(error.message);return}
  }
  const s=stations.find(x=>x.id===nearest.id);s.prices={...s.prices,...vals};s.updatedAt=Date.now();s.confirmations=(s.confirmations||0)+1;
  state.points+=10;saveLocal();renderAll();$('ocrPanel').classList.add('hidden');toast('+10 pkt · ceny zapisane');showScreen('homeScreen');
}

// Auth UI
document.querySelectorAll('[data-auth]').forEach(b=>b.addEventListener('click',()=>{state.authMode=b.dataset.auth;document.querySelectorAll('[data-auth]').forEach(x=>x.classList.toggle('active',x===b));$('authSubmit').textContent=state.authMode==='login'?'Zaloguj się':'Utwórz konto';$('forgotPassword').style.display=state.authMode==='login'?'block':'none'}));
$('authForm').addEventListener('submit',signInOrRegister);
$('forgotPassword').addEventListener('click',()=>{$('resetEmail').value=$('authEmail').value;$('resetDialog').showModal()});$('resetForm').addEventListener('submit',resetPassword);

// Navigation
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));
$('showAllMap').addEventListener('click',()=>showScreen('mapScreen'));$('enableLocation').addEventListener('click',requestLocation);$('changeLocation').addEventListener('click',requestLocation);$('centerMap').addEventListener('click',()=>{if(state.location)state.map?.setView([state.location.lat,state.location.lng],14);else requestLocation()});

document.querySelectorAll('.fuel').forEach(b=>b.addEventListener('click',()=>{state.fuel=b.dataset.fuel;saveLocal();renderAll()}));
$('minusLiters').addEventListener('click',()=>{state.liters=Math.max(5,state.liters-5);saveLocal();renderHome()});$('plusLiters').addEventListener('click',()=>{state.liters=Math.min(100,state.liters+5);saveLocal();renderHome()});
$('navigateBest').addEventListener('click',()=>{const s=calcStations()[0];if(s)window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,'_blank')});

// Cars
$('addCarBtn').addEventListener('click',()=>{$('carForm').reset();$('carDialog').showModal()});$('carSwitcher').addEventListener('click',()=>{if(!state.cars.length)$('carDialog').showModal();else $('carPickerDialog').showModal()});$('closeCarPicker').addEventListener('click',()=>$('carPickerDialog').close());
$('carForm').addEventListener('submit',(e)=>{if(e.submitter?.value==='cancel')return;const car={id:Date.now(),name:$('carName').value.trim(),engine:$('carEngine').value.trim(),fuel:$('carFuel').value,consumption:Number($('carConsumption').value)};state.cars.push(car);state.activeCarId=car.id;state.fuel=car.fuel;saveLocal();renderAll();toast('Samochód dodany.');});
document.addEventListener('click',(e)=>{const choose=e.target.closest('.choose-car,.pick-car');if(choose){state.activeCarId=Number(choose.dataset.id);const c=activeCar();if(c)state.fuel=c.fuel;saveLocal();renderAll();$('carPickerDialog').open&&$('carPickerDialog').close()}const del=e.target.closest('.remove-car');if(del){state.cars=state.cars.filter(c=>String(c.id)!==String(del.dataset.id));if(String(state.activeCarId)===String(del.dataset.id))state.activeCarId=state.cars[0]?.id||null;saveLocal();renderAll();}});

// Photo / OCR placeholder
$('pylonPhoto').addEventListener('change',(e)=>{if(e.target.files?.[0])mockOCR()});$('manualPriceBtn').addEventListener('click',mockOCR);$('savePrices').addEventListener('click',savePriceReport);
$('logoutBtn').addEventListener('click',logout);

// PWA install
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();state.deferredInstall=e;if(localStorage.getItem('installDismissed')!==new Date().toDateString())$('installBanner').classList.remove('hidden')});
$('installBtn').addEventListener('click',async()=>{if(state.deferredInstall){state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('installBanner').classList.add('hidden')}else toast('Na iPhonie: Udostępnij → Dodaj do ekranu początkowego.')});
$('installDismiss').addEventListener('click',()=>{$('installBanner').classList.add('hidden');localStorage.setItem('installDismissed',new Date().toDateString())});
if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.navigator.standalone&&localStorage.getItem('installDismissed')!==new Date().toDateString())$('installBanner').classList.remove('hidden');
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));

(async function init(){
  await loadStations();
  if(hasSupabase){const {data:{session}}=await sb.auth.getSession();if(session){state.user=session.user;enterApp()}sb.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')window.location.href='./reset-password.html';if(session){state.user=session.user}})}else{const email=localStorage.getItem('demoEmail');if(email){state.user={id:'demo',email};enterApp()}}
  renderAll();
})();
