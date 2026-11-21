# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner / manager (Administrador)** of a bar or nightclub. Sets up entry plans, prices and staff before opening; during and after the night reviews sales, people at the door, best sellers, promoter performance and margins; closes the night and counts cash. Works from a laptop/PC or a phone.
- **Door staff (Personal)** at the entrance, often in the dark and under pressure from a queue. Sells entries and tables (General, VIP, mesas, preventa), takes the buyer's full name and CI, and checks reservations by name or CI. Uses their own phone or a shared tablet.
- **Bar staff (Personal)**. Sells drinks and food fast during peak hours and records how each sale was paid. Uses their own phone, a shared tablet, or a PC at the bar.

## Product Purpose

DEMO is the sales and payment register for a night venue. It replaces payment proof that lived only in WhatsApp with one record of every sale: who sold what, to whom, for how much, how it was paid and when. Success means every entry and drink of the night is recorded in seconds, the door knows who is in, and the owner closes the night in minutes with numbers they trust.

## Positioning

Built for Bolivian nightlife as it actually runs: QR / bank-transfer payments shown as WhatsApp screenshots, cash and card at the bar, entries sold at the door with the buyer's name and CI, tables that include several people, free entry until a set hour, presales for future nights, and promoter (relacionador) codes. Door and bar sales live in the same record, so the owner sees people, revenue and margin for the same night in one place.

## Operating Context

- A "night" runs from 06:00 to 06:00 (La Paz time); sales after midnight belong to the night they started.
- Payments: cash, card, or QR / bank transfer. The customer sends the transfer screenshot by WhatsApp; staff may attach it and the reference number. Payments are checked in person for now; there is no bank integration yet.
- Door: entry plans with price, "entradas incluidas" (people per unit), optional per-night limit, optional free-entry hour, optional presale price; buyer name + CI required, guest names optional; reservation lookup by name or CI.
- Bar: product grid by category; optional cost per product for the margin in the daily review.
- Owner reviews: daily close (door vs bar, people, by staff, by method, by product, plans, best sellers, promoters, costs, cash count), activity log, date-range reports, CSV export.
- Used live inside dark, loud, crowded venues on phones and tablets; reviewed calmly afterwards on a laptop.

## Capabilities and Constraints

- Language: Spanish UI; currency Bolivianos (Bs).
- Roles: Administrador and Personal. Staff see only their own sales of the night; history, reports and exports are admin-only. The first account created becomes Administrador.
- Nothing is deleted: sales are voided with a reason; who and when are stored.
- Stack: Next.js + Tailwind CSS + shadcn/ui + Sonner on the front end, Supabase (Postgres with row-level security, Auth, Storage) behind it.
- Intended as a product sold to many venues. **Undecided / not built yet:** multi-venue accounts (each venue with its own staff and data), billing, onboarding of a new venue. Today the app serves one venue per Supabase project.
- **Not built yet:** automatic payment verification through a bank or gateway API (awaiting bank API approval); online ticket sales and QR check-in.

## Brand Commitments

- "DEMO" is a placeholder product name for now. Final name, logo and visual identity are open.

## Evidence on Hand

- Working app with sample products and a few test sales; no real venue data yet.
- No customers, testimonials, logos, press or metrics exist. Future work must not invent them.

## Product Principles

1. **Speed at the point of sale.** A door or bar sale takes seconds, one-handed, on a phone, in the dark.
2. **One honest record.** Every sale says who did it, for whom, for how much and when; nothing silently disappears.
3. **The owner's night in one view.** People, revenue, payment methods, best sellers, promoters and margin for the same night, without spreadsheets.
4. **Fits how venues already work.** Respect WhatsApp payment proof, CI at the door, tables with several people, presales and promoters instead of forcing a foreign workflow.

## Accessibility & Inclusion

- Readable and tappable in low light and noise: large touch targets, high contrast, no information carried by color alone.
