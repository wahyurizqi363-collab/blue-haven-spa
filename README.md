# Blue Haven Baby & Kids Spa

A booking, cashier and growth-tracking system for a baby and kids spa. Customers reserve online, staff run the cashier, and the owner sees revenue, all in one installable web app.

Built with **PHP, MySQL and vanilla JavaScript**. No framework.

## Features

- **Online reservations** with a capacity check for every hour, so therapists are never double-booked.
- **Cashier flow** with payment methods, receipts as PDF or PNG, and a Home Care distance fee (Rp3,500 per km).
- **Loyalty program tracked per child**, with a free session after a set number of completed sessions.
- **Growth assessment** for children aged 0–18, based on WHO Child Growth Standards 2006 and WHO Growth Reference 2007, with categories from Permenkes RI No. 2/2020. Includes growth charts and PDF reports.
- **WhatsApp notifications** to the admin through the Fonnte gateway.
- **Owner dashboard** for revenue reports.
- **Progressive web app**: installable, with a service worker and manifest.

## Security

- All database access uses PDO prepared statements.
- Admin login uses a hashed password and an HMAC-signed, HTTP-only cookie that expires after 12 hours.
- Login is rate-limited to 5 failed attempts per 15 minutes.

## Project structure

```
api/          JSON endpoints: bookings, services, loyalty, growth, revenue,
              receipt, notifications, owner, settings, login
assets/       Front-end JavaScript, CSS, icons, growth reference data
schema.sql    Database schema with sample services
migrasi_*.sql One-time migrations for older installs
```

## Run it locally (XAMPP)

1. Copy this folder into `htdocs` and start **Apache** and **MySQL** in XAMPP.
2. In phpMyAdmin, import `schema.sql`. This creates the `blue_haven_spa` database.
3. Copy `config.example.php` to `config.php` and fill in your database details and a new `ADMIN_PIN`.
4. Copy `wa_config.example.php` to `wa_config.php`. WhatsApp stays off until you add a Fonnte token and set `WA_ENABLED` to `true`.
5. Create `admin_hash.php`. First generate a hash:
   ```
   php -r "echo password_hash('your-password', PASSWORD_DEFAULT);"
   ```
   Then save the file as `<?php return 'PASTE_THE_HASH_HERE';`
6. Open `http://localhost/blue-haven-spa/`.

## Screenshots

Add images to a `docs/` folder and link them here.

## Author

Muhammad Wahyu Rizqi Pratama, wahyurizqi363@gmail.com
