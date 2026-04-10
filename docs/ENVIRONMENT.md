# Environment Variables Reference

**Last Updated:** 2026-04-08  
**Node Version:** 20+ (LTS recommended)

---

## Quick Reference

| File | Purpose | Environment |
|------|---------|-------------|
| `apps/web/.env.local` | Frontend build-time variables | Local development |
| `apps/server/.env.local` | Backend runtime configuration | Local development |
| `.env.production` | Production build variables | Vercel deployment |

---

## Frontend Variables (`apps/web/.env`)

### Required
| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Backend API endpoint |

### Optional
| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_ENABLE_MOCK_AUTH` | `false` | Use mock auth for testing |
| `VITE_ENABLE_DEBUG_PANEL` | `false` | Show debug controls |

---

## Backend Variables (`apps/server/.env`)

### Database (Choose One)

#### Neon PostgreSQL (Production)
| Variable | Format | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Neon connection string |

#### SQLite (Local/Dev Fallback)
| Variable | Format | Purpose |
|----------|--------|---------|
| `SQLITE_DB_PATH` | `./data/app.db` | Local SQLite file path |

### Auth Configuration
| Variable | Example | Purpose |
|----------|---------|---------|
| `INSTRUCTOR_CODES` | `inst-abc-123,inst-def-456` | Comma-separated instructor signup codes |
| `CSRF_SECRET` | (random string) | CSRF token signing secret |

### CORS / Security
| Variable | Example | Purpose |
|----------|---------|---------|
| `CORS_ORIGINS` | `http://localhost:5173,https://myapp.vercel.app` | Allowed origins |
| `COOKIE_SECRET` | (random string) | Session cookie signing |

### LLM (Optional)
| Variable | Example | Purpose |
|----------|---------|---------|
| `ENABLE_LLM` | `true` | Enable LLM features |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |

---

## Node.js Version

This project requires **Node.js 20+**.

```bash
# Check version
node --version  # Should print v20.x.x or higher

# Use nvm to switch
nvm use 20
```

---

## Verification Commands

```bash
# Verify Node version
node --version

# Check all env files are present
ls -la apps/web/.env.local apps/server/.env.local

# Validate backend can connect to database
npm run server:build && npm run server:start

# Run full verification
npm run integrity:scan
```

---

## Environment-Specific Notes

### Local Development
- SQLite is used if `DATABASE_URL` is not set
- CORS allows `localhost:5173` by default
- Auth codes are read from `.env.local`

### Production (Vercel)
- Neon PostgreSQL is the only supported database
- Environment variables set in Vercel dashboard
- CORS origins must be explicitly configured

---

## Related Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Deployment procedures
- [runbooks/status.md](runbooks/status.md) — Current operational status
