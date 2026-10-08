# OpsTrack — Equipment Maintenance & Operations Platform

OpsTrack tracks facility equipment, inspections, work orders, faults, and their supporting evidence. The Next.js App Router interface uses React, TypeScript, Tailwind CSS, shadcn/ui button variants, and Recharts. Supabase provides PostgreSQL, email/password authentication, and private file storage.

## Run locally

Use Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode requires no credentials and stores edits and attachments in the current browser. It starts with 36 assets, 216 readings over six inspection periods, 25 maintenance logs, and seven faults. Clear the site's browser storage to restore the sample dataset.

From the dashboard, choose **Explore recovery case**. Pump **CP-104** fell from 88% condition in June to 62% in August. The related issue contains a synthetic photo of a bearing-seal leak. A technician replaced the bearing and seal on September 14. The September 16 inspection shows 94% condition and one hour of downtime, down from 14. Change the baseline and comparison dates to trace the decline and recovery.

Equipment, maintenance, and issue records support create, edit, search, filter, and delete. Equipment with history is protected from deletion. Attachments can be added after saving a work log or issue and must be removed before that record can be deleted. Demo uploads support JPG, PNG, WebP, and PDF up to 2 MB per file, subject to the browser storage quota. Signed-in uploads support the same formats up to 10 MB.

## Connect Supabase

1. Create a Supabase project and apply [the workspace migration](supabase/migrations/20260919000100_workspace.sql) using its SQL editor or a linked Supabase CLI project with `supabase db push`.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` to the project URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **publishable** key.
3. Enable email/password authentication and add `http://localhost:3000` and your deployment URL to the Auth redirect allowlist. Set the production URL as the Auth Site URL.
4. Restart Next.js. Use the account menu to create an account, confirm the email if required, and sign in. Each account starts with a private empty workspace.

PostgreSQL applies owner-only row-level security on every table. Composite foreign keys also enforce ownership for linked assets and evidence. Storage objects live in a private bucket under the authenticated user's ID. The app creates short-lived signed URLs on request. Sample records and local browser edits are independent of the signed-in workspace. See [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Import and reporting

Download the CSV template from **Data Import**. Signed-in users can replace the sample code with a code from their equipment register. The app accepts comma-delimited CSV and the first sheet of Excel XLSX. Files can contain up to 5,000 observations and must fit within 5 MB.

| Column | Format |
| --- | --- |
| equipment_code | Registered equipment code, case insensitive |
| date | YYYY-MM-DD or a native Excel date |
| condition | Numeric score from 0 to 100 |
| performance | Numeric score from 0 to 100 |
| downtime_hours | Decimal hours from 0 to 8,760 |
| maintenance_status | Scheduled or Completed |
| notes | Optional text up to 5,000 characters |

The preview identifies invalid values, unrecognized asset codes, and duplicate asset/date pairs. A valid batch is written in one operation. PostgreSQL enforces uniqueness and numeric constraints. The dashboard uses the latest observation newer than an asset's baseline service date. Completed maintenance logs and inspections both count as observations, with inspections taking precedence on the same day. A changed observed score below 60 shows **Out of service**. A score from 60 to below 85 shows **Needs attention**. Higher scores show **Operational**. Downtime trends sum the recorded readings by month, leaving months without readings blank.

**Reports** offers a PDF maintenance summary and CSVs for the equipment register, maintenance logs, issue register, and inspections. Filter by asset and date before downloading. Date filters apply to records with a reporting date.

## Verify and deploy to Vercel

```bash
npm test
npm run build
npm start
```

Import the repository into Vercel as a **Next.js** project with the default build and output settings. Add the two Supabase variables in the project settings before the first build. Apply the database migration before signing in to the deployment, and add the deployment URL to Supabase Auth configuration. Supabase-free deployments run in demo mode. See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

After deployment, create accounts with two test addresses and verify each account sees only its own rows and attachments. Check sign-up confirmation, the upload and signed-URL flow, and an inspection import that updates the dashboard.

The demo bearing photo was generated with built-in ImageGen using the prompt “Generate a single realistic phone photograph for a fictional industrial maintenance ticket. Tight workshop close-up of a blue centrifugal pump CP-104, with chipped blue paint on a bolted bearing housing, a small fresh amber oil streak below the bearing seal, worn gray steel mounting base, ordinary inspection flashlight lighting. Documentary evidence photo, landscape framing, no text, no people, no labels or watermark.”
