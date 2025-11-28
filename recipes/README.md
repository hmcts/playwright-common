# Recipes

Practical examples showing how to wire resilience features (circuit breaker + retry) with Playwright fixtures.

## Backend ApiClient with circuit breaker and retry

See `backend-client-example.ts` for a minimal setup you can drop into your project. It demonstrates:

- Creating a shared `ApiClient` with a circuit breaker enabled
- Using advanced retry (`isRetryableError`) for transient failures
- Emitting telemetry from the `onError` hook
- Attaching redacted API calls into Playwright reports

Usage notes:
- Set `BACKEND_BASE_URL` in your environment to point at the service under test
- You can tune breaker thresholds and retry attempts via options/env
- In CI, prefer `includeRaw=false` to keep raw payloads out of artefacts
