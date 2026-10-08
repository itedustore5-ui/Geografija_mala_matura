# CLAUDE.md

Uputstvo za rad na ovom repozitorijumu.

## Šta je ovo

Aplikacija za pripremu **završnog ispita iz geografije** (mala matura, deo
kombinovanog testa). Sadržaj je prepisan iz *Zbirke zadataka iz biologije,
geografije, istorije, fizike i hemije za završni ispit u osnovnom obrazovanju i
vaspitanju*, izdanje Zavoda za vrednovanje kvaliteta obrazovanja i vaspitanja za
školsku 2025/2026. godinu — deo GEOGRAFIJA, **zadaci 121–240** (strane 34–62,
rešenja 164–174). Skenovi stoje u korenu repoa kao `geografija_pitanja.pdf` i
`geografija_resenja.pdf`; nisu u gitu — vidi `.gitignore`.

Struktura aplikacije prati strukturu zbirke. Zbirka geografiju ne deli na
nivoe ni oblasti i ne piše šifre standarda uz zadatke, pa ni aplikacija ne
izmišlja podelu:

```
Zbirka    → šest celina po dvadeset uzastopnih brojeva (121–140 … 221–240)
Testovi iz prethodnih godina → zaseban modul (exam_key ≠ NULL), još prazan
```

Celina se izvodi iz broja zadatka (`blockOf` u `src/data/types.ts`) i ne piše se
na zadatak.

Prioritet je tačnost podataka. Greška u prikazu je neprijatna; netačan tačan
odgovor uči učenika pogrešno pred ispit koji polaže jednom.

## Odakle dolaze tačni odgovori

**Isključivo iz `geografija_resenja.pdf` (strane 164–174), nikad iz označenih
kružića u samom zadatku.** Primerak zadataka je delimično popunjen rukom (184,
186, 187, 188…).

Poznata nepravilnost u rešenjima: kod **206** je tabela odštampana pomereno za
jedan red. Čita se od zaglavlja (Т, Н, Н, Т) i to je zapisano u komentaru uz
zadatak. Sva prilagođavanja i nepravilnosti su u `docs/PREPISIVANJE.md`.

Stanje prepisivanja se vidi iz `verify:scoring` — ispisuje broj zadataka po
celini i tipu, i nabraja brojeve koji nedostaju.

## Komande

```bash
pnpm install
pnpm run typecheck
pnpm run build          # traži PORT i BASE_PATH u okruženju
```

Iz `artifacts/api-server`, ili sa `pnpm --filter @workspace/api-server run <x>`:

| Komanda | Šta radi |
|---|---|
| `verify:scoring` | proverava sve zadatke: strukturu, bodovanje i da tačan odgovor ne curi ka klijentu |
| `verify:exams` | isto za testove sa prethodnih završnih ispita + zbir poena |
| `verify:study` | nacrt studije: latinski kvadrat, veličine grupa, forme, pravila izvoza |
| `verify:tekst` | da nijedan tekst u kodu ne meša ćirilicu i latinicu |
| `probni-prolaz` | ceo tok kroz pokrenut server, kao pravi ispitanici; briše za sobom |
| `migrate` | primenjuje SQL migracije iz `lib/db/migrations/` |
| `seed` | prvi admin nalog (`ADMIN_INITIAL_PASSWORD`) |
| `reset-password <korisnik>` | promena lozinke (`NEW_PASSWORD`); bez argumenta lista naloge |
| `backup` | sve tabele u lokalni folder; pokreće se posle svakog merenja |

Pre commit-a uvek:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run verify:scoring
pnpm --filter @workspace/api-server run verify:exams
pnpm --filter @workspace/api-server run verify:tekst
```

Pre merenja još i `verify:study` i `probni-prolaz` (traži pokrenut server;
`BASE_URL=http://localhost:5080` ako nije na 5000).

Skripte čitaju `.env` iz korena repoa (`src/lib/load-env.ts`). **Sam server ne
čita `.env`** — lokalno se pokreće sa `node --env-file=.env`, kao u
`.claude/launch.json`.

## Struktura

