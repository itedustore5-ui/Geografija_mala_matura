# Stanje prepisivanja zbirke

Deo GEOGRAFIJA u zbirci ima **120 zadataka (121–240)**; uneto je **svih 120**,
sa tačnim odgovorom iz odeljka REŠENJA i kratkim objašnjenjem. Tačan broj po
celinama i tipovima ispisuje `verify:scoring`, a ako neki broj nedostaje,
navodi ga posebno:

```bash
pnpm --filter @workspace/api-server run verify:scoring
```

| Celina | Strane zbirke | Rešenja | Fajl |
|---|---|---|---|
| 121–140 | 34–38 | 164–166 | `questions/zadaci-121-140.ts` |
| 141–160 | 39–42 | 166–167 | `questions/zadaci-141-160.ts` |
| 161–180 | 42–48 | 167–168 | `questions/zadaci-161-180.ts` |
| 181–200 | 48–53 | 169–170 | `questions/zadaci-181-200.ts` |
| 201–220 | 54–58 | 170–172 | `questions/zadaci-201-220.ts` |
| 221–240 | 58–62 | 172–174 | `questions/zadaci-221-240.ts` |

## Kako je zadatak prepisan

1. Tekst zadatka sa strane iz `geografija_pitanja.pdf` (29 strana, skeniran
   telefonom, bez tekstualnog sloja — strane su renderovane u sliku i čitane
   vizuelno). Skenirano je bez rupa: strane knjige 34–62 idu redom.
2. **Tačan odgovor isključivo iz `geografija_resenja.pdf`** (strane 164–174),
   nikad iz označenih kružića u samom zadatku — primerak je delimično popunjen
   rukom (npr. 184, 186, 187, 188). Svih 120 odgovora je posle unosa još
   jednom upoređeno sa rešenjima, stranu po stranu.
3. Uputstva se prepisuju doslovno („Обој кружић испред тачног одговора.“);
   podebljano u knjizi ide između `**…**` („Обој **кружиће**…“ u 151 i 221 je
   jedini znak da se bira više odgovora).
4. Ponuđeni odgovori u dve kolone (175, 199, 223, 231, 237, 239) čitaju se red
   po red.
5. Prilozi (karte, crteži, grafikoni, piramida, klima-dijagram) isečeni su iz
   pune rezolucije skena u `artifacts/geografija-kviz/public/images/`: crteži kao
   PNG sa 16 nijansi sive, snimci karata (123, 213, 228) kao sivi JPEG.
   Linije tabele su očišćene iz sličica znakova (128) i profila terena (180).
6. Tabela protoka i vodostaja Dunava (181) prepisana je kao tekst, ne kao slika.

## Prilagođavanja modelu

Svako ima komentar iznad zadatka, sa razlogom.

| Zadatak | U zbirci | U aplikaciji | Zašto |
|---|---|---|---|
| sve tabele „обој кружић у одговарајућем пољу“ | tabela sa kružićima | `grid` (red sme imati više kružića ili nijedan) | neke tabele to traže (124, 142, 149, 168, 187, 208, 236); da su ostale `match`, učenik bi po ponašanju tabele znao gde je red prazan |
| 127, 138, 148, 162, 174 | izbor u rečenici („Србија / Шпанија“, kružić ispod pojma) | `parts` sa `inline: true` | na ekranu stoji kao u knjizi |
| 128, 181, 182, 213, 237 | zadatak sa delovima A)/B) ili 1./2. | `parts`; boduje se kad su tačni svi delovi | isti izbor, a jedan deo ne može da dobije dva kružića |
| 128, 182, 213 | zadatak počinje odmah delom „А)“ / „1.“ | zajednički zahtev je prazan, svaki deo nosi svoje uputstvo | kao u knjizi |
| 121 | slova u kvadratićima oko ruže vetrova | `fill` sa četiri polja (gore, levo, desno, dole) | uz latinično „E“ prima se i ćirilično „Е“ — na papiru je isti znak |
| 145 | „густина насељености“ | prima i „густина становништва“ | isti pojam |
| 179 | „0 m надморске висине или 0 m Н. В.“ | broj sa jedinicom, sa dopunom ili bez nje | goli broj se ne priznaje, kao ni u rešenju |
| 200 | „пун назив међународне организације“ | skraćenice (ЕУ, УН) se ne priznaju; uz „Уједињене нације“ prima i „Организација уједињених нација“ | traži se pun naziv |

## Greške i nepravilnosti u samoj zbirci

