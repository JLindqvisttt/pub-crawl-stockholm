# 🍺 Stockholm Pub Crawl App

En interaktiv pub crawl-app för Stockholm som hjälper dig att hitta och navigera mellan barer i staden!

## 🎯 Funktioner

### ✅ Implementerat (Version 1.0 - Gratis APIs)

- **📍 Platsbaserad sökning**: Använd GPS eller ange adress manuellt
- **🎲 Anpassningsbara rutter**: Välj mellan 3, 5 eller 7 pubar
- **💰 Prisfiltrering**: Filtrera efter prisnivå (budget, medium, alla)
- **📍 Områdesfilter**: Välj specifika stadsdelar (Södermalm, Vasastan, etc.)
- **🗺️ Interaktiv karta**: Visar rutt till nästa pub med OpenStreetMap
- **✓ Check-in system**: Check-in vid varje pub för att låsa upp nästa
- **📊 Framstegsmätare**: Se hur långt du kommit i din crawl
- **👥 Group Mode**: Skapa eller gå med i gruppkrawl med delad kod
- **💾 Auto-save**: Sparar din progress i webbläsaren

### 🔧 Teknisk Stack (Nuvarande)

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Map**: Leaflet.js med OpenStreetMap
- **Place Search**: Overpass API (OpenStreetMap data)
- **Geocoding**: Nominatim OSM API
- **Routing**: Haversine distance calculation
- **Storage**: LocalStorage för state och group mode

## 🚀 Kom igång

### Snabbstart (Lokal testning)

1. **Öppna appen**:
   ```bash
   cd projects/pub-crawl-app
   open index.html
   ```
   
   Eller starta en lokal server:
   ```bash
   python3 -m http.server 8000
   # Gå till http://localhost:8000
   ```

2. **Tillåt platåtkomst** när webbläsaren frågar (för GPS)

3. **Välj dina inställningar**:
   - Antal pubar (3, 5, eller 7)
   - Prisnivå
   - Område (valfritt)

4. **Starta din crawl!** 🎉

### 📱 Bäst på mobil

Appen är designad mobile-first och fungerar bäst på smartphones. Lägg till på hemskärmen för en app-liknande upplevelse:

**iPhone**: Safari → Dela → Lägg till på hemskärmen
**Android**: Chrome → Meny → Lägg till på startskärmen

## 🎮 Hur man använder

### Solo Mode

1. **Ange plats**: Tryck "Använd GPS" eller skriv in en adress
2. **Välj inställningar**: Antal stopp, prisrange, område
3. **Starta crawl**: Appen hittar och optimerar en rutt
4. **Navigera**: Se karta och distans till nästa pub
5. **Check-in**: Tryck "Check in" vid varje pub för att låsa upp nästa
6. **Fira**: Slutför alla stopp! 🎉

### Group Mode 👥

**Skapa en grupp:**
1. Tryck "👥 Group Mode"
2. Välj "Skapa grupp"
3. Dela 6-siffriga koden med vänner
4. Starta crawlen som vanligt

**Gå med i grupp:**
1. Tryck "👥 Group Mode"
2. Välj "Gå med i grupp"
3. Ange gruppkoden
4. Se rutten och gruppens progress

## 🔄 Uppgradera till AWS

För produktionsbruk med bättre prestanda och funktioner, uppgradera till AWS Location Service:

### AWS Services som behövs

```bash
# 1. Skapa AWS Location Service resources
aws location create-place-index --index-name stockholm-pubs
aws location create-route-calculator --calculator-name pub-routes
aws location create-map --map-name pub-crawl-map

# 2. Skapa Cognito User Pool (för autentisering)
aws cognito-idp create-user-pool --pool-name pub-crawl-users

# 3. Skapa API Gateway + Lambda (för backend)
```

### Miljövariabler (.env)

Skapa en `.env` fil:

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=eu-north-1

# AWS Location Service
AWS_PLACE_INDEX=stockholm-pubs
AWS_ROUTE_CALCULATOR=pub-routes
AWS_MAP_NAME=pub-crawl-map

