
# Step S3 – Password Reset & Account Deletion API

Milestone A3 handles password reset flows (request + confirm) and self-service account deletion with guard rails.

## Scope
- Password reset request: issues a time-bound token (one-time use) and sends email (email sending stub for now).
- Password reset confirm: verifies token, sets a new password hash, revokes all sessions.
- Account deletion: soft-deletes account (status `DELETED`) after confirming password and ensuring deletion guard passes (e.g., no workspace ownership).

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/password-reset/request` | Generate reset token for given email. |
| `POST` | `/api/auth/password-reset/confirm` | Complete password reset using token. |
| `POST` | `/api/auth/delete` | Delete current account (requires password + guard). |

## OpenAPI (excerpt)
```yaml
paths:
  /api/auth/password-reset/request:
    post:
      summary: Request password reset token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email:
                  type: string
                  format: email
      responses:
        '202': { description: Token issued (email sent or noop) }
  /api/auth/password-reset/confirm:
    post:
      summary: Confirm password reset
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token, newPassword]
              properties:
                token: { type: string }
                newPassword: { type: string, minLength: 10, maxLength: 128 }
      responses:
        '200': { description: Password updated }
        '400': { description: Invalid or expired token }
  /api/auth/delete:
    post:
      summary: Delete current account
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [password]
              properties:
                password: { type: string }
      responses:
        '204': { description: Account deleted }
        '401': { description: Invalid credentials }
        '409': { description: Deletion blocked by guard }
```

## Validation rules
- Password reset request:
  - Email normalized (trim/lowercase).
  - Always respond `202` to avoid user enumeration.
  - If account exists and status is `ACTIVE`, create token row with 30-minute expiry; limit one active token per account (revoke previous).
- Password reset confirm:
  - Token hashed and matched; if not found or expired/used, return `400`.
  - Requires `newPassword` 10-128 chars; updates account password hash, revokes all sessions, marks token as used (`used_at = now`).
- Account deletion:
  - Authenticated; validate current password.
  - Invoke deletion guard (pluggable) to ensure account can be deleted (e.g., not owning workspace). Guard returns boolean or throws reason.
  - On success: set account status `DELETED`, null out recovery info, revoke all sessions.

## Data model additions
- `PasswordResetToken`: `id`, `account_id`, `token_hash`, `expires_at`, `used_at`, `created_at`.
- Index token hash for lookup; cascade delete on account removal.

## Errors
- `InvalidResetTokenError`: token missing/expired/used.
- `AccountDeletionBlockedError`: guard fails (message from guard).
- `InvalidCredentialsError`: wrong password when deleting account.

## Tests
- Request reset returns 202 and stores token when account exists; no token stored when account absent.
- Confirm reset updates password, revokes sessions, cannot reuse token.
- Expired token -> error.
- Deletion with wrong password -> error.
- Deletion guard failing -> error.
- Successful deletion sets status `DELETED` and revokes sessions; subsequent login blocked.

> Implementation note: Email delivery will be added later; for now, token string should be returned from service (not API) for testing/logging only.
