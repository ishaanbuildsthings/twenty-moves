# Auth Flow: Next.js + Supabase SSR

## Why Cookies Instead of localStorage?

```
WITHOUT SSR (traditional React SPA):
=====================================================

Browser                          Server
  |                                |
  |--- GET /dashboard ----------->|
  |                                |  Server doesn't need to know
  |<-- Empty HTML + JS bundle ----|  who you are. Same bundle for
  |                                |  everyone.
  |  [React boots up]             |
  |  [Reads JWT from localStorage]|
  |                                |
  |--- API call + JWT header ---->|  NOW the server knows who you
  |<-- User's data ---------------|  are, but only for API calls.
  |                                |
  |  [Renders UI]                 |
  |                                |
  Result: User sees blank page until JS loads and fetches data.
  localStorage works fine because the server never needs the token
  until JS is running.


WITH SSR (Next.js):
=====================================================

Browser                          Server
  |                                |
  |--- GET /dashboard ----------->|
  |    (cookies sent auto)        |  Server needs to know who you
  |                                |  are RIGHT NOW to render HTML
  |                                |  with your data. No JS has
  |                                |  run yet. Can't read localStorage.
  |                                |
  |                                |  [Reads JWT from cookie]
  |                                |  [Fetches user's data]
  |                                |  [Renders full HTML]
  |                                |
  |<-- Full HTML with data -------|
  |                                |
  Result: User sees complete page immediately.
  Cookies are the ONLY thing sent automatically with HTTP requests
  before any JS executes.
```

## The Two Tokens

```
┌─────────────────────────────────────────────────────────────────┐
│                        ACCESS TOKEN (JWT)                       │
├─────────────────────────────────────────────────────────────────┤
│ What:    Signed JSON blob with user ID, email, expiration       │
│ Lifetime: ~1 hour                                               │
│ Storage: Cookie (SSR) or localStorage (SPA)                     │
│ Sent:    On EVERY request (Authorization header or cookie)      │
│ Verified: Locally — server checks signature + exp, no DB call   │
│ Revocable: NO — valid until it expires                          │
│                                                                 │
│ Think of it as: a temporary pass that anyone can verify         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        REFRESH TOKEN                            │
├─────────────────────────────────────────────────────────────────┤
│ What:    Random opaque string (not a JWT)                       │
│ Lifetime: Long-lived (weeks/months)                             │
│ Storage: Cookie (SSR) or localStorage (SPA)                     │
│ Sent:    ONLY to Supabase's /auth/v1/token endpoint (~1x/hour) │
│ Verified: Server-side — Supabase looks it up in auth.sessions   │
│ Revocable: YES — set revoked=true in DB, instantly killed       │
│                                                                 │
│ Think of it as: the real session key that can be killed          │
└─────────────────────────────────────────────────────────────────┘
```

## Sign Up Flow

```
Browser                    Our Server              Supabase Auth
  |                           |                        |
  | 1. signUp(email, pass)    |                        |
  |----------------------------------------------->|
  |                           |                        |
  |                           |          [Hash password with bcrypt]
  |                           |          [Store in auth.users]
  |                           |          [Send confirmation email]
  |                           |                        |
  |<-----------------------------------------------|
  |  "Check your email"      |                        |
  |                           |                        |
  |  [User clicks email link]                         |
  |----------------------------------------------->|
  |                           |          [Verify token]
  |                           |          [Create session in auth.sessions]
  |                           |                        |
  |<-----------------------------------------------|
  |  Redirect to app with auth code                   |
  |                           |                        |
  |  [Supabase JS exchanges code for tokens]          |
  |  [Stores JWT + refresh token in cookies]           |
  |                           |                        |
  |--- GET / (with cookies)-->|                        |
  |                           |                        |
  |              [Proxy refreshes token if needed]     |
  |              [auth.status: has session, no User row]
  |                           |                        |
  |<-- Redirect /create-profile                        |
```

## Sign In Flow

```
Browser                    Our Server              Supabase Auth
  |                           |                        |
  | 1. signInWithPassword()   |                        |
  |----------------------------------------------->|
  |                           |          [Verify credentials]
  |                           |          [Create/update session]
  |<-----------------------------------------------|
  |  [JWT + refresh token stored in cookies]           |
  |                           |                        |
  | 2. Navigate to /          |                        |
  |--- GET / (cookies auto)-->|                        |
  |                           |                        |
  |              [Proxy reads JWT from cookie]         |
  |              [Checks expiration locally]            |
  |              [If expired: refresh w/ Supabase]     |
  |              [Updates cookies on response]          |
  |                           |                        |
  |              [(app)/layout.tsx runs]                |
  |              [caller() → auth.status]              |
  |              [getUser() → verifies with Supabase]  |
  |              [Finds User row → state: "ready"]     |
  |              [ViewerProvider wraps page]            |
  |                           |                        |
  |<-- Full HTML with data ---|                        |
```

## Request Lifecycle (Every Page Load)

