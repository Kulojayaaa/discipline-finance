# Finance App

Production-ready personal finance app built with Vite, React, TypeScript, Zustand, Supabase, PWA support, and Capacitor Android.

## Features

- Supabase Auth with email/password and email magic-link login
- Protected routes and persisted sessions
- Accounts, categories, transactions, budgets, EMIs, bills, and savings goals
- Two-row transfer ledger entries, account balance recalculation, EMI schedules, budget usage, and savings goal contributions
- Supabase realtime sync for finance tables
- PWA manifest and service worker
- Capacitor Android project with internet permission, app icon, and splash assets

## Web Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

3. Start the app:

   ```sh
   npm run dev
   ```

4. Build for production:

   ```sh
   npm run build
   ```

## Supabase Setup

Apply all SQL migrations in `supabase/migrations/` in filename order. With the Supabase CLI:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
```

Then reload the PostgREST schema cache:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

The finance schema includes RLS policies scoped by `user_id = auth.uid()`, realtime coverage for ledger tables, balance recalculation triggers, EMI schedule support, and compatibility columns requested for production finance tracking.

## Android Setup

Capacitor is already initialized with:

- App ID: `com.finance.app`
- App name: `Finance App`
- Web directory: `dist`

Useful commands:

```sh
npm run build
npx cap sync android
npx cap open android
```

This repo also includes npm shortcuts:

```sh
npm run android:sync
npm run android:open
```

If Gradle cannot find the Android SDK, create `android/local.properties`:

```properties
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```

## Release APK

Unsigned release build:

```sh
cd android
.\gradlew.bat assembleRelease
```

The unsigned APK is written to:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

For a signed APK, create a keystore in Android Studio or with `keytool`, then copy `android/keystore.properties.example` to `android/keystore.properties` and fill in the keystore path/passwords. After that:

```sh
cd android
.\gradlew.bat assembleRelease
```

Android Studio path: **Build -> Generate Signed Bundle / APK**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production web build |
| `npm run lint` | ESLint checks |
| `npm run android:sync` | Build web and sync Android assets |
| `npm run android:open` | Open Android Studio project |

