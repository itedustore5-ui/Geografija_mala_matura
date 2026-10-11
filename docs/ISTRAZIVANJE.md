# Aplikacija kao instrument istraživanja

Aplikacija ima dve uloge istovremeno:

| Uloga | Kome služi | Šta traži |
|---|---|---|
| Alat za učenje | učenicima | da bude prijatna, brza, da daje povratnu informaciju |
| Instrument merenja | istraživanju | da podaci budu tačni, uporedivi i neponovljivi |

Te dve uloge se sukobljavaju. Ono što je dobro za učenje (vežbaj koliko hoćeš,
vidi odmah tačan odgovor, ponovi test) uništava merenje. **Kad se sukobe,
prednost ima merenje** — loš prikaz se popravi sutra, pogrešno prikupljen
podatak se ne popravlja nikad.

---

## Dva režima

| | Vežbanje (intervencija) | Merenje |
|---|---|---|
| Sadržaj | 441 zadatak iz zbirke, po nivoima i oblastima | fiksni test, isti za sve u toj fazi |
| Kad | kad god učenik hoće | samo kad istraživač otvori termin |
| Povratna informacija | odmah, uz objašnjenje | tek posle predaje |
| Broj pokušaja | neograničen | **jedan po fazi** |
| Bodovanje | 0/1 po zadatku | kao na pravom ispitu, sa delimičnim poenima |
| Uloga u studiji | nezavisna promenljiva („doza“) | zavisna promenljiva |

U bazi ih razlikuje `quiz_attempts.exam_key` (NULL = vežbanje). Svaki upit,
prikaz i izvoz bira jedan od njih; prosek preko oba je besmislen.

---

## Faze i grane

```
T0 (početno) → vežbanje → T30 → T90
```

Nazivi su **vremenski**, ne redni: iz podataka se posle vidi šta je merio onaj
ko ih čita, bez legende.

| Grana | Vežbanje | Merenja |
|---|---|---|
| `eksperimentalna` | da | sva |
| `kontrolna` | **ne** | ista, sva |

Ako se kontrolnoj grupi posle prvog merenja ipak otvori vežbanje (etički
razumljivo), to više nije kontrolna grupa nego druga eksperimentalna sa
zakasnelim početkom — i tako se mora opisati u radu (*waitlist control*).

---

## Uravnoteženje formi

Ako svi na T0 rade formu A, a na T30 formu B, težina testa se meša sa fazom —
ne zna se da li je pad od zaboravljanja ili zato što je B bio teži. Zato
latinski kvadrat, u `src/lib/study.ts`:

| Rotaciona grupa | T0 | T30 | T90 |
|---|---|---|---|
| 1 | A | B | C |
| 2 | B | C | A |
| 3 | C | A | B |

Rotacionu grupu **dodeljuje server**, u najmanju — ručna dodela bi grupe s
vremenom razvukla, a uravnoteženje radi samo ako su približno jednake.

Forme se vezuju za konkretne testove u ekranu *Studija*. Kad merenje počne,
server odbija njihovu izmenu (409): promena bi značila da grupe nisu prošle
kroz isti skup, a stari podaci se ne mogu popraviti.

---

## Šta odlučuje server

Ništa od ovoga ne sme da zavisi od tela zahteva:

| Odluka | Zašto ne klijent |
|---|---|
| Tačnost odgovora | inače učenik prijavljuje šta hoće |
| Faza merenja | inače bi svoj test proglasio kojom hoće fazom |
| Koji test dobija | inače bi uzeo tuđu formu i pokvario uravnoteženje |
| Da li je termin otvoren | inače bi radio test kad hoće |
| Da li je već radio taj test | inače bi ponavljao dok ne ispadne dobro |

**Skrivanje dugmeta nije zaštita.** Kontrolna grana dobija 403 na
`GET /api/questions` i `POST /api/attempts`, ma kako do putanje došla.

---

## Model podataka

| Tabela | Jedan red je |
|---|---|
| `quiz_users` | ispitanik: pseudonim, saglasnost, odeljenje, grana, rotaciona grupa |
| `quiz_attempts` | jedna sesija (vežbanje ILI merenje) + faza, forma, trajanje |
| `attempt_items` | **jedan zadatak u jednom pokušaju** |
| `study_settings` | jedan red (id = 1): tekuća faza, otvoren termin, forme |

### `attempt_items` je najvrednija

Iz pokušaja se zna *koliko* je neko znao. Odavde se zna *šta* je znao:

- težina svake stavke (koliki procenat je pogodio)
- diskriminativnost (ako baš dobri greše zadatak, zadatak je loš)
- poređenje tipova zadataka (`single` naspram `pick` naspram `fill`)
- **šta je zaboravljeno** — isti zadaci na T0 i na T90
- vreme po zadatku: dugo zadržavanje uz tačan odgovor znači nesigurno znanje,
  i takve stavke prve „padnu“ na kasnijem merenju

Ova tabela se naknadno ne može rekonstruisati. Piše se uz svaki pokušaj, i
vežbanja i merenja.

---

## Izvoz

`Studija → Izvoz`, ili direktno (traži admin token):

| Putanja | Jedan red je | Za šta |
|---|---|---|
| `/api/export/wide.csv` | jedan ispitanik, faze jedna do druge | SPSS, jamovi |
| `/api/export/long.csv` | jedan pokušaj | R, mešoviti modeli |
| `/api/export/items.csv` | jedan zadatak u jednom pokušaju | težina, diskriminativnost |

