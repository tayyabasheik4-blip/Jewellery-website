JS Gold Silver Jewellery - Supabase integrated frontend

Supabase project:
URL: https://gggankmpazbqzkowwhwc.supabase.co
Region: ap-south-1 (Mumbai)

Included:
- Supabase browser client using the publishable key (safe for frontend use with RLS).
- Admin login using Supabase Auth and admin_profiles role check.
- Product/service CRUD and image uploads in site-media bucket.
- Contact form writes to contact_messages.
- Customer reviews write as pending; admin can approve/hide/delete.
- Published products and services are displayed dynamically on their relevant pages.

Before deployment:
1. Host this folder on a static web host with HTTPS (Netlify, Vercel, or your existing host).
2. In Supabase Authentication > URL Configuration, set Site URL to your deployed domain and add the domain to Redirect URLs.
3. Ensure the admin user tayyabasheik4@gmail.com exists and public.admin_profiles.role is admin.
4. Test login, product image upload, contact form and review submission.
5. Do not put a Supabase service_role or secret key in frontend files.

Important:
The site is static HTML. The Supabase JS client is loaded as ES modules from esm.sh, so hosting must allow module scripts and have internet access.
