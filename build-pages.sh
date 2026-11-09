#!/bin/bash
# Builds the public website into dist/ for GitHub Pages.
set -e
cd "$(dirname "$0")"
PAGES_BASE=/chamunda-cafe/ npx vite build
python3 - <<'PY'
p='dist/index.html'; s=open(p).read()
extra=('<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; font-src \'self\' https://fonts.gstatic.com; img-src \'self\' data: blob:; connect-src \'self\' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com; frame-src https://chamunda-cafe.firebaseapp.com; object-src \'none\'; base-uri \'self\'; form-action \'self\'" />\n'
 '<meta name="referrer" content="strict-origin-when-cross-origin" />\n'
 '<meta name="description" content="Chamunda Cafe — order parathas from your table. Diet starts tomorrow." />\n'
 '<meta name="theme-color" content="#ffc93c" />\n'
 '<link rel="icon" type="image/svg+xml" href="/chamunda-cafe/favicon.svg" />\n'
 '<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Bungee&family=DM+Mono:wght@400;500&display=swap" />')
s=s.replace('<meta name="claude:viewport-fit-sides" content="cover" />',extra)
# customer link: ordering only
cust=s.replace('<div id="root"></div>','<div id="root" data-mode="customer"></div>')
open(p,'w').write(cust)
# owner link: Kitchen Boss only, kept out of search engines
import os
os.makedirs('dist/kitchen-boss', exist_ok=True)
boss=(s.replace('<div id="root"></div>','<div id="root" data-mode="admin"></div>')
       .replace('<title>Chamunda Cafe</title>','<title>Chamunda Cafe · Kitchen</title>\n<meta name="robots" content="noindex, nofollow" />'))
open('dist/kitchen-boss/index.html','w').write(boss)
PY
touch dist/.nojekyll
