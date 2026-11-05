# Production deployment

The site is deployed from `main` to `https://niva.simakov.space` by GitHub Actions.
No server address, login name, SSH key or deployment path is stored in the repository.

## One-time server setup

1. Log in to the server as the Unix account that will receive the static files.
2. Add the GitHub Actions deploy key to that account:

   ```bash
   install -d -m 700 ~/.ssh
   printf '%s\n' 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL9kg03w9/lKPVhafxzT1fjO34g35IPyTR4tNQmMZM3G github-actions:niva-showcase' >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

3. Create the static directory and make the deploy account its owner:

   ```bash
   sudo install -d -o "$(whoami)" -g "$(id -gn)" -m 755 /var/www/niva
   ```

4. Install [`deploy/nginx/niva.simakov.space.conf`](./deploy/nginx/niva.simakov.space.conf) as an Nginx site, enable it, and validate Nginx:

   ```bash
   sudo install -m 644 deploy/nginx/niva.simakov.space.conf /etc/nginx/sites-available/niva.simakov.space
   sudo ln -s /etc/nginx/sites-available/niva.simakov.space /etc/nginx/sites-enabled/niva.simakov.space
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. After the DNS record points to the server, issue the TLS certificate:

   ```bash
   sudo certbot --nginx -d niva.simakov.space --redirect
   ```

## GitHub Actions secrets

Create these **repository secrets** in GitHub. Keep all values out of commits, issues, logs and screenshots.

| Secret | Value |
| --- | --- |
| `NIVA_DEPLOY_HOST` | Server hostname or address |
| `NIVA_DEPLOY_USER` | Unix user that owns `/var/www/niva` |
| `NIVA_DEPLOY_PATH` | `/var/www/niva` |
| `NIVA_DEPLOY_SSH_KEY` | Private half of the dedicated GitHub Actions key |
| `NIVA_DEPLOY_KNOWN_HOSTS` | Pinned `ssh-keyscan -H` output for the server |

Every push to `main` runs install, lint and build before deployment. Files are uploaded in two phases so a newly served `index.html` never refers to assets that have already been deleted.
