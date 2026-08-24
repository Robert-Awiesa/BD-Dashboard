# Running the test suites

**The suites delete whole collections.** They start by wiping every record in
the collections they touch so they can assert on exact counts. Run one against
the live database and it destroys real data — and the live database is the same
MongoDB Atlas cluster the Render deployment serves.

This has happened. Do not skip this file.

## The rule

A suite may only talk to a backend whose database name ends in `_test`.
Every suite imports `guard.py`, which reads `/api/health` and exits with a
non-zero status before making any other call if that is not the case.

`/api/health` reports `databaseName` for exactly this reason. Do not remove it.

## The two stacks

|          | live (your real data)     | test (throwaway)               |
| -------- | ------------------------- | ------------------------------ |
| database | `bd_workspace`            | `bd_workspace_test`            |
| backend  | `localhost:5001`          | `localhost:5002`               |
| frontend | `localhost:5173`          | `localhost:5175`               |

Start the live stack as usual:

```bash
cd Server && npm run dev          # 5001 -> bd_workspace
cd workspace && npm run dev       # 5173 -> proxies to 5001
```

Start the test stack alongside it:

```bash
cd Server && MONGODB_DB_NAME=bd_workspace_test PORT=5002 DISABLE_CRON=true node server.js
cd workspace && BD_API_TARGET=http://localhost:5002 npx vite --port 5175 --strictPort
```

`BD_API_TARGET` is read by `workspace/vite.config.js` and decides which backend
the dev server proxies `/api` and `/uploads` to. It defaults to 5001, so the
normal dev command is unchanged.

`DISABLE_CRON=true` keeps the 07:00 reminder sweep from firing on the test
backend; the suites call `evaluateReminders()` themselves when they need it.

## Subprocesses

Some suites spawn `node -e` to call `evaluateReminders()` directly rather than
over HTTP. Those inherit the shell environment and would otherwise read `.env`
and connect to the live database — reading the wrong data *and writing
reminders into it*. They pass `env=TEST_ENV`, which pins
`MONGODB_DB_NAME=bd_workspace_test`. `dotenv` does not override variables that
are already set, so the pin wins.

Any new suite that shells out to Node must do the same.

## Running them

Suites live in the session scratchpad, not in the repo. With both stacks up:

```bash
python api_tenders.py       # API-level checks
python smoke_tenders.py     # browser checks via Playwright
python audit_render.py      # every module and tab renders without console errors
python check_drift.py       # server enums match the frontend's shipped constants
```

If a suite prints `REFUSING TO RUN`, the test backend is not up or is pointed at
the wrong database. Fix that rather than bypassing the guard.
