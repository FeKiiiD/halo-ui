import type { Meta, StoryObj } from "@storybook/react";
import { Button, Icon } from "../src";

const meta = {
  title: "Core/Button",
  component: Button,
  args: { children: "Create programme" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "outlined", "texted"] },
    size: { control: "select", options: ["sm", "md", "counter"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * The four variants. Note that only one primary belongs on a real screen —
 * they are side by side here to compare them, which is the one context where
 * that is allowed.
 */
export const Variants: Story = {
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="primary">Publish</Button>
      <Button {...args} variant="secondary">Scan</Button>
      <Button {...args} variant="outlined">Save draft</Button>
      <Button {...args} variant="texted">Cancel</Button>
    </div>
  ),
};

/** 40 / 48 / 56px. `counter` is the standing, at-the-counter target. */
export const Sizes: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="counter">Counter</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="secondary" iconLeft={<Icon name="qr-code" size={18} />}>
        Scan
      </Button>
      <Button variant="outlined" iconRight={<Icon name="arrow-right" size={18} />}>
        Continue
      </Button>
      <Button variant="secondary" iconOnly iconLeft={<Icon name="plus" size={18} />} />
      <Button variant="outlined" iconOnly iconLeft={<Icon name="settings" size={18} />} />
    </div>
  ),
};

/** The chevron opens a real menu. Back-office only. */
export const Split: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-4 pb-40">
      <Button
        variant="primary"
        split
        menuItems={[
          { label: "Publish and notify customers" },
          { label: "Schedule publication" },
          { label: "Delete draft", tone: "error" },
        ]}
      >
        Publish
      </Button>
      <Button
        variant="outlined"
        split
        menuAlign="left"
        menuItems={[{ label: "Export as CSV" }, { label: "Export as PDF", disabled: true }]}
      >
        Export
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button loading>Publishing…</Button>
      <Button variant="secondary" loading>Saving…</Button>
      <Button variant="outlined" loading iconOnly />
    </div>
  ),
};

/** Disabled is a flat grey fill at full opacity — not a translucent button. */
export const Disabled: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>Primary</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="outlined" disabled>Outlined</Button>
      <Button variant="texted" disabled>Texted</Button>
    </div>
  ),
};

/**
 * On the ink régime. `outlined` and `texted` keep a white label and tint with
 * translucent white; `secondary` inverts to a white pill.
 */
export const OnDark: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <div className="halo-halo flex flex-wrap items-center gap-4 p-16">
      <Button variant="primary" onDark>Create programme</Button>
      <Button variant="secondary" onDark>Watch the demo</Button>
      <Button variant="outlined" onDark>Learn more</Button>
      <Button variant="texted" onDark>Cancel</Button>
    </div>
  ),
};
