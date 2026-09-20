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


## Tanko 1.2.1 — cofnięcie obsługi ciężarówek
Usunięto wybór samochodu osobowego/ciężarowego oraz dodatkowe paliwa HVO100, LNG, CNG i AdBlue.
W formularzu dodawania samochodu, na mapie i w tabeli stacji zostają PB95, PB98, ON, LPG.
Zachowano pełną tabelę 4 paliw, pytanie o nick przy pierwszym logowaniu oraz punktację 20/5/1.
Nie uruchamiaj ponownie `supabase_patch_1_2.sql`. Zmiana jest tylko w aplikacji.
Jeżeli patch 1.2 uruchomiono wcześniej, dodatkowa kolumna i rozszerzone wartości w bazie mogą pozostać bez wpływu na tę wersję aplikacji. Nie usuwaj ich, aby uniknąć utraty istniejących danych.
Po podmianie plików na GitHub Pages odśwież stronę (Ctrl+Shift+R).

### Limity naliczania punktów w istniejącej bazie
Jeśli wykonano patch 1.2: potwierdzanie tej samej stacji jest blokowane przez trigger przez 30 minut; ręczne zgłoszenia i zdjęcia nie mają w patchu 1.2 dodatkowego limitu punktów ani dziennego limitu dodawania cen. Funkcja bonusu +1 także może przyznać go wielokrotnie temu samemu zdjęciu. Wymaga to osobnej poprawki antyspamowej przed udostępnieniem sklepu z nagrodami.


## Aktualizacja 1.2.2: mapa i punktacja

- W dymku po **bezpośrednim kliknięciu pinezki** widoczna jest teraz tabela PB95, PB98, ON i LPG. Brak danych to „Brak ceny”. Dymek ma przyciski Szczegóły i Dodaj cenę.
- Aby zmienić naliczanie punktów w ISTNIEJĄCEJ bazie, wykonaj tylko `supabase_patch_1_2_2_points.sql` w Supabase → SQL Editor → New query → Run. Nie trzeba uruchamiać starego `supabase_patch_1_2.sql` (ten zawiera również schemat ciężarówek).
- Punktacja: dodanie ceny 20 pkt, potwierdzenie 5 pkt, bonus autora zdjęcia +1 pkt za potwierdzenie jego zdjęcia przez innego użytkownika (maksymalnie jeden bonus od tego samego potwierdzającego za dane zdjęcie). Obowiązują także zabezpieczenia przed wielokrotnym nabijaniem punktów.
- SQL nie przelicza historycznych zdarzeń ani nie usuwa użytkowników i danych. Zmienia przyszłe naliczanie.
- Podmień całą zawartość ZIP w katalogu głównym repozytorium GitHub Pages `/Tanko/`, nie umieszczaj plików wewnątrz dodatkowego folderu. Po publikacji odśwież stronę z pominięciem pamięci podręcznej lub ponownie uruchom PWA.
