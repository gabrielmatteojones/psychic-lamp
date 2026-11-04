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

## Drive (documenti su carta intestata)
Pagina `/drive/`, riservata agli utenti di Netlify Identity: scrivi un testo, vedi l'anteprima sulla carta intestata
(`assets/img/carta-intestata.png`) e scarichi il PDF. I documenti si salvano su **Netlify Blobs** tramite la funzione
`netlify/functions/drive.mjs`, che rifiuta ogni richiesta senza un token Identity valido.

- Online: nessuna configurazione extra oltre a Identity (vedi sopra). Netlify installa `@netlify/blobs` da `package.json`.
- In locale: `npm install -g netlify-cli`, poi `netlify dev` (al posto di `jekyll serve`). Al primo accesso il widget chiede l'URL del sito Netlify.
- Tutti gli utenti loggati vedono tutti i documenti; ognuno modifica/elimina solo i propri. Gli utenti con ruolo `admin` (Identity → utente → ruoli) possono modificare tutto.
- Per cambiare l'area di scrittura sulla carta intestata, modifica `PAGE` in `assets/js/drive.js` (misure in mm).
