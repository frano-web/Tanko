# Tankuj – MVP PWA

Mobilna aplikacja webowa do wyszukiwania najbardziej opłacalnej stacji paliw.

## Co już działa
- mobilny interfejs PWA,
- ekran logowania/rejestracji,
- tryb demo bez backendu,
- gotowość pod Supabase Auth,
- reset hasła przez e-mail po podłączeniu Supabase,
- prośba o GPS i obliczanie odległości,
- kilka samochodów + szybkie przełączanie,
- wybór PB95/PB98/ON/LPG,
- ranking TOP 3 uwzględniający cenę, koszt dojazdu i spalanie,
- mapa Leaflet/OpenStreetMap,
- formularz aktualizacji cen ze zdjęcia,
- punkty i ranking,
- baner instalacji PWA,
- Service Worker / działanie instalowalne.

## Ważne
OCR zdjęcia pylonu jest w tej wersji **symulowany**. Po wybraniu zdjęcia aplikacja pokazuje formularz rozpoznanych cen. Kolejny etap to podpięcie Google Cloud Vision / innego OCR przez bezpieczną funkcję serwerową, żeby klucz API nie znalazł się w przeglądarce.

## Podłączenie Supabase
1. Utwórz projekt w Supabase.
2. W SQL Editor uruchom `supabase.sql`.
3. W Authentication -> URL Configuration ustaw Site URL na adres aplikacji (np. GitHub Pages).
4. W `config.js` wpisz `SUPABASE_URL` i publiczny `anon key`.
5. W Authentication włącz provider Email.
6. Ustaw własny szablon wiadomości resetującej hasło, jeśli chcesz.

## Uruchomienie lokalne
Nie otwieraj `index.html` bezpośrednio jako `file://`, bo GPS/PWA wymagają bezpiecznego kontekstu. Uruchom prosty serwer:

```bash
python -m http.server 8080
```

Następnie wejdź na `http://localhost:8080`.

## GitHub Pages
Wrzuć wszystkie pliki do repozytorium i w Settings -> Pages wybierz deploy z gałęzi `main`.

## Co zrobić przed publicznym testem
- zaimportować prawdziwą bazę stacji,
- podpiąć realny OCR,
- walidować GPS przy zgłoszeniu ceny,
- dodać mechanizm potwierdzania/odrzucania podejrzanych zmian,
- przenieść naliczanie punktów na backend (nie w JS),
- dodać ograniczenia antyspamowe,
- zapisać samochody w Supabase zamiast tylko localStorage,
- dodać politykę prywatności i regulamin.
