## ADDED Requirements

### Requirement: User login with email/username and password
The system SHALL allow users to authenticate using email or username and password credentials.

#### Scenario: Successful login
- **WHEN** user submits valid email/username and password
- **THEN** system returns access token (JWT, 15d expiry) and user data
- **THEN** user is redirected to dashboard (`/`)
- **THEN** auth context updates with user data and `isAuthenticated: true`

#### Scenario: Failed login - invalid credentials
- **WHEN** user submits invalid email/username or password
- **THEN** system returns 401 Unauthorized
- **THEN** error message "Credenciais inválidas. Verifique seu e-mail/usuário e senha." is displayed
- **THEN** auth context remains `isAuthenticated: false`

#### Scenario: Failed login - missing fields
- **WHEN** user submits form without email/username or password
- **THEN** validation error "E-mail ou nome de usuário deve ter no mínimo 3 caracteres" or "Senha é obrigatória" is displayed
- **THEN** no API request is made

### Requirement: JWT token management (Access Token only)
The system SHALL manage JWT access tokens for session persistence.
**Note:** Current implementation uses a single long-lived JWT (15 days) stored in memory + localStorage. Refresh token rotation is NOT implemented.

#### Scenario: Access token stored in memory + localStorage
- **WHEN** login succeeds
- **THEN** access token is stored in React state (memory) AND localStorage (persistence)

#### Scenario: Token validation on app load
- **WHEN** page loads and token exists in localStorage
- **THEN** system calls `/auth/me` to validate token
- **THEN** auth context populates with user data on success
- **THEN** `isLoading` transitions from `true` to `false`
- **THEN** on failure: token cleared, `isAuthenticated` becomes `false`

### Requirement: Session persistence across browser reloads
The system SHALL restore user session on page reload using stored access token.

#### Scenario: Valid token restores session
- **WHEN** page loads and token exists in localStorage
- **THEN** system calls `/auth/me` automatically
- **THEN** auth context populates with user data
- **THEN** `isLoading` transitions from `true` to `false`

#### Scenario: No token shows login
- **WHEN** page loads and no token exists
- **THEN** `isLoading` becomes `false`
- **THEN** `isAuthenticated` is `false`
- **THEN** protected routes redirect to `/login`

#### Scenario: Invalid token clears state
- **WHEN** page loads and token is invalid/expired
- **THEN** localStorage is cleared
- **THEN** `isAuthenticated` is `false`

### Requirement: User logout
The system SHALL allow users to log out and clear their session.

#### Scenario: Logout clears all auth state
- **WHEN** user clicks logout
- **THEN** access token cleared from memory and localStorage
- **THEN** auth context resets to initial state
- **THEN** user redirected to `/login`
- **NOTE:** Backend logout endpoint NOT implemented (only local cleanup)

### Requirement: Get current user profile
The system SHALL provide access to current user's profile data.

#### Scenario: User data available after login
- **WHEN** login succeeds
- **THEN** auth context `user` contains: id, username, email, kindleEmail, avatarUrl
- **THEN** `user` object is available to all consumers via `useAuth()`

#### Scenario: User profile update
- **WHEN** user updates profile via `/users/me`
- **THEN** auth context `user` is updated with new data

### Requirement: User registration
The system SHALL allow new users to register with username, email, and password.

#### Scenario: Successful registration
- **WHEN** user submits valid username (≥3 chars), email, password (≥4 chars), matching confirmPassword
- **THEN** system creates user, returns token and user data
- **THEN** user is redirected to dashboard (`/`)
- **THEN** auth context updates with user data and `isAuthenticated: true`

#### Scenario: Failed registration - duplicate email/username
- **WHEN** user submits existing email or username
- **THEN** system returns 409 Conflict
- **THEN** error message "E-mail ou usuário já cadastrado" is displayed

#### Scenario: Failed registration - invalid data
- **WHEN** user submits invalid username format, invalid email, or short password
- **THEN** validation errors displayed per field
- **THEN** no API request is made

### Requirement: Swagger/OpenAPI API Documentation (Backend)
The system SHALL provide interactive API documentation via Swagger UI.

#### Scenario: Swagger UI accessible at /api-docs
- **WHEN** user navigates to `/api-docs` on backend
- **THEN** Swagger UI loads with interactive API documentation
- **THEN** all auth endpoints are documented with request/response schemas

#### Scenario: OpenAPI schema auto-generated from Zod schemas
- **WHEN** backend routes are registered with Zod schemas
- **THEN** OpenAPI 3.0 schema is automatically generated via `jsonSchemaTransform`
- **THEN** Request/response bodies, query params, headers documented from Zod
- **THEN** Security schemes (bearerAuth) documented for protected endpoints

#### Scenario: Zod schemas serve as single source of truth
- **WHEN** Zod schema defined in dtos/ (e.g., loginSchema, registerBodySchema)
- **THEN** Same schema used for runtime validation AND OpenAPI generation
- **THEN** No manual OpenAPI YAML/JSON maintenance required
- **THEN** TypeScript types inferred from Zod schemas

---

## NOT YET IMPLEMENTED (Future Enhancements)

### Requirement: Refresh Token Rotation
- Access token: 15 minutes
- Refresh token: 7 days, stored in DB with hash, rotation on each refresh
- Refresh token invalidation on logout (server-side denylist)
- Automatic token refresh on 401 responses

### Requirement: HTTP-only Cookies
- Tokens stored in HTTP-only, Secure, SameSite=Lax cookies
- No token exposure to JavaScript (XSS protection)

### Requirement: Backend Logout Endpoint
- POST `/auth/logout` to invalidate refresh token server-side
- Add refresh token to denylist

### Requirement: Email Verification Flow
- Email verification on registration
- Resend verification email
- Verified flag on user model

### Requirement: Password Reset Flow
- Forgot password → reset token via email
- Reset password with token validation

### Requirement: Role-Based Access Control (RBAC)
- User roles (admin, user)
- Permission-based route protection