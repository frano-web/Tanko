# Tanko 1.2.5 — mapa, duplikaty, ranking i samochody

1. W Supabase → SQL Editor uruchom `supabase_patch_1_2_5.sql` (po wcześniejszych patchach punktów i GPS).
2. Wgraj zawartość ZIP do **głównego katalogu** repozytorium GitHub Pages (nie cały folder Tanko-1.2.5).
3. Odśwież PWA. Sprawdź mapę przy oddaleniu, rozwijanie użytkownika w rankingu, przełączenie samochodu i jego zapamiętanie po zalogowaniu.

Mapa: przy małym zoomie grupuje pinezki na siatce i rysuje tylko te w widocznym obszarze. To lekka wersja klastrowania bez dodatkowej biblioteki. W przypadku bardzo dużych baz nadal może być potrzebne klastrowanie serwerowe.

Duplikaty: synchronizacja OSM używa unikalnego external_id i pomija stacje bliskie istniejącym ręcznym wpisom. Nie usuwa historycznych duplikatów automatycznie, bo mogłyby zostać utracone powiązane ceny. Istniejące duplikaty można usunąć przez panel admina po weryfikacji.

Statystyki: widok przypisuje potwierdzenie do ostatniego wcześniejszego zgłoszenia manual/photo na tej samej stacji. W historycznych danych nie ma jawnego `confirmed_report_id`, więc przy nietypowej sekwencji wielu zgłoszeń między potwierdzeniami jest to przybliżenie. Docelowo należy zapisywać ID potwierdzanego zgłoszenia.

Nie testowano połączenia z Twoim rzeczywistym Supabase ani działania na iPhonie. Jeśli SQL zwróci błąd, nie uruchamiaj kolejnych patchy i prześlij komunikat.
