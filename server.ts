import type { BbPluginApi } from "@get-bb/plugin-sdk";

type Overrides = Awaited<
  ReturnType<BbPluginApi["sdk"]["system"]["config"]>
>["keybindingOverrides"];
type Override = Overrides[number];

const OWNED_KEY = "keybindings-owned";
const key = (k: string, mods: { mod?: boolean; shift?: boolean }) => ({
  key: k,
  mod: mods.mod ?? false,
  shift: mods.shift ?? false,
  meta: false,
  control: false,
  alt: false,
});

// Cmd+N belongs to the picker while the plugin runs; bb's new thread moves to
// Cmd+Shift+O. Applied on every load and reverted on every dispose, because
// bb runs the same dispose hooks for reload, disable, uninstall and shutdown.
export default function plugin(bb: BbPluginApi) {
  const ours: Override[] = [
    { command: "thread.new", shortcut: key("o", { mod: true, shift: true }) },
    { command: `plugin:${bb.pluginId}/open`, shortcut: key("n", { mod: true }) },
  ];
  const sameShortcut = (a: Override["shortcut"], b: Override["shortcut"]) =>
    a === b ||
    (a !== null &&
      b !== null &&
      (Object.keys(a) as (keyof typeof a)[]).every((k) => a[k] === b[k]));
  const isOurs = (o: Override) =>
    o.platform === undefined &&
    ours.some(
      (x) => x.command === o.command && sameShortcut(x.shortcut, o.shortcut),
    );
  const commands = new Set(ours.map((o) => o.command));
  const read = async () => (await bb.sdk.system.config()).keybindingOverrides;

  bb.background.service("claim-cmd-n", {
    async start() {
      const owned = (await bb.storage.kv.get<boolean>(OWNED_KEY)) === true;
      const current = await read();
      const foreign = current.filter(
        (o) => commands.has(o.command) && !(owned && isOurs(o)),
      );
      if (foreign.length > 0) {
        bb.log.info("user overrides Cmd+N bindings; leaving them alone");
        return;
      }
      await bb.storage.kv.set(OWNED_KEY, true);
      await bb.sdk.system.updateKeyboardSettings([
        ...current.filter((o) => !commands.has(o.command)),
        ...ours,
      ]);
      bb.log.info("claimed Cmd+N; thread.new moved to Cmd+Shift+O");
    },
  });

  bb.onDispose(async () => {
    if ((await bb.storage.kv.get<boolean>(OWNED_KEY)) !== true) return;
    const current = await read();
    await bb.sdk.system.updateKeyboardSettings(
      current.filter((o) => !isOurs(o)),
    );
    await bb.storage.kv.delete(OWNED_KEY);
    bb.log.info("released Cmd+N");
  });
}
