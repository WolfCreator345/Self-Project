# Deploying NFSU Library

The app is a standard Node.js (Next.js) server with a SQLite database file.
**The host must keep files between restarts** (a persistent disk/volume), or the
database will be wiped. Serverless hosts such as Vercel or Netlify are not suitable
without first moving the database to Postgres.

## Settings for any Node.js host

| Setting | Value |
| --- | --- |
| Root / app directory | `nfsu-library` |
| Node.js version | **22.18 or newer** |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Start command | `npm run start:prod` (applies DB migrations, then starts) |
| Port | Uses the `PORT` variable the host provides (default 3000) |

### Environment variables (set in the host's dashboard, never in code)

| Name | Value |
| --- | --- |
| `DATABASE_URL` | `file:/ABSOLUTE/PATH/ON/PERSISTENT/DISK/library.db` (for example `file:/data/library.db`) |
| `ADMIN_EMAIL` | Staff login email |
| `ADMIN_PASSWORD_HASH` | Output of `npm run hash-password`. In a dashboard, paste the hash **without** the `\` escapes (`$2b$12$...`). The `\$` form is only for `.env` files. |
| `ADMIN_NAME` | `Sumit Panda` |
| `NEXTAUTH_SECRET` | Random string: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | The public address, e.g. `https://library.example.ac.in` |

### First deploy only

After the first successful start, run once (in the host's shell/console):

```bash
npm run db:seed
```

This adds the 10 categories, the 3 newspaper links and the sample books.
Do **not** run it on every start, or deleted sample books come back.

### Check it works

1. Open the site: the home page shows New Arrivals and newspapers.
2. Open `/admin`: you are sent to `/login`.
3. Log in with the staff account, add a test book, check it appears first on the home page, then delete it.

## Option A: university server or VPS (recommended for an official site)

```bash
# on the server (Ubuntu), as a normal user
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git
git clone https://github.com/WolfCreator345/Self-Project.git && cd Self-Project
git checkout claude/charming-lovelace-wt0hsi   # until the pull request is merged into main
cd nfsu-library
cp .env.example .env.local && nano .env.local   # fill in values (keep the \$ escapes here)
npm ci && npm run build && npm run setup
sudo npm install -g pm2
pm2 start npm --name nfsu-library -- run start:prod && pm2 save && pm2 startup
```

Then put nginx in front of it (reverse proxy to `http://127.0.0.1:3000`) and add HTTPS
with `sudo certbot --nginx`. Make sure nginx passes `X-Forwarded-For`, which the login
rate limiter relies on:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

To update later: `git pull && npm ci && npm run build && pm2 restart nfsu-library`.

## Option B: Docker (any container host with a volume)

```bash
docker build -t nfsu-library .
docker run -d --name nfsu-library -p 3000:3000 --env-file .env.production -v nfsu-data:/data nfsu-library
docker exec nfsu-library npm run db:seed     # first run only
```

`.env.production` holds the variables above, with the hash **unescaped** (Docker does not expand `$`).

## Option C: managed Node.js hosting (Hostinger, Render, Railway, ...)

1. Connect the GitHub repository, or upload the project ZIP.
2. Enter the settings from the table above (root `nfsu-library`, build, start, Node 22).
3. Add a persistent disk and point `DATABASE_URL` at a file on it.
4. Add the environment variables, deploy, then run `npm run db:seed` once.

If the host has no persistent disk, ask a developer to move the database to Postgres first.
