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

## Šta još nedostaje

- **Nivoi po standardima.** Zbirka ih za geografiju ne piše uz zadatke; šifre
  standarda su u tabeli koja nije u skenu. Bez nje se nivo ne unosi — bilo bi
  nagađanje. Vežba se po celinama od dvadeset zadataka.
- **Testovi sa prethodnih završnih ispita** (`scripts/import-exam.mjs`).

## Posle svake dopune

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run verify:scoring
pnpm --filter @workspace/api-server run verify:tekst
```