```
artifacts/api-server/     Express 5, Drizzle, HMAC-SHA256 tokeni
  src/data/types.ts         model zadatka (10 tipova) i celine
  src/data/questions/       zadaci, jedan fajl po celini (zadaci-121-140.ts …)
  src/data/exams/           testovi sa prethodnih završnih ispita
  src/lib/scoring.ts        bodovanje vežbanja + sanitizacija
  src/lib/exam-scoring.ts   bodovanje ispita (delimični poeni)
  src/lib/study.ts          faze, grane, rotacija formi, ko sme šta
  src/lib/attempt-items.ts  upis rezultata po zadatku
  src/lib/csv.ts            izvoz: BOM, broj kolona, neutralizacija formula
  src/routes/               auth, quiz, exams, admin, research, export, health
  scripts/                  verify:*, migrate, seed, backup, probni-prolaz
artifacts/geografija-kviz/ React 19 + Vite + wouter + Tailwind v4
  src/components/QuestionView.tsx   prikaz svih tipova zadataka
  public/images/            prilozi (karte, crteži, grafikoni, znaci)
lib/db/                   Drizzle šema + SQL migracije
docs/DEPLOY.md            Render + Postgres, korak po korak
docs/ISTRAZIVANJE.md      aplikacija kao instrument merenja — pročitati pre
                          diranja faza, rotacije ili izvoza
docs/PREPISIVANJE.md      stanje prepisivanja, prilagođavanja, greške u zbirci
```

## Tipovi zadataka

`single`, `multi`, `fill`, `match`, `order`, `tf`, `grid`, `pick`, `open`,
`parts`. Geografija koristi `single`, `multi`, `fill`, `tf`, `grid` i `parts`;
ostali ostaju zbog testova sa prethodnih ispita.

- **`grid`** su SVE tabele „обој кружић у одговарајућем пољу“. Učenik boji koje
  god kružiće hoće: u redu ih može biti više (124) ili nijedan (142, 149, 168,
  187, 208, 236 — pojam nije ponuđen). Da su tabele sa po jednim kružićem u redu
  `match`, učenik bi po ponašanju tabele znao gde je red prazan.
- **`parts`** je zadatak iz više delova (А)/Б), 1./2.) koji se boduje kao jedan:
  poen kad su tačni svi delovi. Deo je izbor (`choice`) ili tabela (`grid`).
  Izbor u rečenici („Србија / Шпанија“ sa kružićem ispod pojma) je `choice` sa
  `inline: true`; rečenica se čuva kao `text` + `after`.
- `open` se ne boduje na serveru i ne ulazi u zbir (u geografiji ga nema).
- Podebljano u knjizi ide između `**…**` — „обој **кружиће**“ je jedini znak da
  se bira više odgovora.

## Pravila koja se ne krše

**Tačni odgovori ne izlaze sa servera pre nego što učenik odgovori.**
`sanitizeQuestion` gradi odgovor polje po polje (nikad `{...q}`) — i za svaki
deo zadatka (`sanitizePart`). `verify:scoring` traži zabranjena polja u
**celom stablu** sanitizovanog objekta, ne samo na prvom nivou: kod `parts`
bi tačan odgovor stajao u `parts[i].correctAnswer`. Kad dodaješ polje sa tačnim
odgovorom, dopuni `FORBIDDEN_KEYS` u `verify-scoring.ts` i `verify-exams.ts`.

**Svaka ruta koja vraća tačan odgovor mora imati istu proveru prava.**
`POST /check` mora da proverava granu kao `/questions` i `/attempts` — inače
kontrolna grana prođe kroz sve brojeve zadataka i pročita celo rešenje.

**Server je jedini koji boduje.** Klijent ne računa tačnost ni za prikaz.

**Celina se čita iz zbirke, ne iz tela zahteva.** Server je izvodi iz broja
prvog zadatka u predaji i proverava da svi ostali pripadaju istoj celini.

**Vežbanje i ispit se ne mešaju.** Razlikuju se po `exam_key` (`NULL` =
vežbanje). Bodovanje im je različito (0/1 po zadatku naspram delimičnih poena),
pa je prosek preko oba besmislen.

**Migracije su idempotentne** (`IF NOT EXISTS`). Nova ide kao
`lib/db/migrations/000N_ime.sql`, uz izmenu Drizzle šeme.

**Kad se učenje i merenje sukobe, prednost ima merenje.** Detalji u
`docs/ISTRAZIVANJE.md`.

**Fazu, formu i pravo pristupa određuje server, nikad telo zahteva.** Provera
stoji na samoj putanji (`canPractice`, `canMeasure` u `src/lib/study.ts`).

**`attempt_items` se piše uz svaki pokušaj.**

**Izmišljeni testovi se ne unose.** Lista testova sa prethodnih ispita je prazna
dok se ne unesu zvanični.

## Mobilni prikaz je obavezan

