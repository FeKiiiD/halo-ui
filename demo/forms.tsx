import * as React from "react";
import type { ComboboxOption, LookupRecord, SelectOption } from "../src";
import {
  AmountField,
  Checkbox,
  ChoiceCard,
  DatePicker,
  DateRangePicker,
  DateTimeField,
  EmailListInput,
  FileDrop,
  FormActions,
  FormGrid,
  FormSection,
  FormStepper,
  FormSummary,
  PhoneField,
  RecordLookup,
  RichTextEditor,
  TimePicker,
  CheckboxGroup,
  CodeInput,
  Combobox,
  FieldAction,
  Input,
  MultiSelect,
  NumberField,
  NumberStepper,
  PasswordField,
  Radio,
  SearchField,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  TagsInput,
  Textarea,
} from "../src";

/* -------------------------------------------------------------------------
 * Page furniture, matching the core sheet.
 * ---------------------------------------------------------------------- */

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-border-subtle pt-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-heading-m">{title}</h2>
        {note ? <p className="max-w-[70ch] text-body text-text-secondary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div
      className={
        cols === 1
          ? "grid gap-6"
          : cols === 3
            ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            : "grid gap-6 md:grid-cols-2"
      }
    >
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <span className="text-body-s text-text-secondary">{children}</span>;
}

/* -------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------- */

const plans: SelectOption[] = [
  { value: "starter", label: "Starter", description: "Up to 200 cards" },
  { value: "growth", label: "Growth", description: "Up to 2 000 cards", badge: "Popular" },
  { value: "scale", label: "Scale", description: "Unlimited", badge: "New" },
  { value: "legacy", label: "Legacy", description: "No longer sold", disabled: true },
];

const cities: ComboboxOption[] = [
  { value: "paris", label: "Paris", description: "Île-de-France" },
  { value: "lyon", label: "Lyon", description: "Auvergne-Rhône-Alpes" },
  { value: "marseille", label: "Marseille", description: "Provence" },
  { value: "bordeaux", label: "Bordeaux", description: "Nouvelle-Aquitaine" },
  { value: "lille", label: "Lille", description: "Hauts-de-France" },
];

const weekdays = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
];

/** Resolves after a beat, like a real lookup. */
const search = (query: string) =>
  new Promise<ComboboxOption[]>((resolve) =>
    setTimeout(
      () => resolve(cities.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))),
      500,
    ),
  );

/* -------------------------------------------------------------------------
 * Sheet
 * ---------------------------------------------------------------------- */

