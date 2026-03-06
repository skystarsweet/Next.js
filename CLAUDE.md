# CLAUDE.md

This file provides guidance to AI assistants working with this Next.js codebase.

## Project Overview

This is a minimal **Next.js starter template** (Pages Router) with TypeScript. It serves as a foundational project structure to extend with features specific to your use case.

- **Framework**: Next.js 12.0.9 (Pages Router)
- **Language**: TypeScript 4.5.5
- **Runtime**: React 17
- **Package Manager**: Yarn

## Repository Structure

```
/
├── pages/
│   ├── _app.tsx          # Global app wrapper, imports global styles
│   ├── index.tsx         # Home page
│   └── api/
│       └── hello.ts      # Sample API route returning { name: 'John Doe' }
├── public/
│   ├── favicon.ico
│   └── vercel.svg
├── styles/
│   ├── globals.css       # Global CSS reset and base styles
│   └── Home.module.css   # CSS Module for the home page
├── next.config.js        # Next.js config (reactStrictMode: true)
├── tsconfig.json         # TypeScript config (strict mode, ES5 target)
├── .eslintrc.json        # ESLint config extending next/core-web-vitals
├── package.json
└── yarn.lock
```

## Development Commands

```bash
yarn dev      # Start development server (http://localhost:3000)
yarn build    # Production build
yarn start    # Start production server (run after yarn build)
yarn lint     # Run ESLint
```

## Architecture and Conventions

### Routing (Pages Router)

This project uses Next.js **Pages Router** (not the App Router). Key conventions:

- Page components live in `pages/`
- API routes live in `pages/api/`
- File-based routing: `pages/about.tsx` → `/about`
- Dynamic routes use bracket syntax: `pages/posts/[id].tsx` → `/posts/:id`

### TypeScript

- **Strict mode** is enabled — avoid `any` types
- Use `NextApiRequest` and `NextApiResponse` from `next` for API handlers
- Type API responses with generics: `NextApiResponse<{ name: string }>`
- All files should use `.ts` or `.tsx` extensions

### Styling

- **CSS Modules** for component-scoped styles (e.g., `Home.module.css`)
- **Global CSS** (`styles/globals.css`) for reset/base styles — only import in `pages/_app.tsx`
- No Tailwind, styled-components, or SCSS configured (add as needed)

### API Routes

API handlers follow this pattern:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  name: string
}

export default function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  res.status(200).json({ name: 'John Doe' })
}
```

### Component Structure

- Pages are default exports from `pages/`
- Use `next/head` for page-level `<head>` content
- Use `next/image` for optimized images
- Use `next/link` for client-side navigation

## Configuration Files

### next.config.js

```javascript
const nextConfig = {
  reactStrictMode: true,
}
module.exports = nextConfig
```

Only React Strict Mode is enabled. Add custom webpack config, environment variables, image domains, redirects, etc. here as needed.

### tsconfig.json

- `target: "es5"` — broad browser compatibility
- `strict: true` — all strict checks enabled
- `isolatedModules: true` — each file transpiled independently
- `incremental: true` — faster subsequent builds

### .eslintrc.json

Extends `next/core-web-vitals`, which includes:
- Core Next.js rules
- Core Web Vitals rules
- React Hooks rules

Run linting with `yarn lint`. Fix lint errors before committing.

## What's Not Configured (Add as Needed)

| Feature | Suggested Libraries |
|---|---|
| Testing | Jest + React Testing Library, or Vitest |
| E2E Testing | Playwright or Cypress |
| Database | Prisma, Drizzle ORM |
| Authentication | NextAuth.js |
| State Management | Zustand, Redux Toolkit, or React Context |
| UI Framework | Tailwind CSS, Chakra UI, shadcn/ui |
| Formatting | Prettier |
| Git Hooks | Husky + lint-staged |
| CI/CD | GitHub Actions |

## Environment Variables

No `.env` files are currently configured. When adding them:

- `.env.local` — local development (gitignored)
- `.env.development` — development defaults
- `.env.production` — production defaults
- Never commit secrets to version control
- Prefix browser-accessible variables with `NEXT_PUBLIC_`

## Git Workflow

- Default branch: `master`
- Feature branches should follow the pattern: `claude/<description>-<id>`
- Always run `yarn lint` before committing
- Use clear, descriptive commit messages

## Important Notes for AI Assistants

1. **Pages Router, not App Router** — This project uses `pages/` directory. Do not use `app/` directory patterns (Server Components, `use client`, `layout.tsx`, etc.) unless you explicitly migrate to the App Router.

2. **Yarn, not npm** — Use `yarn` commands. Do not run `npm install`.

3. **No testing framework** — There are no test files or test commands. Do not reference `yarn test` unless you first add a testing framework.

4. **Minimal dependencies** — Only add dependencies that are actually needed. Prefer built-in Next.js features over third-party packages.

5. **Strict TypeScript** — All code must pass TypeScript strict mode checks. Do not use `// @ts-ignore` or `any` without strong justification.

6. **CSS Modules** — Use CSS Modules for new component styles. Keep global styles minimal and only in `styles/globals.css`.