Pravila su u `src/lib/csv.ts` i važe za sva tri:

- **samo uz saglasnost**, i **nikad ime** — samo `research_id`
- BOM na početku, inače Excel iskrivi ćirilicu
- broj kolona u zaglavlju i u redovima mora biti isti; ako se raziđe, izvoz
  **puca** umesto da tiho pomeri vrednosti za jedno mesto
- vodeći `=`, `+`, `-`, `@` se neutrališu, da Excel ne pročita vrednost kao
  formulu

Poništeni pokušaji ne ulaze ni u jedan izvoz.

---

## Operativno

```bash
# Provera nacrta: latinski kvadrat, veličine grupa, forme, pravila izvoza
pnpm --filter @workspace/api-server run verify:study

# Rezervna kopija svih tabela u lokalni folder
pnpm --filter @workspace/api-server run backup
pnpm --filter @workspace/api-server run backup -- C:\putanja\do\foldera
```

**Rezervna kopija** je jedina stavka na spisku koja može da spase istraživanje.
Pokreće se posle svakog merenja, a kopija ide i van tog računara.

**Poništavanje pokušaja** — nekome će pući veza ili zatvoriti prozor. Bez
dugmeta, istraživač usred časa otvara SQL editor. Poništavanje se beleži: ko,
kome, koji rezultat, i zašto.

**Pregled popunjenosti** se gleda **pre** zatvaranja termina, ne posle.

**Probni prolaz** — dvoje-troje ljudi kroz ceo tok kao pravi ispitanici, pa
provera da su podaci stigli tačno. Greška nađena na tri osobe je neprijatnost;
nađena na celom odeljenju je izgubljeno merenje.

---

## Redosled pred prvo merenje

1. Testovi su uneti: zvanični završni ispiti iz geografije 2023–2026
   (`src/data/exams/`), bodovani po uputstvu za pregledanje
2. `Studija → Paralelne forme` — vezati tri od njih za A, B i C
3. `Admin → Novi nalog` za svakog učenika, pa `Studija → Upisivanje u
   studiju` — izabrati granu i odeljenje, čekirati učenike, `Upiši`
4. Prikupiti **potpisane saglasnosti roditelja** (učenici su maloletni) i
   odobrenje etičke komisije; tek onda čekirati „Сагласност“ u
   `Studija → Popunjenost`
5. `verify:study` mora da prođe bez problema
6. Probni prolaz, pa `backup`
7. `Studija → Tekuća faza: T0 — почетно мерење`, uključiti „Термин мерења
   отворен“
8. Posle merenja: isključiti termin, `backup`, pa fazu na „Вежбање“ (i
   uključiti „Вежбање отворено“)
9. T30 i T90 isto kao korak 7–8; formu za svaku fazu određuje rotaciona
   grupa — istraživač ne bira ništa

**Saglasnost i ispisivanje** — `Studija → Popunjenost`, u redu ispitanika:

- kvadratić **„Сагласност“** se čekira tek uz potpisanu saglasnost roditelja i
  odobrenje etičke komisije; bez nje ispitanik radi, ali ne ulazi u izvoz;
- **„Испиши“** izbacuje ispitanika iz studije: više ne dobija testove u
  terminima merenja i ispada iz izvoza. Već urađena merenja ostaju u bazi, a
  pseudonim i rotaciona grupa se pamte — ponovnim upisom nastavlja istom
  formom, a test iz faze koju je već uradio ne može ponoviti;
- nalog sa merenjima se ne može obrisati dok je ispitanik u studiji. Za
  potpuno brisanje (npr. kad roditelj povuče saglasnost i traži brisanje
  podataka): prvo „Испиши“, pa `Admin → obriši nalog` — to briše i sva njegova
  merenja, nepovratno.

Ispisivanje i promena saglasnosti beleže se u log servera (ko, kome, kada),
kao i poništavanje pokušaja.

**Šta učenik vidi.** U „Цео тест“ učesnik studije vidi **samo svoj test**
dok je termin otvoren (koji je, određuje rotaciona grupa i faza), a van
termina nijedan, uz poruku zašto. Posle predaje test stoji kao „предат“ i ne
može se ponoviti u istoj fazi. Učenik koji nije upisan u studiju vidi sva
četiri testa i vežba ih kad hoće — zato se učesnici upisuju pre nego što
dobiju pristup aplikaciji.

---

## Etika

- Saglasnost pre prikupljanja; kod maloletnika **potpisana saglasnost
  roditelja/staratelja** i odobrenje etičke komisije
- Izvoz bez imena, samo pseudonim (`research_id`); ključ pseudonimizacije ostaje
  u bazi, odvojeno od izvezenih podataka
- **IP adresa se ne beleži.** Od uređaja se čuva samo ono što treba za
  tumačenje (da li je mobilni) — `sanitizeClientInfo` prepisuje polje po polje
- Ko nema saglasnost, i dalje koristi aplikaciju za učenje; samo ne ulazi u
  izvoz

### Lozinke

U ovom repou nema kolone `password_plain` (aplikacija za srpski ju je imala):
lozinka se čuva samo kao hash, a nastavnik je resetuje kroz admin panel ili
`reset-password`.
