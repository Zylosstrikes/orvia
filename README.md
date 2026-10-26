# Orvia — mobile-first keyless search (PWA)
Run: `npm start` (or `node server.js`) → http://localhost:3000 (PORT env optional). Node 18+, no npm deps.
Screens (SPA, back works): / Home · /search · /results?q=&tab=web|images|news · /ai (Pulse threads) · /activity · /notifications. Drawer via ☰.
Sources: Bing (web/images/news scraped server-side), DuckDuckGo (autocomplete, instant answers), Open-Meteo (weather), OSM Nominatim (reverse geocode).
Pulse = extractive summary of real results with numbered citations (no generative model).
All user data in localStorage (orvia_*). Demo seeding: /?seed=1&go=/activity (&drawer=1).
Shortcuts: / search, a Pulse, Esc close.
