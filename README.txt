JS GOLD & SILVER JEWELLERY POLISH — Complete Website (Frontend + Admin Panel + Supabase Backend)

PAGES
  index.html, collection.html, services.html, about.html, contact.html, reviews.html
  admin.html  -> Admin panel (login via Supabase Auth)

WHAT THE ADMIN PANEL DOES (admin.html)
  - Products: add / edit / delete, image upload, publish or hide, display order
  - Services: add / edit / delete, image upload, publish or hide
  - Reviews: customers submit -> "Pending"; admin Approves / Hides / Deletes
  - Messages: contact-form messages arrive here; set status new / read / replied / archived
  Everything is stored in Supabase, so changes are live for ALL visitors on all devices.

HOW TO RUN LOCALLY
  The site uses ES modules, so do NOT double-click index.html (file:// blocks modules).
  Open a terminal in this folder and run:
      py -m http.server 8000        (Windows)
      python3 -m http.server 8000   (Mac/Linux)
  Then open http://localhost:8000    (admin: http://localhost:8000/admin.html)
  Internet is required (Supabase + esm.sh).

HOW TO PUBLISH
  Upload the whole folder to Netlify / Vercel / Cloudflare Pages / any HTTPS static host.
  Then in Supabase > Authentication > URL Configuration set Site URL = your domain
  and add it to Redirect URLs.

DATABASE
  Project: https://gggankmpazbqzkowwhwc.supabase.co
  If tables are missing, run supabase_schema.sql in the Supabase SQL Editor (safe to re-run).
  Admin user: tayyabasheik4@gmail.com must exist in Auth AND in public.admin_profiles with role 'admin'.
  Never put a service_role / secret key in any file here.

CONTACT & REVIEW FORMS
  Contact form: opens WhatsApp (923214877351) AND saves the message in the admin Messages tab.
  Review form: saved as pending in Supabase; appears on the site after admin approval.
