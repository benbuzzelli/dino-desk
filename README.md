# Dino Desk

A dinosaur-themed laptop skills game for 2–4 year olds, built with React, TypeScript, Vite, and HTML5 Canvas.

## Prerequisites

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (required by Vite 8)
- npm (comes with Node)

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (usually http://localhost:5173). Code changes hot-reload in the browser.

## Other scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run build`   | Type-check and build a production bundle to `dist/` |
| `npm run preview` | Serve the built `dist/` locally to test it         |
| `npm run lint`    | Run ESLint                                         |

## Project layout

- `src/components/` – app shell, valley map, sticker book, quest overlay
- `src/games/` – individual mini-games plus shared canvas, input, and sprite code
- `src/ui/` – shared UI primitives
- `public/` – static assets served as-is

Progress is saved in the browser's `localStorage`, so clearing site data resets it.
