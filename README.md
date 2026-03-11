# Kroghoppen

Kroghoppen är en enkel webbapp för barrunda i Stockholm.
Du väljer antal stopp, appen räknar fram en rutt och du checkar in längs vägen.

Sajt: https://jlindqvisttt.github.io/pub-crawl-stockholm/
Repo: https://github.com/JLindqvisttt/pub-crawl-stockholm

## Vad appen gör

- Hämtar din position via webbläsaren
- Hämtar pubar/barer från OpenStreetMap (Overpass API)
- Bygger rutter med 3, 5 eller 7 stopp
- Visar alla stopp på en karta med numrerade markörer
- Sparar din progress i localStorage

## Så använder du den

1. Öppna sidan och tillåt platsåtkomst.
2. Välj antal stopp, prisnivå och område.
3. Klicka `Starta hoppet!` eller `Slumpa rutt`.
4. Vid varje stopp klickar du `Check in här`.
5. Appen låser upp nästa stopp och uppdaterar karta + progress.

## Om knappen `Gänget`

`Gänget` är en enkel gruppfunktion för att dela rutt.

- `Skapa grupp`: appen skapar en 6-teckens kod
- `Gå med i grupp`: en annan person skriver in koden
- Gruppdata sparas i localStorage

Viktigt att känna till: nuvarande lösning är medvetet lättviktig och utan backend.
Det är alltså inte en full real-time sync mellan olika enheter på samma sätt som t.ex. Firebase eller DynamoDB-lösningar.

## Teknik

- HTML/CSS/JavaScript
- Leaflet för karta
- Overpass API för pubdata
- Nominatim för omvänd geokodning
- localStorage för sparad state

## Köra lokalt

```bash
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

## Deploy

GitHub Pages deployas via GitHub Actions vid push till `main`.

## Begränsningar i gratisversionen

- Publika API:er kan ha varierande svarstid
- Gruppfunktionen är enkel och localStorage-baserad
- Ingen inloggning och ingen serverlagrad historik

## Möjliga nästa steg

- Backend för riktig gruppsync
- Inloggning
- Favoriter och sparade rundor
- Betyg per ställe
