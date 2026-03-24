# Life Operating System

Personal planning app for aligning vision, goals, projects, and daily execution.

## Features

- Dashboard with key-area progress and daily alignment
- Goals with sub-goals, attachments, and auto-completion from child tasks
- Projects with key-area tags, sorting, and focused edit state
- Key areas page with linked project/goal progress and attachments
- Autosave + manual save status indicators
- Import/export backups
- IndexedDB persistence (Dexie-backed normalized schema) with explicit migration + rollback support
- OpenGraph image generation for social previews

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- HeroUI + Tailwind CSS v4 + Framer Motion
- Dexie (IndexedDB)

## Run Locally

Requirements:

- Node.js 20+

Install and run:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run start
```

## Data Storage Notes

- Primary storage is IndexedDB in the browser.
- Legacy single-key localStorage payloads are migrated into normalized tables.
- Migrations are explicit in the UI, atomic (transactional), and reversible (rollback backup is stored).

## Attachment Notes

- URL attachments (`https://`, `http://`, `data:`) open directly.
- Local file references (`file://`, `local-file://`, and absolute paths) are opened on best effort.
- Browser security can block local file opening depending on permissions/pop-up settings.
