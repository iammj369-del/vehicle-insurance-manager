# Vehicle Insurance Manager

This is a Supabase-backed website for a vehicle insurance manager. It is focused only on Indian vehicle insurance records.

## Pages

- `register.html` - manager registration with name, mobile, email, password and confirm password.
- `login.html` - manager login with email, password and forgot-password email reset.
- `insurance.html` - vehicle type selection and registration-number search.
- `dashboard.html` - ending-date notifications and add-customer form.
- `customers.html` - customer list with search, filters, edit, mark-paid and delete actions.
- `settings.html` - admin profile photo, contact and business details.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. In Supabase Authentication, enable email/password login.
4. To test email confirmation, keep Confirm email enabled and add `http://localhost:8080/login.html` to Authentication > URL Configuration > Redirect URLs.
5. Copy your project URL and anon key into `assets/config.js`.
6. Open `register.html`, create the manager account, then confirm it from the registered email before login.

If the built-in Supabase email sender reaches its small hourly limit, configure a custom SMTP provider in Supabase.

## Local Preview

Run this command from the project folder:

```bash
node server.js
```

Then open `http://localhost:8080/register.html`.

## Data Import

When you receive the Excel sheet, export it as CSV and import it into the `vehicle_insurances` table in Supabase. Use these column names:

- `owner_name`
- `owner_mobile`
- `vehicle_type`
- `vehicle_reg_no`
- `loan_details`
- `claimed_amount`
- `payment_due_date`
- `paid_date`
- `payment_status`
- `bill_pdf_url`
- `vehicle_proof_urls`
- `customer_photo_url`

Uploaded files are stored in Supabase Storage buckets:

- `insurance-bills` for bill PDFs.
- `vehicle-proofs` for vehicle proof photos.
- `customer-photos` for customer photos.
- `admin-profiles` for admin profile photos.

Use vehicle types exactly as `car`, `auto`, `bike`, `load_van`, `truck`, `bus`, or `other`.
