# Tanko 1.0

Mobilna aplikacja PWA hostowana na GitHub Pages, z Supabase jako backendem.

## 1. Wgraj pliki na GitHub Pages
Podmień całą zawartość repozytorium `Tanko` plikami z tego folderu. Nie pomijaj `sw.js`, bo zmieniono wersję cache.

## 2. Uruchom migrację Supabase
Supabase → SQL Editor → New query → wklej CAŁY `supabase.sql` → Run.

Migracja dodaje:
- trwałe samochody użytkownika,
- ulubione stacje,
- preferencje powiadomień,
- historię cen,
- reputację użytkownika,
- zgłoszenia błędów stacji,
- rolę administratora i skrzynkę zgłoszeń,
- onboarding i ustawienie dźwięków,
- punktację naliczaną po stronie bazy.

## 3. Nadaj sobie administratora
Po uruchomieniu migracji wykonaj osobne zapytanie, podając e-mail konta, które ma być adminem:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'TU_WPISZ_EMAIL_ADMINA');
```

Po ponownym zalogowaniu w profilu pojawi się przycisk **Admin**.

## 4. Authentication → URL Configuration
Site URL:
`https://frano-web.github.io/Tanko/`

Redirect URLs:
- `https://frano-web.github.io/Tanko/`
- `https://frano-web.github.io/Tanko/reset-password.html`
- `https://frano-web.github.io/Tanko/**`

## 5. Co działa w tej wersji
- logowanie, rejestracja i reset hasła przez link,
- samochody zapisane w Supabase + aktywne auto,
- mapa OpenStreetMap i import pobliskich stacji przez Overpass,
- ręczne dodawanie brakującej stacji,
- OCR pylonu przez Tesseract.js bez losowych cen,
- TOP 3 opłacalnych stacji z kosztem dojazdu,
- poziom wiarygodności ceny,
- ulubione stacje,
- pytanie o powiadomienia po dodaniu ulubionej,
- historia ceny z 30 dni,
- ranking wyłącznie prawdziwych kont,
- punkty, reputacja i animacja portfela,
- zgłoszenia błędów do skrzynki administratora,
- tryb trasy z OSRM + Nominatim,
- onboarding z animacjami,
- dźwięki aplikacji z przełącznikiem,
- nowa ikona PWA inspirowana kontrolką rezerwy.

## Ważne o powiadomieniach
W tej wersji powiadomienie o nowej cenie ulubionej stacji działa przez Supabase Realtime, gdy PWA/aplikacja ma aktywną sesję w przeglądarce. Prawdziwe powiadomienia push działające po całkowitym zamknięciu aplikacji wymagają później Web Push + zapisu `PushSubscription` + funkcji backendowej/Edge Function.

## Źródła map i trasy
- mapa/stacje: OpenStreetMap + Overpass
- trasy: publiczny OSRM
- wyszukiwanie celu: Nominatim

Do produkcji przy większym ruchu warto przejść z publicznych endpointów na własny/komercyjny routing/geocoding, żeby nie zależeć od limitów usług społecznościowych.
