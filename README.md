# Taboo PWA

Gioco Taboo mobile-first costruito con React, TypeScript, Vite e Anime.js.
Funziona interamente nel browser: non richiede backend, account o servizi
esterni e salva preferenze, partite sospese e storico.

## Database delle carte

I YAML canonici sono in `data/decks/`.  
Prima di ogni build `scripts/build-decks.mjs`:

- normalizza le parole;
- impedisce duplicati globali;
- verifica le cinque parole vietate;
- genera `app/data/cards.generated.ts`.