| Zadatak | Šta stoji | Šta je uneto |
|---|---|---|
| 206 | u rešenju (str. 170) tabela je odštampana pomereno za jedan red: zaglavlje ТАЧНО/НЕТАЧНО stoji uz prvu tvrdnju | čitano od zaglavlja: Т, Н, Н, Т — slaže se i sa gradivom (nafta je u Banatu, Đerdap na Dunavu) |
| 142, 149, 168, 187, 208, 236 | u rešenju jedan red bez obojenog kružića (pojam nije ponuđen) | prazan red u `grid`; ko tu nešto oboji, greši |
| 124 | u rešenju red „Приказује умањена растојања из природе“ ima oba kružića | oba polja moraju biti obojena |

## Testovi sa završnog ispita (2023–2026)

Uneta su sva četiri zvanična testa iz geografije, po 20 zadataka i 20 bodova,
120 minuta: `src/data/exams/zavrsni-2023.ts` … `zavrsni-2026.ts`. U studiji su
to forme merenja — istraživač na strani „Студија“ veže forme A, B i C za tri
od njih.

| Test | Školska godina | Tipovi zadataka | Pola boda moguće |
|---|---|---|---|
| `zavrsni-2023` | 2022/2023 (jun) | 12 izbor, 4 tabele, 4 tačno/netačno | 7 zadataka |
| `zavrsni-2024` | 2023/2024 (jun) | 18 izbor, 1 tabela, 1 tačno/netačno | 2 |
| `zavrsni-2025` | 2024/2025 | 8 izbor, 7 tačno/netačno, 4 tabele, 1 više odgovora | 11 |
| `zavrsni-2026` | 2025/2026 | 18 izbor, 1 tabela, 1 više odgovora | 1 |

Kako je prepisano:

1. Izvori stoje u `zavrsni_testovi/` (test i „Упутство за прегледање“ za
   svaku godinu) i **nisu u gitu**: na svakoj strani piše da se testovi ne
   smeju umnožavati ni javno objavljivati bez saglasnosti Zavoda.
2. PDF-ovi imaju tekstualni sloj, ali on ne prati uvek raspored na strani (u
   2023/2 daje „језеро, пећина, бања“, a na strani piše „језеро, бања,
   пећина“). Redosled je uzet sa strane, tekst iz sloja; skripta je proverila
   da svaka ponuđena stavka, tvrdnja i red tabele postoji u PDF-u.
3. Tačni odgovori i pravila bodovanja isključivo iz uputstva za pregledanje.
   Tabele u uputstvu su proverene i vizuelno — redosled ●/○ u tekstualnom
   sloju ne mora da prati kolone.
4. Slike (2023/2, 2024/20, 2026/14, 2026/17) izvučene su iz PDF-a u punoj
   rezoluciji: `public/images/zi-<godina>-<zadatak>`.

**Bodovanje.** Sva četiri uputstva imaju isto pravilo: zadatak nosi najviše
1 bod, svaki odgovor koji se razlikuje od rešenja 0, a 0,5 bodova samo gde je
predviđeno (`halfPoint`) — kad je tačno sve osim jedne stavke, a ta stavka je
ostavljena prazna („тачна два одговора и ниједан нетачан“). Dve tačne i jedna
pogrešna tvrdnja nose 0. Kod zadataka sa dva tačna odgovora (2025/20,
2026/19) pola boda ne postoji. `verify:exams` za svaki zadatak proverava oba
slučaja: jedna prazna stavka i jedna pogrešna.

Prilagođavanja (komentar uz zadatak):

| Zadatak | Šta | Kako |
|---|---|---|
| 2023/11, 2023/17, 2026/6 | ponuđeni odgovori u dve kolone | čitani red po red, kao u zbirci |
| 2024/8 | u PDF-u „морe je“ sa latiničnim e i j | uneto ćirilicom |
| 2026/17 | „кординатама“ | ostavljeno kako stoji u testu |

**Preklapanje sa zbirkom.** Nijedan zadatak iz testova nije kopija zadatka
121–240. Najsličniji parovi (2025/13 i zbirka 192, 2023/9 i 166, 2024/10 i
176) dele temu, ne pitanje. Za studiju to znači da testovi mere prenos znanja
iz iste oblasti, a ne pamćenje odgovora iz vežbanja.

## Šta još nedostaje

- **Nivoi po standardima.** Zbirka ih za geografiju ne piše uz zadatke; šifre
  standarda su u tabeli koja nije u skenu. Bez nje se nivo ne unosi — bilo bi
  nagađanje. Vežba se po celinama od dvadeset zadataka.

## Posle svake dopune

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run verify:scoring
pnpm --filter @workspace/api-server run verify:exams
pnpm --filter @workspace/api-server run verify:tekst
```
