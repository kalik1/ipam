# IPAM Frontend

Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + react-router-dom 7 + axios.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend at `http://localhost:3000` (API base path `/api/v1`).

Default login: `admin` / `admin`.

## Scripts

- `npm run dev` - start the dev server on port 5173
- `npm run build` - type-check (`tsc -b`) and build for production
- `npm test` - run vitest unit tests
- `npm run preview` - preview the production build
