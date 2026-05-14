# AGENTS.md

## Project Identity

This is a production-oriented Liax-Space publishing system.

It is not a temporary demo.

The project includes:

- Public blog pages
- Admin dashboard
- Authentication
- Email verification
- Role-based permissions
- Article editor
- Tags
- Comments
- Moments
- Guestbook
- Contact page
- Site settings
- Analytics dashboard
- Local MySQL database
- Beautiful responsive UI
- Smooth animations
- Strict file organization

Prioritize:

- Correctness
- Maintainability
- Security
- Visual quality
- Clear file structure
- Server-side permission checks
- Database-backed features
- Successful build

## Tech Stack

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style primitives
- Motion / Framer Motion
- Lucide React
- Prisma ORM
- MySQL
- Zod
- Nodemailer
- bcryptjs
- Tiptap
- Recharts

## Engineering Rules

- API routes should be thin.
- Business logic goes into feature services.
- Validation goes into validators.
- Permission logic goes into src/lib/permissions.ts.
- Database client goes into src/lib/db.ts.
- Mail logic goes into src/lib/mail.ts.
- Large components should be split.
- Avoid files over 250 lines unless justified.
- Avoid duplicate code.
- Avoid hardcoded secrets.
- Avoid frontend-only permission checks.
- Avoid fake data in final implementation.
- Keep every stage as close to buildable as possible.
- If a build/typecheck/lint/schema check fails, fix it before continuing.

## Required Commands

Run when possible:

- npm.cmd run lint
- npm.cmd run typecheck
- npm.cmd run build
- npx.cmd prisma validate
- npx.cmd prisma format

If database is configured:

- npx.cmd prisma migrate dev
- npx.cmd prisma db seed

## Debug Protocol

When an error occurs:

1. Identify the exact failing command or behavior.
2. Classify the error.
3. Locate the likely file.
4. Explain the root cause.
5. Patch the code.
6. Re-run the relevant check.
7. Record the issue in docs/debug-log.md.

## Progress Logging

Update docs/progress.md after every meaningful stage.

## Assumption Logging

If a requirement is unclear, make a reasonable engineering decision and record it in docs/assumptions.md.

Do not block on minor uncertainty.

## Definition of Done

A stage is done only when:

- Required files exist.
- Code compiles or the blocking reason is documented.
- Database flow is connected when applicable.
- Server-side permission checks exist when applicable.
- UI has loading, empty, and error states when applicable.
- Zod validation exists for important forms and APIs.
- Relevant docs are updated.
- Relevant commands have been run or skipped with a clear reason.

The whole project is done only when:

- App can start.
- Prisma validates.
- Database migration works when database is available.
- Seed works when database is available.
- User can register.
- Email verification path exists.
- User can log in.
- Admin can access dashboard.
- Admin can create and edit articles.
- Published articles show on the public site.
- Article visibility works.
- Comments work.
- Moments work.
- Guestbook works.
- Settings are editable.
- Analytics dashboard shows database-backed data.
- Build passes.
