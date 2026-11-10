# Fork notes

This fork runs LearnHarness 0.5.0 with five changes that are not in a release yet.

## What is in the fork

The `dev` branch starts from v0.5.0 (commit `713377f`) and merges five branches:

| Branch | Change |
| --- | --- |
| `fix/research-final-brief` | Upstream PR #532. The researcher keeps its last turn to write the brief, so research no longer fails with "the researcher produced no text". |
| `fix/table-fit-content` | Wide tables wrap their text to fit the chat column instead of running past the edge. |
| `feat/wider-dock` | The question and composer dock is wider, with a maximum width of 55rem. |
| `feat/claude-code-models` | The Claude Code model list includes Fable and shows the exact model IDs. |
| `fix/quiz-option-links` | Links in quiz options show as plain text. |

The `dev`, `fix/table-fit-content` and `fix/quiz-option-links` branches are also on GitHub at `chryzsh/learnharness`. The other branches are local only. The remote `upstream` has push disabled.

On `dev` (commit `6667d99`, 2026-11-10), typecheck and lint pass. The tests give 3563 of 3567 passing, with 2 failures. The two tests that fail also fail on unchanged upstream, because they expect that no `claude` CLI is installed.

## Folders

| Folder | Contents |
| --- | --- |
| `~/Library/Application Support/LearnHarness/` | Data and keys of the installed app. |
| `~/opt/ai/learnharness-data/` | Data and keys of the fork: `data/`, `auth.json` and the server log `dev.log`. |
| `~/LearnHarness-backup-2026-11-07/` | Backup of the installed app's `data/` and `auth.json`, taken on 2026-11-07. |

The `auth.json` files hold your keys in plain text. Keep these folders out of every git repo.

## Rules

1. Use one app at a time. Never run the installed app and the fork at the same time.
2. Quit both apps before you copy data.
3. Copy in one direction only. The folder that you used last is the master.
4. Before you pull new upstream code into the fork, make sure that it has no data format change. Look for changes to `src/server/stores.ts` and `src/core/settings.ts`. If the fork upgrades the data format, the older installed app can fail to read the data.

## Switch from the installed app to the fork

1. Quit the installed app with Cmd+Q.
2. Copy the data from the installed app to the fork:

   ```
   rsync -a --delete ~/Library/Application\ Support/LearnHarness/data/ ~/opt/ai/learnharness-data/data/
   ```

3. Start the fork:

   ```
   cd ~/opt/ai/learnharness && git checkout dev && LH_DATA_DIR=~/opt/ai/learnharness-data/data LH_AUTH_FILE=~/opt/ai/learnharness-data/auth.json npx concurrently -k "next dev -p 3100" "LH_DEV_URL=http://localhost:3100 electron ."
   ```

4. If the window stays empty, press Cmd+R in the window. The first load can take a few seconds.

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

## Known problems

If port 3100 is in use, the fork does not start. Find the process with `lsof -nP -iTCP:3100 -sTCP:LISTEN`.

Use `localhost` in `LH_DEV_URL`. With `127.0.0.1`, the Next dev server blocks its scripts, and the app opens but does not work.