export function FormsSheet() {
  const [richText, setRichText] = React.useState(
    '<p>Bonjour Marie,</p><p>Votre <b>récompense</b> vous attend au comptoir.</p>',
  );
  const [text, setText] = React.useState("");
  const [email, setEmail] = React.useState("marie@bistrot.fr");
  const [validating, setValidating] = React.useState(false);
  const [verified, setVerified] = React.useState<string | undefined>();
  const [password, setPassword] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [plan, setPlan] = React.useState<string>("growth");
  const [days, setDays] = React.useState<string[]>(["mon", "wed"]);
  const [city, setCity] = React.useState<ComboboxOption | null>(null);
  const [tags, setTags] = React.useState<string[]>(["bistro", "lunch"]);
  const [amount, setAmount] = React.useState("1 208");
  const [points, setPoints] = React.useState("10");
  const [unit, setUnit] = React.useState("pt");
  const [stamps, setStamps] = React.useState(10);
  const [threshold, setThreshold] = React.useState(60);
  const [code, setCode] = React.useState("");
  const [notify, setNotify] = React.useState(true);
  const [terms, setTerms] = React.useState(false);
  const [frequency, setFrequency] = React.useState("weekly");
  const [contact, setContact] = React.useState("email");
  const [query, setQuery] = React.useState("");
  const [checks, setChecks] = React.useState<string[]>(["mon"]);
  const [date, setDate] = React.useState("2026-09-15");
  const [time, setTime] = React.useState("09:30");
  const [range, setRange] = React.useState({ from: "2026-09-01", to: "2026-09-30" });
  const [price, setPrice] = React.useState("29,00");
  const [ccy, setCcy] = React.useState("EUR");
  const [phone, setPhone] = React.useState("6 12 34 56 78");
  const [dial, setDial] = React.useState("FR");
  const [recipients, setRecipients] = React.useState<string[]>(["marie@bistrot.fr"]);
  const [linked, setLinked] = React.useState<LookupRecord[]>([]);
  const [plan2, setPlan2] = React.useState("growth");
  const [step, setStep] = React.useState(1);

  /** Fakes an async availability check on the email field. */
  const verify = async () => {
    setVerified(undefined);
    setValidating(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setValidating(false);
    setVerified("Address confirmed.");
    return true;
  };

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Text"
        note="Every field sits in the same frame: label, control, then one message lane that is reserved whether or not there is a message — so a field going into error does not shove the rest of the form down."
      >
        <Grid>
          <Input label="Restaurant name" placeholder="Le Bistrot du Coin" value={text} onChange={setText} />
          <Input label="Slug" prefix="kardloop.fr/" placeholder="bistrot-du-coin" clearable />
          <Input
            label="Covers per service"
            hint="Used to size your programme."
            iconLeft="users"
            suffix="covers"
          />
          <Input label="API key" masked copyable value="sk_live_8412_a9f3c2" readOnly />
          <Input label="Postcode" error="Not a valid postcode." value="7500" />
          <Input label="VAT number" success="Verified with the registry." value="FR40303265045" />
          <Input label="Booking URL" warning="This domain is not yours." value="bit.ly/xyz" />
          <Input label="Disabled" disabled value="Not editable" />
        </Grid>

        <Grid>
          <Input
            label="Email"
            iconLeft="mail"
            value={email}
            onChange={setEmail}
            validating={validating}
            success={verified}
            action={<FieldAction label="Verify" onAction={verify} />}
          />
          <Input label="Short label" maxLength={24} hint="Shown on the card." />
        </Grid>

        <Grid cols={1}>
          <Textarea
            label="Description"
            placeholder="Two or three sentences, ending on a concrete fact."
            hint="Grows as you type."
            maxLength={280}
            value={bio}
            onChange={setBio}
          />
        </Grid>
      </Section>

      <Section
        title="Choice"
        note="Select for one from many, MultiSelect for several, SegmentedControl when every option should stay visible, Radio when the options need explaining."
      >
        <Grid>
          <Select
            label="Plan"
            options={plans}
            value={plan}
            onChange={setPlan}
            hint="Change takes effect next month."
          />
          <Select
            label="City"
            options={cities}
            searchable
            placeholder="Search a city…"
          />
          <MultiSelect
            label="Opening days"
            options={weekdays}
            values={days}
            onChange={setDays}
            max={5}
          />
          <Combobox
            label="Delivery zone"
            fetchOptions={search}
            value={city}
            onSelect={setCity}
            hint="Type at least one letter."
          />
        </Grid>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Note>Segmented — up to four options, all visible</Note>
            <div className="flex flex-wrap items-center gap-4">
              <SegmentedControl
                ariaLabel="Frequency"
                options={[
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "monthly", label: "Monthly" },
                ]}
                value={frequency}
                onChange={setFrequency}
              />
              <SegmentedControl
                ariaLabel="Size"
                size="sm"
                options={[
                  { value: "s", label: "S" },
                  { value: "m", label: "M" },
                  { value: "l", label: "L" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Note>Radio — when each option needs a word of explanation</Note>
            <div className="flex flex-col gap-3">
              {[
                { value: "email", label: "By email" },
                { value: "sms", label: "By SMS" },
                { value: "none", label: "No reminders" },
              ].map((option) => (
                <Radio
                  key={option.value}
                  name="contact"
                  value={option.value}
                  label={option.label}
                  checked={contact === option.value}
                  onChange={setContact}
                />
              ))}
            </div>
          </div>

          <Grid>
            <CheckboxGroup
              legend="Notify me about"
              options={weekdays.slice(0, 4)}
              values={checks}
              onChange={setChecks}
            />
            <div className="flex flex-col gap-4">
              <Note>Standalone toggles</Note>
              <Checkbox label="Send a welcome message" checked={notify} onChange={setNotify} />
              <Checkbox label="Accept the terms" checked={terms} onChange={setTerms} />
              <Checkbox label="Unavailable option" disabled />
              <Switch label="Programme is live" checked={notify} onChange={setNotify} />
              <Switch label="Locked setting" disabled checked />
            </div>
          </Grid>
        </div>
      </Section>

      <Section
        title="Numbers"
        note="NumberField holds a formatted string, not a number — “1 208,” is a legitimate state while typing. Parse it at submission with parseNumber."
      >
        <Grid>
          <NumberField label="Covers won back" value={amount} onChange={setAmount} unit="covers" max={5000} />
          <NumberField
            label="Reward value"
            value={points}
            onChange={setPoints}
            units={[
              { value: "pt", label: "points" },
              { value: "eur", label: "euros" },
            ]}
            unitValue={unit}
            onUnitChange={setUnit}
            presets={[5, 10, 20, 50]}
          />
          <NumberField label="Price" decimals={2} unit="€" defaultValue="29,00" stepper step={0.5} />
          <NumberField label="Near the maximum" defaultValue="95" max={100} unit="%" />
        </Grid>

        <Grid>
          <NumberStepper
            label="Stamps before the reward"
            value={stamps}
            onChange={setStamps}
            min={1}
            max={20}
            hint="Hold a button to repeat."
          />
          <Slider
            label="Reminder threshold"
            value={threshold}
            onChange={setThreshold}
            suffix="days"
            max={90}
          />
        </Grid>
      </Section>

      <Section
        title="Credentials"
        note="The password checklist updates as you type: a rule that only appears after a failed submission is a rule the user had to guess."
      >
        <Grid>
          <PasswordField value={password} onChange={setPassword} />
          <div className="flex flex-col gap-6">
            <CodeInput
              label="Verification code"
              hint="Type any four digits — 1234 succeeds, anything else fails."
              value={code}
              onChange={setCode}
              onComplete={async (entered) => {
                await new Promise((resolve) => setTimeout(resolve, 700));
                return entered === "1234";
              }}
            />
          </div>
        </Grid>
      </Section>

      <Section title="Lists and search" note="TagsInput accepts a pasted comma- or newline-separated list.">
        <Grid>
          <TagsInput label="Tags" tags={tags} onChange={setTags} max={6} hint="Enter or comma to add." />
          <div className="flex flex-col gap-3">
            <Note>SearchField — a pill, because it filters a view rather than holding a value</Note>
            <SearchField value={query} onChange={setQuery} placeholder="Search a customer…" fullWidth />
          </div>
        </Grid>
      </Section>

      <Section
        title="Dates and times"
        note="Values are ISO strings, never Date objects — a Date carries a time and a zone that a calendar date does not, and the two disagree the moment a user west of UTC picks a day."
      >
        <Grid>
          <DatePicker
            label="Launch date"
            value={date}
            onChange={setDate}
            presets={[
              { label: "Today", get: () => new Date().toISOString().slice(0, 10) },
              { label: "In a week", get: () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) },
            ]}
          />
          <TimePicker label="Service starts" value={time} onChange={setTime} step={30} />
        </Grid>
        <Grid cols={1}>
          <DateRangePicker
            label="Reporting period"
            from={range.from}
            to={range.to}
            onChange={(from, to) => setRange({ from, to })}
          />
          <DateTimeField
            date={date}
            time={time}
            onDateChange={setDate}
            onTimeChange={setTime}
            help="Both halves stay separate values; joining them is the caller's job."
          />
        </Grid>
      </Section>

      <Section
        title="Money, phone, files"
        note="AmountField's decimal count follows the currency — euros take two, yen take none — which is why the currency lives inside the field."
      >
        <Grid>
          <AmountField
            value={price}
            onChange={setPrice}
            currency={ccy}
            onCurrencyChange={setCcy}
            presets={[19, 29, 49, 99]}
          />
          <PhoneField value={phone} onChange={setPhone} country={dial} onCountryChange={setDial} />
        </Grid>
        <Grid>
          <EmailListInput emails={recipients} onChange={setRecipients} max={5} />
          <RecordLookup
            label="Linked customers"
            multiple
            values={linked}
            onChange={setLinked}
            records={[
              { id: "1", label: "Marie Dupont", secondary: "42 passages", type: "person" },
              { id: "2", label: "Jean Bernard", secondary: "18 passages", type: "person" },
              { id: "3", label: "Table 4", secondary: "Terrace", type: "thing", icon: "armchair" },
            ]}
            createLabel={(q) => `Create "${q}"`}
            onCreate={() => undefined}
          />
        </Grid>
        <Grid cols={1}>
          <FileDrop
            label="Logo"
            files={[
              { name: "logo.svg", size: 24_400, done: true },
              { name: "cover.jpg", size: 1_240_000, progress: 62 },
              { name: "menu.pdf", size: 3_100_000, error: "Too large (2 MB maximum)." },
            ]}
            onFiles={() => undefined}
            onRemove={() => undefined}
            onRetry={() => undefined}
          />
        </Grid>
      </Section>

      <Section
        title="Assembly"
        note="A form is a stack of named decisions. The title column on the left is a table of contents the eye can run down without reading a single field."
      >
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <FormStepper
            steps={[
              { label: "Your restaurant", hint: "Name and address" },
              { label: "The programme", hint: "Stamps and reward" },
              { label: "Review" },
            ]}
            current={step}
            onStepClick={setStep}
          />

          <div className="flex flex-col">
            <FormSection
              title="The programme"
              description="How many visits before the reward, and what the reward is."
              divider={false}
            >
              <FormGrid>
                <ChoiceCard
                  name="plan2"
                  value="growth"
                  selected={plan2 === "growth"}
                  onSelect={setPlan2}
                  icon="gift"
                  title="Stamp card"
                  description="Ten visits, the eleventh on the house."
                  badge="Popular"
                />
                <ChoiceCard
                  name="plan2"
                  value="points"
                  selected={plan2 === "points"}
                  onSelect={setPlan2}
                  icon="star"
                  title="Points"
                  description="One point per euro, redeemable against anything."
                />
              </FormGrid>
            </FormSection>

            <FormSummary
              groups={[
                {
                  title: "Your restaurant",
                  items: [
                    { label: "Name", value: "Le Bistrot du Coin" },
                    { label: "Address", value: "12 rue des Lilas, Paris" },
                    { label: "Phone", missing: true },
                  ],
                },
                {
                  title: "The programme",
                  items: [
                    { label: "Type", value: "Stamp card", strong: true },
                    { label: "Stamps", value: "10" },
                  ],
                },
              ]}
              onEdit={() => undefined}
            />

            <FormActions
              dirty
              sticky={false}
              primary={<span className="inline-flex h-12 items-center rounded-pill bg-accent px-7 text-button font-medium text-accent-ink">Publish</span>}
              secondary={<span className="inline-flex h-12 items-center rounded-pill border-[1.5px] border-border-subtle px-7 text-button font-medium">Save draft</span>}
            />
          </div>
        </div>
      </Section>

      <Section title="Sizes" note="sm 36 · md 48 · counter 56. Counter is the standing, at-the-counter target.">
        <Grid cols={3}>
          <Input label="Small" size="sm" placeholder="36px" />
          <Input label="Medium" size="md" placeholder="48px" />
          <Input label="Counter" size="counter" placeholder="56px" />
        </Grid>
      </Section>

      <Section
        title="Rich text"
        note="The value is HTML and it is assigned to innerHTML, so it is sanitised in both directions — whether it arrived from these keystrokes or from a record somebody else can write to. Pasting inserts plain text only: a paste from a word processor otherwise carries in fonts and shading that no amount of sanitising makes belong here. The link prompt is a panel, not window.prompt."
      >
        <RichTextEditor
          label="Message to the customer"
          hint="Bold, italics, lists and links."
          value={richText}
          onChange={setRichText}
          maxLength={400}
        />
      </Section>
    </div>
  );
}
