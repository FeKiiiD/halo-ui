import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-themes"],
  framework: { name: "@storybook/react-vite", options: {} },

  // Storybook does not read a vite config of its own here, so the Tailwind
  // plugin is injected into the one it builds. The import is dynamic because
  // @tailwindcss/vite is ESM-only and main.ts is loaded as CJS.
  viteFinal: async (config) => {
    const { default: tailwindcss } = await import("@tailwindcss/vite");
    config.plugins = [...(config.plugins ?? []), tailwindcss()];
    return config;
  },
};

export default config;
