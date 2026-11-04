# Gabriel Jones — sito Jekyll + Decap CMS

## In locale
    bundle install
    bundle exec jekyll serve          # http://localhost:4000
    npx decap-server                  # in un 2° terminale → http://localhost:4000/admin/

## Online (Netlify)
1. Carica la cartella su GitHub e collega il repo a Netlify (build: `bundle exec jekyll build`, publish: `_site`).
2. Netlify → Site configuration → Identity → **Enable Identity**.
3. Identity → Registration: *Invite only*. Poi Services → **Enable Git Gateway**.
4. Identity → *Invite users*: invita la tua email, apri il link ricevuto e imposta la password.
5. Vai su `/admin/` e accedi.

In `admin/config.yml` controlla `branch:` (main/master). In `_data/site.yml` metti l'URL reale del sito Playbook.
