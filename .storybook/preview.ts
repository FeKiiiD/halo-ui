import type { Preview } from "@storybook/react";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import "./preview.css";

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    // The system's own grounds, so a component is never judged against a
    // colour that does not exist in it.
    backgrounds: { disable: true },
    layout: "centered",
  },
  decorators: [
    // Drives the same `data-theme` hook the semantic layer listens on, so the
    // toolbar toggle exercises the real dark mode rather than a Storybook one.
    withThemeByDataAttribute({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
};

export default preview;
