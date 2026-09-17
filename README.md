# Relais YellowBet — AL VE CAPITAL

Petit relais gratuit qui permet a l'application de parler a yellowbet.cg
(les serveurs de l'application sont bloques par le site, pas ce relais).

## Deploiement en 3 clics (gratuit, sans carte bancaire)

1. Ouvrir https://vercel.com/new et importer ce depot (\`alve-yellowbet-relay\`).
2. Dans **Environment Variables**, ajouter :
   - \`RELAY_SECRET\` = un mot de passe long au hasard (ex: 40 caracteres).
3. Cliquer **Deploy**. Vercel donne une adresse du type
   \`https://alve-yellowbet-relay.vercel.app\`.

Ensuite, coller dans l'application (Secrets) :
- \`YB_RELAY_URL\` = \`https://<votre-adresse>.vercel.app/api/relay\`
- \`YB_RELAY_SECRET\` = le meme mot de passe que \`RELAY_SECRET\`

## Verification

Ouvrir l'adresse dans un navigateur : elle doit repondre
\`{"ok":true,"service":"yellowbet-relay"}\`.

Aucune donnee n'est stockee : le relais transmet la requete et renvoie la reponse.
