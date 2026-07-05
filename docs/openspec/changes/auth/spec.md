## ADDED Requirements

### Requirement: User login with email and password
The system SHALL allow users to authenticate using email and password credentials.

#### Scenario: Successful login
- **WHEN** user submits valid email and password
- **THEN** system returns access token and refresh token
- **THEN** user is redirected to dashboard (`/`)
- **THEN** auth context updates with user data and `isAuthenticated: true`

#### Scenario: Failed login - invalid credentials
- **WHEN** user submits invalid email or password
- **THEN** system returns 401 Unauthorized
- **THEN** error message "E-mail ou senha inválidos" is displayed
- **THEN** auth context remains `isAuthenticated: false`

#### Scenario: Failed login - missing fields
- **WHEN** user submits form without email or password
- **THEN** validation error "E-mail é obrigatório" or "Senha é obrigatória" is displayed
- **THEN** no API request is made

### Requirement: JWT token management
The system SHALL manage JWT access tokens and refresh tokens for session persistence.

#### Scenario: Access token stored in memory only
- **WHEN** login succeeds
- **THEN** access token is stored in React state (not localStorage)
- **THEN** refresh token is stored in localStorage

#### Scenario: Token refresh on access token expiry
- **WHEN** API request returns 401 with expired access token
- **THEN** system automatically calls refresh endpoint with refresh token
- **THEN** new access token is stored in memory
- **THEN** original request is retried with new token

#### Scenario: Refresh token rotation
- **WHEN** refresh endpoint is called
- **THEN** system returns new access token AND new refresh token
- **THEN** old refresh token is invalidated
- **THEN** new refresh token replaces old in localStorage

#### Scenario: Refresh token expiry forces re-login
- **WHEN** refresh token is expired or invalid
- **THEN** system clears all auth state
- **THEN** user is redirected to `/login`
- **THEN** `isAuthenticated` becomes `false`

### Requirement: Session persistence across browser reloads
The system SHALL restore user session on page reload using refresh token.

#### Scenario: Valid refresh token restores session
- **WHEN** page loads and refresh token exists in localStorage
- **THEN** system calls refresh endpoint automatically
- **THEN** auth context populates with user data
- **THEN** `isLoading` transitions from `true` to `false`

#### Scenario: No refresh token shows login
- **WHEN** page loads and no refresh token exists
- **THEN** `isLoading` becomes `false`
- **THEN** `isAuthenticated` is `false`
- **THEN** protected routes redirect to `/login`

#### Scenario: Invalid refresh token clears state
- **WHEN** page loads and refresh token is invalid
- **THEN** localStorage is cleared
- **THEN** `isAuthenticated` is `false`

### Requirement: User logout
The system SHALL allow users to log out and invalidate their session.

#### Scenario: Logout clears all auth state
- **WHEN** user clicks logout
- **THEN** system calls logout endpoint (if backend)
- **THEN** access token cleared from memory
- **THEN** refresh token removed from localStorage
- **THEN** auth context resets to initial state
- **THEN** user redirected to `/login`

#### Scenario: Logout invalidates refresh token server-side
- **WHEN** logout endpoint is called
- **THEN** refresh token is added to denylist (backend)
- **THEN** subsequent refresh attempts fail

### Requirement: Get current user profile
The system SHALL provide access to current user's profile data.

#### Scenario: User data available after login
- **WHEN** login succeeds
- **THEN** auth context `user` contains: id, email, username, createdAt
- **THEN** `user` object is available to all consumers via `useAuth()`

#### Scenario: User data refreshed on token refresh
- **WHEN** token refresh succeeds
- **THEN** user data is updated from `/auth/me` response

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