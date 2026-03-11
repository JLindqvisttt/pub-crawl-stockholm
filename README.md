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

Här är en konkret lista om du vill bygga vidare från nuvarande version.

### 1) Riktig gruppfunktion mellan mobil och dator

- Backend-API för grupper (`create`, `join`, `check-in`, `status`)
- Databas för gruppstatus och rundor
- Riktig synk mellan olika enheter

Exempel på AWS-upplägg:
- API Gateway
- Lambda
- DynamoDB

### 2) Live-läge för gruppen

- Livekarta: se var gruppmedlemmar befinner sig
- Gemensam check-in feed (vem checkade in var)
- Automatisk uppdatering utan manuell refresh

Tekniskt kan det göras med:
- WebSocket API (eller polling som enklare första steg)

### 3) Roller i gruppen

- Gruppledare som styr rundan
- Deltagare som följer och checkar in
- Möjlighet att låsa vissa val till ledaren

### 4) Omröstning och beslut i appen

- Rösta på nästa stopp
- Rösta på att korta av/förlänga rundan
- Tidsbegränsade omröstningar

### 5) Historik och statistik

- Spara tidigare rundor
- Visa vilka ställen ni besökt mest
- Gruppstatistik per kväll

### 6) Inloggning och konton

- Enkla användarkonton
- Profil med namn/avatar
- Koppla historik till användare

På AWS kan detta göras med:
- Cognito för autentisering

### 7) Förbättrad kart- och platsdata

- Smartare filtrering av ställen
- Egna taggar (musik, kö, pris, öppettider)
- Bättre fallback när ett API svarar långsamt

### 8) Kvalitet och produktionsstabilitet

- Enhetstester för ruttlogik
- Logging och felspårning
- Rate limiting och bättre felhantering i API-lagret

### 9) Nice-to-have funktioner

- Favoriter och sparade rundor
- Betyg per ställe
- Delningslänk till kvällens rutt
- Pushnotiser när nästa stopp låses upp
