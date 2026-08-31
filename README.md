# pr-guide

Guide de lecture automatique pour les pull requests GitHub : un démon local analyse une PR
(symboles modifiés, tests en vis-à-vis, appelants impactés) et une extension Chrome affiche
le résultat directement sur la page GitHub de la PR.

## Prérequis

- [`gh`](https://cli.github.com/) authentifié (`gh auth status`) — utilisé pour cloner et
  inspecter les PR.
- [`claude` CLI](https://docs.claude.com/claude-code) installé et authentifié — utilisé par
  le démon pour l'analyse.
- Node ≥ 20.
- pnpm (ce dépôt est géré exclusivement avec pnpm, jamais npm/yarn).

## Installation du démon

Le démon tourne en tâche de fond sur `127.0.0.1:7777` et sert l'API consommée par
l'extension.

```bash
scripts/install-daemon.sh
```

Ce script :
1. build `@pr-guide/daemon` (le build produit `packages/daemon/dist/index.cjs`) ;
2. écrit un `launchd` plist (`~/Library/LaunchAgents/com.tjacquin.pr-guide.plist`) qui lance
   `node packages/daemon/dist/index.cjs` au démarrage de session et le relance s'il crashe ;
3. recharge l'agent (`launchctl bootout` puis `bootstrap`).

Logs : `/tmp/pr-guide.log` (stdout) et `/tmp/pr-guide.err` (stderr).

Pour arrêter le démon manuellement :

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.tjacquin.pr-guide.plist
```

Pour le relancer, ré-exécuter `scripts/install-daemon.sh`.

## Installation de l'extension

1. Builder l'extension : `pnpm -F @pr-guide/extension build` → produit `packages/extension/dist/`
   (`content.js`, `background.js`, `manifest.json`, `panel.css`).
2. Dans Chrome, ouvrir `chrome://extensions`.
3. Activer le mode développeur.
4. Cliquer sur « Charger l'extension non empaquetée » et sélectionner
   `packages/extension/dist`.

## API du démon

Le démon expose 3 endpoints HTTP sur `http://127.0.0.1:7777` :

| Méthode | Chemin | Rôle |
|---|---|---|
| `GET` | `/status` | Vérifie que le démon est en ligne (`{ ok: true }`). |
| `POST` | `/analyze` | Corps `{ owner, repo, number, force? }` — lance (ou réutilise) l'analyse d'une PR. Réponses possibles : `started`, `cached`, `running`. |
| `GET` | `/guide/:owner/:repo/:number` | Renvoie le guide généré (200) s'il est prêt, l'état du job en cours (200, `{ status: 'running' }` ou `{ status: 'error', message }`), ou 404 si rien n'a été demandé. |

## Stockage et rétention des guides

Les guides générés sont écrits en JSON dans `~/.pr-guide/guides`.

Le démon purge automatiquement (au démarrage, puis toutes les 24 h) les guides dont la PR
associée est mergée depuis plus de **30 jours**, ainsi que les guides orphelins (PR ou repo
introuvable).

## Vérification manuelle

Cette checklist n'est pas automatisable (elle dépend du DOM réel de GitHub) — à dérouler à
la main, démon lancé :

1. Chrome → `chrome://extensions` → mode développeur → « Charger l'extension non empaquetée » → `packages/extension/dist`.
2. Ouvrir une PR réelle d'un repo perso → le bouton « 📖 Guide » apparaît en haut à droite.
3. Clic → « Analyse en cours… » → le panneau s'affiche avec chapitres, badges, tests en vis-à-vis, appelants.
4. Clic sur « ✕ Fermer le guide » → la PR d'origine est intacte.
5. Recharger la page, re-cliquer → le guide s'affiche immédiatement (cache).
6. Arrêter le démon (`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.tjacquin.pr-guide.plist`) → recharger → le bouton affiche « Guide hors ligne », la page GitHub reste intacte. Relancer le démon ensuite.
