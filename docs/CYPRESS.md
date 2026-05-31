# Cypress E2E Testing

Mekari has Cypress suites for both Next.js frontends:

- `frontend`: public user flows, authentication, learner dashboard, thread creation, AI assistant, and profile editing.
- `admin/frontend`: admin login, mentor verification, reports, action logs, alerts, and user moderation surfaces.

## First-time setup

Install dependencies in each frontend package:

```powershell
cd frontend
npm install
npm exec cypress install

cd ..\admin\frontend
npm install
npm exec cypress install
```

`cypress install` downloads the Windows Cypress runner into the local user Cypress cache. It is required before `cypress run` can launch the browser runner.

## Run User App Tests

Start the user frontend:

```powershell
cd frontend
npm run dev
```

In another terminal:

```powershell
cd frontend
npm run cypress:run
```

The default Cypress base URL is `http://localhost:3000`. Override it with `CYPRESS_BASE_URL` when testing another environment.

For the visual Cypress Test Runner with the browser preview, green checks, failures, and pending test markers:

```powershell
cd frontend
npm run cypress:visual
```

## Run Admin App Tests

Start the admin frontend:

```powershell
cd admin\frontend
npm run dev
```

In another terminal:

```powershell
cd admin\frontend
npm run cypress:run
```

The default admin Cypress base URL is `http://localhost:3100`.

To use the visual admin runner:

```powershell
cd admin\frontend
npm run cypress:visual
```

## Notes

The suites mock backend API responses with `cy.intercept()` so they can exercise UI behavior without requiring MongoDB, Redis, Gemini, email, OAuth, or the Express services to be running.

The user frontend includes `capstone-acceptance.cy.js`, whose titles match the FT and FR identifiers in the evaluation plan. FT-030 and FT-078 are intentionally marked pending because the current implementation does not yet expose the required ban action or launch CAPTCHA after message-rate limiting.

The npm scripts use `scripts/run-cypress.js` to remove `ELECTRON_RUN_AS_NODE` before Cypress starts. Some development shells set that variable globally, which otherwise prevents the visual Electron runner from opening correctly.
