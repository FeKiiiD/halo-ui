import type { Meta, StoryObj } from "@storybook/react";
import { Blob, CountUp, Icon, IconChip, SectionMarker, Spinner, StatBlock } from "../src";

const meta = {
  title: "Foundations",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Swatch({ token, name }: { token: string; name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-16 w-full rounded-chip border border-border-subtle"
        style={{ background: `var(${token})` }}
      />
      <div className="flex flex-col">
        <span className="text-body-s font-medium">{name}</span>
        <code className="text-[12px] text-text-secondary">{token}</code>
      </div>
    </div>
  );
}

/**
 * The semantic aliases — what a component is allowed to reference. Toggle the
 * theme in the toolbar: every one of these re-points, which is the whole
 * reason components never touch a raw palette value.
 */
export const Colors: Story = {
  render: () => (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h3 className="text-heading-s">Surfaces</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Swatch token="--color-surface-page" name="Page" />
          <Swatch token="--color-surface-alt" name="Alt" />
          <Swatch token="--color-surface-card" name="Card" />
          <Swatch token="--color-surface-sunken" name="Sunken" />
          <Swatch token="--color-surface-disabled" name="Disabled" />
          <Swatch token="--color-surface-code" name="Code" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-heading-s">Action</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Swatch token="--color-action-primary-bg" name="Primary" />
          <Swatch token="--color-action-primary-bg-hover" name="Primary hover" />
          <Swatch token="--color-action-primary-bg-press" name="Primary press" />
          <Swatch token="--color-action-secondary-bg" name="Secondary" />
          <Swatch token="--color-chip-neutral-bg" name="Chip" />
          <Swatch token="--color-focus-ring" name="Focus ring" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-heading-s">Status</h3>
        <p className="max-w-[60ch] text-body-s text-text-secondary">
          Deliberately outside the accent family. Using the accent for success
          or error costs it its call-to-action meaning.
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          <Swatch token="--color-success" name="Success" />
          <Swatch token="--color-success-soft" name="Success soft" />
          <Swatch token="--color-warning" name="Warning" />
          <Swatch token="--color-warning-soft" name="Warning soft" />
          <Swatch token="--color-error" name="Error" />
          <Swatch token="--color-error-soft" name="Error soft" />
          <Swatch token="--color-info" name="Info" />
          <Swatch token="--color-info-soft" name="Info soft" />
        </div>
      </section>
    </div>
  ),
};

/**
 * The ramp. Force comes from size and tightness, never from weight — nothing
 * here is heavier than 600.
 */
export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {(
        [
          ["text-display-xl", "Display XL — 76/76, −0.035em"],
          ["text-display-l", "Display L — 56/58, −0.03em"],
          ["text-heading-m", "Heading M — 32/38, −0.02em"],
          ["text-heading-s", "Heading S — 20/26, −0.01em"],
          ["text-eyebrow", "Eyebrow — 15/20, sentence case, never caps"],
          ["text-body-l", "Body L — 18/28"],
          ["text-body", "Body — 16/26"],
          ["text-body-s", "Body S — 14/22"],
        ] as const
      ).map(([className, label]) => (
        <div key={className} className="flex flex-col gap-1 border-b border-border-subtle pb-6">
          <code className="text-[12px] text-text-secondary">{className}</code>
          <span className={className}>{label}</span>
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <code className="text-[12px] text-text-secondary">text-stat</code>
        <span className="text-stat text-accent">1 208</span>
      </div>
    </div>
  ),
};

/** Base 4, with deliberate gaps at 5, 7, 9 and 10. */
export const Spacing: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {[1, 2, 3, 4, 6, 8, 12, 16, 20, 30, 40].map((step) => (
        <div key={step} className="flex items-center gap-4">
          <code className="w-24 text-[12px] text-text-secondary">--space-{step}</code>
          <div className="h-4 bg-accent" style={{ width: `var(--space-${step})` }} />
          <span className="text-body-s text-text-secondary">{step * 4}px</span>
        </div>
      ))}
    </div>
  ),
};

/** All buttons are total pills. Cards 24, panels 20, chips and inputs 12. */
export const Radii: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-6">
      {(
        [
          ["rounded-pill", "Pill — every button"],
          ["rounded-card", "Card — 24"],
          ["rounded-panel", "Panel — 20"],
          ["rounded-chip", "Chip — 12"],
        ] as const
      ).map(([className, label]) => (
        <div key={className} className="flex flex-col gap-2">
          <div className={`size-24 bg-ink ${className}`} />
          <span className="text-body-s text-text-secondary">{label}</span>
        </div>
      ))}
    </div>
  ),
};

export const Primitives: Story = {
  render: () => (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h3 className="text-heading-s">Icon chip</h3>
        <div className="flex items-center gap-4">
          <IconChip icon={<Icon name="qr-code" />} />
          <IconChip icon={<Icon name="gift" />} />
          <IconChip icon={<Icon name="zap" />} inverted />
          <span className="text-body-s text-text-secondary">
            The inverted one is reserved for the single flipped card in a grid.
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading-s">Stat block</h3>
        <div className="flex flex-wrap gap-16">
          <StatBlock value={<CountUp value={1208} />} label="Covers won back this month" />
          <StatBlock value="10 min" label="To launch a programme" tone="neutral" />
          <StatBlock value="+18 %" label="Repeat visits" tone="neutral" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading-s">Section marker &amp; spinner</h3>
        <div className="flex items-center gap-8">
          <div>
            <SectionMarker />
            <span className="text-eyebrow">Loyalty at the counter</span>
          </div>
          <Spinner size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading-s">Blob</h3>
        <div className="relative h-64 w-full overflow-hidden rounded-card bg-surface-alt">
          <Blob size={280} className="-right-16 top-8" />
          <div className="relative z-10 p-8">
            <span className="text-heading-m">Behind a product visual.</span>
          </div>
        </div>
      </div>
    </div>
  ),
};
