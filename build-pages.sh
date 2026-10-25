#!/bin/bash
# Builds the public website into dist/ for GitHub Pages.
set -e
cd "$(dirname "$0")"
PAGES_BASE=/chamunda-cafe/ npx vite build
python3 - <<'PY'
p='dist/index.html'; s=open(p).read()
extra=('<meta name="description" content="Chamunda Cafe — order parathas from your table. Diet starts tomorrow." />\n'
 '<meta name="theme-color" content="#ffc93c" />\n'
 '<link rel="icon" type="image/svg+xml" href="/chamunda-cafe/favicon.svg" />\n'
 '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Bungee&family=DM+Mono:wght@400;500&display=swap" />')
s=s.replace('<meta name="claude:viewport-fit-sides" content="cover" />',extra)
open(p,'w').write(s)
PY
touch dist/.nojekyll
