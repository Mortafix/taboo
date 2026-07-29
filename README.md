# Taboo PWA

Gioco Taboo mobile-first costruito con React, TypeScript, Vite e Anime.js.
Funziona interamente nel browser: non richiede backend, account o servizi
esterni e salva preferenze, partite sospese e storico in IndexedDB.

## Requisiti

- Node.js `>=22.13.0`
- un server HTTPS per installazione PWA e service worker

## Sviluppo

```bash
npm install
npm run dev
```

## Verifica

```bash
npm test
npm run lint
npm run test:site
```

`npm run test:site` esegue anche la build di produzione e verifica i metadati
PWA, il manifest e il service worker.

## Pubblicazione sul proprio server

```bash
npm run build
```

Pubblicare il contenuto della cartella `dist/` nella root HTTPS scelta. La build
è composta soltanto da file statici e non richiede Node.js in produzione.

Configurazione cache consigliata:

- `index.html`, `sw.js` e `manifest.webmanifest`: `Cache-Control: no-cache`
- file con hash dentro `assets/`: `Cache-Control: public, max-age=31536000, immutable`

Il service worker precachea applicazione, database delle carte e risorse
essenziali. Gli aggiornamenti vengono applicati dall'interfaccia senza
interrompere una partita attiva.

## Database delle carte

I YAML canonici sono in `data/decks/`. Prima di ogni build
`scripts/build-decks.mjs`:

- normalizza le parole;
- impedisce duplicati globali;
- verifica le cinque parole vietate;
- genera `app/data/cards.generated.ts`.

Comandi disponibili:

```bash
npm run data:check
npm run data:import
```

`data:import` è il comando di migrazione dal vecchio PyTaboo e non va usato per
le normali modifiche editoriali.

## Struttura

- `app/components/TabooApp.tsx`: flussi e interfaccia
- `app/lib/game.ts`: reducer puro del motore di gioco
- `app/lib/storage.ts`: persistenza IndexedDB
- `app/lib/audio.ts`: effetti Web Audio
- `app/globals.css`: design system mobile
- `public/`: manifest, icone e service worker
- `tests/`: test di motore, dati e build PWA