```
 HTTP Request from Browser (cookies attached automatically)
          |
          v
 ┌─────────────────────────────────────────────────┐
 │              PROXY (middleware.ts)                │
 │                                                  │
 │  Runs BEFORE everything. Can read AND write      │
 │  cookies because response headers haven't been   │
 │  sent yet.                                       │
 │                                                  │
 │  1. Read JWT from cookie                         │
 │  2. Check expiration locally (no network call)   │
 │  3. If expired → refresh with Supabase           │
 │  4. Write new token to request + response cookies│
 │  5. Pass request along                           │
 └─────────────────────┬───────────────────────────┘
                       |
                       v
 ┌─────────────────────────────────────────────────┐
 │          (app)/layout.tsx (Server Component)     │
 │                                                  │
 │  Runs on the server. Can READ cookies but        │
 │  CANNOT WRITE cookies (response is about to      │
 │  start streaming — HTTP headers first, body      │
 │  second, no going back).                         │
 │                                                  │
 │  1. caller() → auth.status                       │
 │  2. Reads JWT from cookie via Supabase client    │
 │  3. getUser() → verifies with Supabase Auth      │
 │  4. Looks up User row in Prisma                  │
 │  5. If not authed → redirect /login              │
 │  6. If no profile → redirect /create-profile     │
 │  7. If ready → ViewerProvider(user) wraps page   │
 └─────────────────────┬───────────────────────────┘
                       |
                       v
 ┌─────────────────────────────────────────────────┐
 │              Page Server Component               │
 │                                                  │
 │  Can use caller() for server-side data fetching. │
 │  User info available via auth.status or by       │
 │  passing down from layout.                       │
 └─────────────────────┬───────────────────────────┘
                       |
                       v
 ┌─────────────────────────────────────────────────┐
 │              Client Components                   │
 │                                                  │
 │  Hydrate in the browser. Can use:                │
 │  - useViewer() → current user from context       │
 │  - useTRPC() + useQuery() → API calls            │
 │  - Supabase browser client → sign out only       │
 │                                                  │
 │  tRPC calls go through:                          │
 │  Browser → HTTP → route.ts → appRouter → Prisma  │
 └─────────────────────────────────────────────────┘
```

## Token Refresh Flow

```
                    Time
  ─────────────────────────────────────────────>

  |← JWT valid (1 hour) →|
  |                       |
  Request  Request  Request  Request (JWT expired!)
    ✓        ✓        ✓        |
                               v
                    ┌──────────────────────┐
                    │ Proxy detects expiry  │
                    │                      │
                    │ Sends refresh token   │
                    │ to Supabase           │
                    │       |              │
                    │       v              │
                    │ Supabase checks      │
                    │ auth.sessions DB     │
                    │       |              │
                    │  Valid? ──> New JWT   │
                    │         + New refresh │
                    │                      │
                    │ Revoked? ──> 401     │
                    │    User logged out   │
                    └──────────────────────┘
                               |
                    |← New JWT (1 hour)  →|
                    Request  Request  Request ...
                      ✓        ✓        ✓
```

## What Supabase Stores vs What We Store

```
┌─────────────────────────────────────────────────┐
│            SUPABASE (auth schema)                │
│            Managed by Supabase, not us           │
├─────────────────────────────────────────────────┤
│                                                  │
│  auth.users                                      │
│  ┌─────────┬──────────────┬──────────────┐      │
│  │ id      │ email        │ password_hash│      │
│  │ (uuid)  │              │ (bcrypt)     │      │
│  └─────────┴──────────────┴──────────────┘      │
│       |                                          │
│       | 1:many                                   │
│       v                                          │
│  auth.sessions                                   │
│  ┌─────────┬──────────┬─────────┬────────┐      │
│  │ id      │ user_id  │ refresh │revoked │      │
│  │         │          │ _token  │        │      │
│  └─────────┴──────────┴─────────┴────────┘      │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│            OUR DATABASE (public schema)           │
│            Managed by us via Prisma              │
├─────────────────────────────────────────────────┤
│                                                  │
│  public.User                                     │
│  ┌────────────┬───────────┬───────────┐         │
│  │ id         │supabaseId │ username  │         │
│  │ (cuid)     │(links to  │ firstName │         │
│  │            │ auth.users│ lastName  │         │
│  │            │ .id)      │           │         │
│  └────────────┴───────────┴───────────┘         │
│                                                  │
│  The supabaseId column is the bridge between     │
│  Supabase's auth system and our app's data.      │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Why Can't Server Components Write Cookies?

```
Normal API Route:
  [Build headers] → [Build body] → [Send everything at once]
                                          ↑
                                    Can set cookies anytime
                                    before sending


Server Component (Streaming):
  [Send headers] → [Stream body chunk 1] → [chunk 2] → [chunk 3]...
        ↑                    ↑
   Headers already      Too late to modify
   on the wire!         headers — they're gone

HTTP Rule: Headers MUST come before body. Once body starts
streaming, headers can never be modified. This is HTTP itself,
not a Next.js limitation.

That's why the proxy exists — it runs BEFORE streaming starts.
```
