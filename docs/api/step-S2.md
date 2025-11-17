# Step S2 – Session & Auth API

Milestone A2 delivers the public authentication endpoints. The backend must expose signup/login/logout/logout-all/refresh flows with session persistence, hashed refresh tokens, and brute-force throttling.

## High-level rules
- Every endpoint lives under `/api/auth/*` and returns JSON (`application/json`).
- Passwords are never logged or stored in plain text. Refresh tokens are stored hashed in the database.
- Throttling: more than 5 failed login attempts per email within 10 minutes must return `429 TOO_MANY_ATTEMPTS`.
- Account status checks: `SUSPENDED` or `DELETED` accounts cannot authenticate.
- Logout endpoints revoke sessions (set `revoked_at` + optional reason).

## OpenAPI snippet (trimmed)
```yaml
paths:
  /api/auth/signup:
    post:
      summary: Register a new account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SignupRequest'
      responses:
        '201':
          description: Account created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthAccountResponse'
        '422':
          $ref: '#/components/responses/ValidationError'
        '409':
          description: Email already exists
  /api/auth/login:
    post:
      summary: Obtain access/refresh tokens
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          $ref: '#/components/responses/InvalidCredentials'
        '429':
          $ref: '#/components/responses/TooManyAttempts'
  /api/auth/logout:
    post:
      summary: Revoke current session
      responses:
        '204': { description: Session revoked }
        '404': { description: Session not found }
  /api/auth/logout-all:
    post:
      summary: Revoke all sessions for current account
      responses:
        '204': { description: Sessions revoked }
  /api/auth/refresh:
    post:
      summary: Rotate refresh token and issue new tokens
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          $ref: '#/components/responses/InvalidCredentials'
```

_See `/docs/api/openapi/step-S2.yaml` once generated for the full schema._

## Request / Response contracts
### POST `/api/auth/signup`
- Body: `{ "email": string, "password": string, "legalName": string? }`
- Validation: email trimmed & lower-cased; password 10-128 chars; legalName optional 1-200 chars.
- Response `201`: `{ "id", "email", "status", "legalName", "createdAt" }`.
- Errors: `409` when email exists, `422` for invalid payload.

### POST `/api/auth/login`
- Body: `{ "email": string, "password": string, "device": { "ip": string?, "userAgent": string? } }`
- Flow: verify credentials, check throttle, create session record with hashed refresh token, return tokens.
- Response `200`: `{ "sessionId", "accessToken", "accessTokenExpiresAt", "refreshToken", "refreshTokenExpiresAt" }`.
- Errors: `401` invalid credentials, `403` account suspended/deleted, `429` throttle triggered.

### POST `/api/auth/logout`
- Authenticated via refresh/access token header (implementation detail). Payload optional but may include `{ "sessionId": string }`.
- Success `204`. Errors: `404` unknown session, `409` already revoked.

### POST `/api/auth/logout-all`
- Revokes every active session for the current account. Always returns `204` (idempotent).

### POST `/api/auth/refresh`
- Body: `{ "refreshToken": string }`. Server hashes + matches stored session.
- On success: revoke old session and return new tokens (same shape as login).
- Errors: `401` invalid/expired token, `409` revoked session.

## Validation & Errors
- Normalize email casing before database reads/writes.
- Emit `InvalidCredentialsError` for wrong email or password (identical message).
- Emit `TooManyAttemptsError` after threshold; reset counter on successful login.
- Sessions older than their expiry must not refresh.
- Logout must be idempotent (revoking an already revoked session returns 204).

## Tests
- Signup success + duplicate email conflict.
- Login success stores session row and returns tokens.
- Login with wrong password increments attempt counter; 6th attempt yields 429.
- Suspended account cannot login.
- Refresh token rotates session (old revoked, new active).
- Logout revokes session and prevents future refresh.
- Logout-all clears all sessions for the account.

These tests must run via Vitest against the SQLite test database created per suite (see `tests/backend/support/testDatabase.ts`). Update tests whenever schema or error behavior changes.
