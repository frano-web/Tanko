# Tanko 1.1 — poprawki po testach

## 1. GitHub Pages
Wgraj **całą zawartość tego folderu** do repozytorium `Tanko` (pliki mają być w głównym katalogu repozytorium). Ikony są teraz również w katalogu głównym, dlatego favicon i ikona PWA nie zależą od folderu `icons/`.

Po wdrożeniu na komputerze użyj `Ctrl+Shift+R`. Na telefonie przy zmianie ikony usuń starą ikonę PWA z ekranu i dodaj aplikację ponownie.

## 2. Supabase — wymagany patch
Masz już działającą bazę 1.0, więc **nie musisz uruchamiać całego supabase.sql od nowa**.

Wejdź do **Supabase → SQL Editor → New query**, wklej zawartość pliku:

`supabase_patch_1_1.sql`

i kliknij **Run**.

Patch:
- naprawia naliczanie punktów,
- dodaje tryb jasny/ciemny/systemowy,
- pozwala adminowi usuwać zduplikowane stacje,
- wymaga GPS przy potwierdzaniu ceny i odległości maks. 500 m,
- blokuje szybkie wielokrotne nabijanie punktów na tej samej stacji.

## 3. Kontakt biznesowy
W `config.js` jest pole:

```js
BUSINESS_EMAIL: ''
```

Wpisz tam adres do współprac, np.:

```js
BUSINESS_EMAIL: 'kontakt@twojadomena.pl'
```

Po ustawieniu adres pokaże się w **Profil → Kącik informacyjny**.

## 4. Najważniejsze poprawki UI
- placeholdery logowania: „Adres e-mail” i „Hasło”,
- działające X w formularzu auta i dodawaniu stacji,
- stacja dodawana pinezką na mapie zamiast ręcznych współrzędnych,
- zmiana nicku,
- zmiana hasła w ustawieniach + reset hasła przy logowaniu,
- tryb jasny / ciemny / systemowy,
- kącik informacyjny,
- możliwość anulowania zdjęcia i zrobienia nowego,
- potwierdzanie cen tylko przy stacji,
- admin może usunąć stację oznaczoną jako duplikat,
- punkty są naliczane poprawnie,
- zablokowane powiększanie całej strony, mapa zachowuje własny zoom.


## 1.1.2 UI fix
Naprawiono menu profilu, wszystkie przyciski X w dialogach, dodawanie ceny bezpośrednio ze szczegółów i mapy oraz przywrócono brakujące funkcje OCR, ręcznego dodawania stacji, trasy i panelu admina. Supabase: bez zmian.
