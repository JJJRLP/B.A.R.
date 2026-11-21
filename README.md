# Barra · Registro de ventas y pagos

A simple web app for a bar to log every sale and its payment proof, so payments stop living only in WhatsApp.
Built from the MVP PRD: Next.js + Tailwind on the front, Supabase (Postgres, Auth, Storage) behind it.

## Features (MVP)

- **Puerta / Barra**: the sale screen switches between entrance fees (General, VIP… with +/− counters) and bar products. One sale can include both; each device remembers its last mode.
- **Entry setup** (admin, in Productos): for each entry tier set the price, whether it is always paid, free until a set hour (e.g. free until 23:00, then Bs 30) or always free, and an optional limit per night. The door shows remaining spots and blocks sales once a tier is full. Prices and limits are enforced again in the database.
- **Nueva venta**: tap products, adjust quantities, choose the payment method (QR/transfer, cash, card). For QR, upload or paste (Ctrl+V) the WhatsApp screenshot and type the reference number.
- **Automatic warnings**: amount ≠ total, and possible duplicate proof (same reference or same image).
- **Pendientes** (admin): QR payments wait here until someone checks the bank app and marks them *Verificado* or *Rechazado* (with a reason).
- **Ventas**: list with date, method and status filters; open a sale to see items and proof; admin can void a sale with a reason. Staff only see their own sales for the current business day.
- **Cierre del día** (admin): door vs bar totals with the number of people who paid entry, totals by method, by product and **by staff member**, pending/rejected counts, a cash count with the difference, and CSV export.
- **Actividad** (admin): an audit log of who registered, verified, rejected or voided each sale, for how much and when. Filter by date, person and action; export to CSV. Each sale's detail also shows its own history.
- **Productos** and **Equipo** (admin): manage products/prices and staff roles.

A sale's *business day* rolls over at 06:00 La Paz time, so after-midnight sales count for the night before.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys the app runs in **demo mode**: two fixed users (admin and staff), and all data stays in that browser's localStorage. Use it to try the flows.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql` (tables, row level security, RPCs, storage bucket). Optionally run `supabase/seed.sql` for sample products and entry types. If you ran an older `schema.sql`, run the files in `supabase/migrations/` that came after it, in order (`002_entry_fees.sql`, then `003_entry_setup.sql`).
3. Copy `.env.example` to `.env.local` and fill in **Project Settings → API**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Create users in **Authentication → Users → Add user** (tick *Auto confirm user*). Each new user gets a `staff` profile automatically.
5. Promote the owner to admin once, in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'owner@example.com');
   ```
   After that, roles can be changed from the **Equipo** screen.
6. Restart `npm run dev`.

## Deploy

Push to GitHub and import the repo in [Vercel](https://vercel.com). Add the two `NEXT_PUBLIC_SUPABASE_*` variables in the Vercel project settings.

## Project structure

```
supabase/schema.sql        tables, RLS policies, create_sale + check_duplicate RPCs, storage bucket
supabase/seed.sql          sample products
src/lib/data/api.ts        the data interface the UI uses
src/lib/data/supabase.ts   Supabase implementation
src/lib/data/demo.ts       localStorage demo implementation
src/app/(app)/             screens: sale (/), ventas, pendientes, cierre, productos, equipo
src/components/            app shell, UI primitives, sale detail / proof viewer
```

## Security notes

- Every table has row level security. Staff can create sales (only through the `create_sale` RPC, which computes totals from current prices) and read their own sales for the day. Only admins verify, void and manage products and team.
- Proof images live in a private bucket and are shown through 5-minute signed URLs.
- Sales and payments are never deleted: voids and verifications record who did them and when.

## Not in the MVP

Split payments, open tabs, stock tracking, OCR on receipts, and automatic payment verification (Libélula gateway or a direct bank API). See the PRD's "Future iterations" section.
