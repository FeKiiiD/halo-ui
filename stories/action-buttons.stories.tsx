import type { Meta, StoryObj } from "@storybook/react";
import {
  AIButton,
  CopyButton,
  EnvelopeButton,
  HoldButton,
  RewardButton,
  SaveButton,
  ScanButton,
  SearchButton,
  SendButton,
} from "../src";

const meta = {
  title: "Core/Action buttons",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Resolves after a beat, as a real request would. */
const succeeds = (value: unknown = true, delay = 900) =>
  () => new Promise((resolve) => setTimeout(() => resolve(value), delay));

/** Rejects, which is what drives the failure choreography. */
const fails = (delay = 900) =>
  () =>
    new Promise((_, reject) => setTimeout(() => reject(new Error("nope")), delay));

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-body-s text-text-secondary">{label}</span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

/**
 * Every choreographed button, in its success path. Press each one: the busy
 * phase is floored so the animation always reads, even when the promise
 * resolves instantly.
 */
export const Succeeding: Story = {
  render: () => (
    <div className="flex flex-col gap-10">
      <Row label="Send — the plane leaves the frame, then confetti">
        <SendButton onSend={succeeds()} />
        <SendButton onSend={succeeds()} hold />
      </Row>
      <Row label="Reward — held by default; the lid flies off">
        <RewardButton onClaim={succeeds()} />
      </Row>
      <Row label="Scan — the beam reads the code, the frame locks">
        <ScanButton onScan={succeeds("Marie")} />
      </Row>
      <Row label="AI — the robot thinks, the label rotates">
        <AIButton onAsk={succeeds(true, 6000)} />
      </Row>
      <Row label="Save — the reel turns while the write is in flight">
        <SaveButton onSave={succeeds()} />
        <SaveButton onSave={succeeds()} variant="primary" dirty={false} />
      </Row>
      <Row label="Copy — the sheet lifts off the stack">
        <CopyButton value="https://example.com/card/8412" />
      </Row>
      <Row label="Search — the lens sweeps the lines">
        <SearchButton onSearch={succeeds(128)} />
      </Row>
      <Row label="Envelope — the flap opens, the letter rises">
        <EnvelopeButton onOpen={succeeds()} />
      </Row>
      <Row label="Hold — press and hold to confirm">
        <HoldButton onConfirm={() => undefined} />
        <HoldButton size="counter" onConfirm={() => undefined}>
          Hold to validate
        </HoldButton>
      </Row>
    </div>
  ),
};

/** The failure path: each button shakes once and draws a cross. */
export const Failing: Story = {
  render: () => (
    <div className="flex flex-col gap-10">
      <Row label="Send — the plane stalls and drops away">
        <SendButton onSend={fails()} />
      </Row>
      <Row label="Reward — the credit is refused">
        <RewardButton onClaim={fails()} />
      </Row>
      <Row label="Scan — the code is unreadable">
        <ScanButton onScan={fails()} />
      </Row>
      <Row label="Save, copy, search, envelope">
        <SaveButton onSave={fails()} />
        <CopyButton onCopy={fails()} />
        <SearchButton onSearch={fails()} />
        <EnvelopeButton onOpen={fails()} />
      </Row>
    </div>
  ),
};

/** Counter mode: 56px targets, for use standing during service. */
export const CounterMode: Story = {
  render: () => (
    <div className="flex flex-col gap-10">
      <Row label="The three controls a counter actually uses">
        <ScanButton onScan={succeeds("Marie")} size="counter" />
        <RewardButton onClaim={succeeds()} size="counter" />
        <HoldButton size="counter" onConfirm={() => undefined}>
          Hold to validate
        </HoldButton>
      </Row>
    </div>
  ),
};
