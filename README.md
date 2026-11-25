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
- `server.ts` is the required backend entry; it only logs.

## Shortcut

The command's default shortcut is Cmd+N, which collides with BB's built-in
`thread.new`. BB leaves a colliding plugin default unbound, so rebind once in
Settings → Keyboard, or from a shell:

```
bb settings keyboard set thread.new disabled
bb settings keyboard set plugin:project-picker/open <shortcut>
```

Check the effective binding with `bb settings keyboard list`. The command is
also in the palette (Mod+Shift+P) as "Project Picker: new thread in project…".

## Install

```
npm install
bb plugin install .
```

After editing sources, run `bb plugin reload project-picker`, or
`bb plugin dev` to rebuild and reload on every save.