# Cognito (för group mode)
COGNITO_USER_POOL_ID=eu-north-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxx
```

### AWS Fördelar

- ✅ **Snabbare platsökning** med dedikerade AWS-servrar
- ✅ **Bättre routing** med Amazon Location Service
- ✅ **Real-time sync** för group mode med DynamoDB
- ✅ **Autentisering** med Cognito
- ✅ **Analytics** med CloudWatch
- ✅ **Högre API-gränser** och tillförlitlighet

## 📐 Hur appen fungerar

### Platsökning (Overpass API)

Appen söker efter:
- `amenity=bar`
- `amenity=pub`
- `amenity=nightclub`

Inom 2km från din position.

### Rutt-optimering

Använder en "greedy" algoritm:
1. Börja från din position
2. Välj närmaste pub (minst 100m från föregående)
3. Upprepa tills du har valt antal stopp
4. Beräkna distans och gångtid mellan varje stopp

### Distansberäkning

Haversine-formel för exakta avstånd mellan koordinater:
- Gånghastighet: ~80m/min
- Max distans mellan stopp: ~2km

## 🛠️ Utveckling

### Projektstruktur

```
pub-crawl-app/
├── index.html       # Huvudstruktur och UI
├── styles.css       # Mobile-first styling
├── app.js          # All logik och API-integration
└── README.md       # Denna fil
```

### Anpassa

**Ändra sökradie:**
```javascript
// I app.js, hitta findPubs()
const radius = 2000; // Ändra till önskad radie i meter
```

**Lägg till fler filter:**
```javascript
// I app.js, lägg till i Overpass query
node["amenity"="restaurant"]["cuisine"="international"](around:${radius},${lat},${lng});
```

**Ändra gånghastighet:**
```javascript
// I app.js, optimizeRoute()
pub.walkingTime = Math.ceil(pub.distanceFromPrevious / 80); // 80m/min
```

## 🐛 Troubleshooting

### GPS fungerar inte
- ✅ Tillåt platåtkomst i webbläsaren
- ✅ Använd HTTPS (GPS kräver säker anslutning)
- ✅ Prova manuell adress istället

### Inga pubar hittas
- ✅ Kontrollera att du är i/nära Stockholm
- ✅ Öka sökradien i koden
- ✅ Ta bort områdesfilter
- ✅ Prova "Alla" prisrange

### Kartan laddas inte
- ✅ Kontrollera internetanslutning
- ✅ Leaflet CDN kan vara blockerat - kontrollera nätverk

### Group mode synkar inte
- ✅ Använd samma webbläsare/enhet
- ✅ LocalStorage kan vara full - rensa data
- ✅ För real-time sync, uppgradera till AWS med DynamoDB

## 📊 API-begränsningar (Gratis version)

### Overpass API
- **Limit**: Ingen officiell gräns, men var schysst
- **Rekommendation**: Vänta 10 sek mellan sökningar
- **Timeout**: 25 sekunder per query

### Nominatim (Geocoding)
- **Limit**: 1 request/sekund
- **Usage Policy**: Max 1 request per användarsession för geocoding

**Tips**: För produktion, byt till AWS Location Service eller Mapbox.

## 🚀 Deployment

### Enkel hosting (Netlify/Vercel)

```bash
# 1. Push till GitHub
git init
git add .
git commit -m "Initial pub crawl app"
git push

# 2. Connecta till Netlify/Vercel
# 3. Deploy från root-katalog
```

### AWS S3 + CloudFront (Som ditt andra projekt)

```bash
# Skapa S3 bucket
aws s3 mb s3://stockholm-pub-crawl

# Synka filer
aws s3 sync . s3://stockholm-pub-crawl --exclude ".git/*"

# Skapa CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name stockholm-pub-crawl.s3-website.eu-north-1.amazonaws.com \
  --default-root-object index.html
```

## 📝 TODO / Framtida funktioner

- [ ] PWA support (offline-läge)
- [ ] Push-notifikationer vid nästa destination
- [ ] Rating-system för pubar
- [ ] Foton från varje pub
- [ ] Delningsfunktion (dela din rutt)
- [ ] Historik över tidigare crawls
- [ ] Achievements/badges system
- [ ] Integration med öppettidsdatabas
- [ ] Väder-integration
- [ ] Uber/Bolt-integration för hemresa

## 🤝 Bidra

Förslag på förbättringar? Öppna en issue eller pull request!

## 📄 Licens

MIT License - Använd fritt!

## 🙏 Tack till

- OpenStreetMap för kartdata
- Leaflet.js för kartbibliotek
- Overpass API för platsdata
- Alla Stockholms barer! 🍺

---

**Byggd med ❤️ för Stockholm**

Skål! 🍻
