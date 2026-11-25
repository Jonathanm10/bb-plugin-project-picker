# bb-plugin-project-picker

A BB plugin that opens a project picker on Cmd+N. Pick a project and BB opens
its new-thread screen with the prompt focused.

- Type to filter projects by name or path.
- ↑/↓ moves the highlight, Enter picks it, Cmd+1…9 picks a visible row, Esc
  or a click outside closes.
- "No project" (the personal project) is always first. The rest are ordered
  by their most recently updated thread; projects without threads come last,
  alphabetically.

## Files

- `app.tsx` registers the overlay and the `open` command.
- `components/ProjectPickerOverlay.tsx` is the modal.
- `server.ts` claims Cmd+N on load and gives it back on dispose.

## Shortcut

While the plugin runs it owns Cmd+N and moves BB's `thread.new` to
Cmd+Shift+O by writing two keyboard overrides. If you already overrode
`thread.new` or `plugin:project-picker/open`, it leaves your bindings alone.
Disabling or uninstalling the plugin removes the overrides it wrote, so Cmd+N
opens a new thread again. Overrides you changed afterwards are kept.

Check the effective binding with `bb settings keyboard list`. The command is
also in the palette (Mod+Shift+P) as "Project Picker: new thread in project…".

## Install

```
npm install
bb plugin install .
```

After editing sources, run `bb plugin reload project-picker`, or
`bb plugin dev` to rebuild and reload on every save.