Učenici rešavaju na telefonu. Svaka izmena prikaza mora da prođe na 320px:

- nijedna površina za dodir ispod 44px, na SVAKOM tipu zadatka;
- bez horizontalnog skrolovanja — ni cele strane, ni unutar tabele;
- polja za unos 17px ili više (ispod toga iOS zumira pri fokusu).

Zato ispod 640px tabele sa kružićima i tačno/netačno idu red po red (red, pa
ispod njega kružići sa nazivima kolona), a široka tabela podataka (181, 13
kolona) se okreće. Sa bočnim skrolovanjem učenik lako ne primeti poslednju
kolonu i rešava zadatak bez jednog ponuđenog odgovora.

Isto važi van zadataka: zaglavlje na telefonu ima dva reda (naslov i odjava,
pa traka), dugmad ispod zadatka stoje u jednom redu (bočna nose samo
strelicu), a u donjoj traci se na zadatak skače sa liste — kvadratići su tamo
samo pregled, jer ih dvadeset staje u širinu ekrana.

Provera se radi merenjem, ne okom: skripta u browseru prođe kroz svih 120
zadataka na 320px i broji vidljive dugmad/polja manja od 44px, polja za unos
sitnija od 17px i tabele šire od kartice.

## Zamke na koje se već naletelo

- **CSS pravilo van `@layer` pobeđuje svaku Tailwind klasu.** U `index.css` je
  `button, input, select { font: inherit; }` stajalo van sloja, pa nijedna
  `text-*` klasa na dugmetu ili polju nije radila (polja su bila 16px umesto
  17px, traka na telefonu se prelamala), a `td { padding }` je gazio `p-0`.
  Pravila za elemente idu u `@layer base`.
- **Kružići u skeniranoj zbirci nisu pouzdani** — vidi gore.
- **Skenirani PDF nema tekstualni sloj.** Strane se renderuju u sliku
  (PyMuPDF) i čitaju vizuelno; nejasna rešenja se seku uvećano. Sken je
  telefonski, pa su strane nakrivljene — tabela u rešenju se čita red po red od
  zaglavlja (vidi 206).
- **Server u produkciji servira `artifacts/geografija-kviz/dist/public`** iz
  `process.cwd()`; pokrenut iz drugog foldera, API radi, a stranica je bela.
- **Lokalni build iz Git Basha traži `MSYS_NO_PATHCONV=1`.** Git Bash pretvara
  `BASE_PATH=/` u Windows putanju, pa Vite u `index.html` upiše
  `src="/Program Files/Git/assets/..."`. Iz PowerShella toga nema.
- **Sintetički klikovi u jednom potezu gube izbor.** Skripta koja u petlji bez
  pauze klikne pet kružića pošalje samo poslednji (svaki klik čita stanje od
  pre prvog). Pravom dodiru prethodi osvežen prikaz; u testovima pauza između
  klikova.
- **Lokalna baza u `.env` je privremena** (Postgres pokrenut za proveru, port
  5497). Za pravi rad ide string prave baze.
- **pnpm-workspace mora da sadrži `win32-x64`**, inače se lokalno ništa ne
  pokreće (`@esbuild/win32-x64 could not be found`).

## Konvencije

- **Sav tekst u aplikaciji je srpski, ćirilica.** Bez mešanja pisama. Izuzetak
  su ono što je latinično i u knjizi: oznake strana sveta (N, S, W, E), mere
  (m, km², °C), rimski brojevi.
- Poređenje slobodno upisanih odgovora **ne izjednačava ćirilicu i latinicu** —
  na završnom ispitu se piše ćirilicom.
- **Komentari objašnjavaju *zašto*, ne *šta*.**
- Imena promenljivih i baze su engleska/latinična; samo tekst za korisnika je
  ćirilica.
- Poruke commit-a: prvi red šta, telo zašto — na srpskom.

## Šta ne dirati bez razloga

- Brojeve zadataka — to su brojevi iz zbirke i upisuju se u sačuvane pokušaje.
- Granice celina (`BLOCKS`) — upisuju se u pokušaje kao `block`.
- `SESSION_SECRET` — promena odjavljuje sve korisnike.
- Ništa što menja bodovanje pošto učenici počnu da rade.

## Otvoreno

- Nivoi po standardima: šifre standarda za geografiju nisu u skenu; bez njih se
  nivo ne unosi.
- Testovi sa prethodnih završnih ispita (`scripts/import-exam.mjs`).
