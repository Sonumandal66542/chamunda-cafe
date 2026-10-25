#!/bin/bash
# Builds one self-contained page for the Claude artifact (no Firebase).
set -e
cd "$(dirname "$0")"
ARTIFACT=1 npx vite build --outDir .artifact-dist --emptyOutDir >/dev/null
python3 - <<'PY'
import re, os
d='.artifact-dist'
html=open(f'{d}/index.html').read()
css=''.join(open(f'{d}/assets/'+f).read() for f in os.listdir(f'{d}/assets') if f.endswith('.css'))
js=[f for f in os.listdir(f'{d}/assets') if f.endswith('.js')]
assert len(js)==1, js
code=open(f'{d}/assets/'+js[0]).read().replace('</script','<\\/script')
out=('<title>Chamunda Cafe</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Bungee&family=DM+Mono:wght@400;500&display=swap">\n'
 f'<style>{css}</style>\n<div id="root"></div>\n<script type="module">{code}</script>\n')
open('/home/claude/paratha-pagalpan.html','w').write(out)
print('artifact page', len(out), 'bytes')
PY
