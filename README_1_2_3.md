Tanko 1.2.3 — poprawka po testach iPhone

1. Wgraj zawartość ZIP do głównego katalogu repozytorium Tanko na GitHub Pages (nie jako dodatkowy podfolder).
2. W Supabase SQL Editor uruchom najpierw supabase_patch_1_2_2_points.sql, JEŚLI nie był wcześniej wykonany.
3. Następnie uruchom supabase_patch_1_2_3_limits.sql (nowy patch). Nie uruchamiaj ponownie starego supabase.sql ani patcha 1.2 z ciężarówkami.
4. Zamknij aplikację na iPhonie i otwórz ponownie. Jeśli nadal widzisz mały popup z jedną ceną, usuń PWA z ekranu początkowego, wyczyść dane witryny frano-web.github.io i zainstaluj ponownie z /Tanko/ (wyczyszczenie danych witryny może wylogować inne aplikacje z tej domeny).

Kliknięcie pinezki mapy otwiera od razu pełne okno szczegółów ze wszystkimi paliwami PB95/PB98/ON/LPG. Dodawanie ceny wymaga świeżego GPS do 100 m; potwierdzanie do 80 m. Dokładność GPS powyżej 80 m powoduje prośbę o ponowny odczyt. Baza blokuje drugi zapis ceny na tej samej stacji przez to samo konto w ciągu 10 h oraz potwierdzenie własnej ceny.

WAŻNE: zwykła aplikacja webowa nie może kryptograficznie potwierdzić, że współrzędne GPS są prawdziwe; użytkownik techniczny może je podrobić. Ograniczenia lokalizacji w SQL sprawdzają przesłane współrzędne, a nie dowód fizycznej obecności. Rozważ dodatkową moderację i limity punktów przed uruchomieniem nagród.
