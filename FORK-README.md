# Fork notes

This fork runs LearnHarness 0.7.0 with the changes below, which are not in a release yet.

## What is in the fork

The `dev` branch merges the upstream releases v0.6.0, v0.6.1 and v0.7.0 (2026-11-22) on top of the fork's own changes.

| Change | Where |
| --- | --- |
| The Claude Code model list shows the exact model IDs as well as the aliases. | `feat/claude-code-models` |
| Links in quiz options show as plain text, so an option button holds no link button. | `fix/quiz-option-links` |
| The practice dock turns into a reply field after the first submission, and shows the problem statement as one line. | `dev` only |
| A link in a chat message opens its "Open external link?" prompt as a dialog, not inside the paragraph. | `fix/link-prompt-in-paragraph` |
| Research reads web pages through an HTTP proxy when one is set, for example on a company VPN. | `dev` only |

Upstream now has these earlier fork changes, so the fork no longer carries them: the research final brief (v0.7.0 removed the turn limit), wide tables (`fix/table-fit-content`), and the view reader error on reload in dev. The wider dock (`feat/wider-dock`) was dropped, because v0.7.0 sizes the dock to the question.

`startfork.sh` sets `NODE_USE_ENV_PROXY=1`, so web search also uses the proxy.

The `dev` branch and several `fix/*` branches are also on GitHub at `chryzsh/learnharness`. The other branches are local only. The remote `upstream` has push disabled.

On `dev` (commit `598f99f`, 2026-11-11), typecheck and lint pass. The tests give 5285 of 5289 passing, with 2 failures and 2 skipped. The two tests that fail also fail on unchanged upstream, because they expect that no `claude` CLI is installed.

## Folders

| Folder | Contents |
| --- | --- |
| `~/Library/Application Support/LearnHarness/` | Data and keys of the installed app. |
| `~/opt/ai/learnharness-data/` | Data and keys of the fork: `data/`, `auth.json` and the server log `dev.log`. |
| `~/opt/ai/learnharness-data/data/plugins/learnharness-git/` | The Git backup plugin (heohlee/learnharness-git v0.1.1, release zip). It backs up the fork's `data/` to the private repo `chryzsh/learnharness-data` every 10 minutes. `auth.json` is outside `data/`, so it is not backed up. |
| `~/LearnHarness-backup-2026-11-07/` | Backup of the installed app's `data/` and `auth.json`, taken on 2026-11-07. |

The `auth.json` files hold your keys in plain text. Keep these folders out of every git repo.

## Rules

1. Use one app at a time. Never run the installed app and the fork at the same time.
2. Quit both apps before you copy data.
3. Copy in one direction only. The folder that you used last is the master.
4. Before you pull new upstream code into the fork, make sure that it has no data format change. Look for changes to `src/server/stores.ts` and `src/core/settings.ts`. If the fork upgrades the data format, the older installed app can fail to read the data.

v0.6.0 has one small data format change. It replaces the appearance field `mode` (dark or light) with `theme`, and it deletes `mode` when it saves the appearance configuration. If you copy that data to an installed app older than 0.6.0, the app uses dark mode. No other data is lost.

## Switch from the installed app to the fork

1. Quit the installed app with Cmd+Q.
2. Copy the data from the installed app to the fork:

   ```
   rsync -a --delete ~/Library/Application\ Support/LearnHarness/data/ ~/opt/ai/learnharness-data/data/
   ```

3. Start the fork:

   ```
   cd ~/opt/ai/learnharness && git checkout dev && LH_DATA_DIR=~/opt/ai/learnharness-data/data LH_AUTH_FILE=~/opt/ai/learnharness-data/auth.json npx concurrently -k "npm run dev -- -p 3100" "LH_DEV_URL=http://localhost:3100 electron ."
   ```

4. If the window stays empty, press Cmd+R in the window. The first load can take a few seconds.

Since v0.6.0, `npm run dev` builds the plugins before it starts Next. Do not call `next dev` directly, because the plugins then do not load.

## Switch from the fork to the installed app

1. Stop the fork with Ctrl+C in its terminal.
2. Copy the data from the fork to the installed app:

   ```
   rsync -a --delete ~/opt/ai/learnharness-data/data/ ~/Library/Application\ Support/LearnHarness/data/
   ```

3. Open the installed app.

The `--delete` flag makes the target an exact copy of the source. The target loses all data that only the target had.

## Restore the backup

1. Quit both apps.
2. Copy the backup into the installed app:

   ```
   rsync -a --delete ~/LearnHarness-backup-2026-11-07/data/ ~/Library/Application\ Support/LearnHarness/data/
   cp ~/LearnHarness-backup-2026-11-07/auth.json ~/Library/Application\ Support/LearnHarness/auth.json
   ```

## Update the fork to a new upstream release

1. Quit the fork.
2. Fetch the release and merge it into `dev`:

   ```
   cd ~/opt/ai/learnharness && git fetch upstream --tags && git checkout dev && git merge <tag>
   ```

3. Install the new dependencies of the app and of the plugins:

   ```
   npm install && npm run plugins:setup
   ```

4. Run the checks. Expect the two `claude` CLI test failures that are described above.

   ```
   npm run typecheck && npm run lint && npm test
   ```

## Known problems

If port 3100 is in use, the fork does not start. Find the process with `lsof -nP -iTCP:3100 -sTCP:LISTEN`.

Use `localhost` in `LH_DEV_URL`. With `127.0.0.1`, the Next dev server blocks its scripts, and the app opens but does not work.
