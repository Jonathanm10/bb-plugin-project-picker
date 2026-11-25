import { definePluginApp } from "@get-bb/plugin-sdk/app";
import {
  OPEN_EVENT,
  ProjectPickerOverlay,
} from "@/components/ProjectPickerOverlay";

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "project-picker",
    component: ProjectPickerOverlay,
  });
  app.commands.register({
    id: "open",
    title: "Project Picker: new thread in project…",
    defaultShortcut: { key: "n", mod: true },
    run: () => {
      window.dispatchEvent(new Event(OPEN_EVENT));
    },
  });
});
