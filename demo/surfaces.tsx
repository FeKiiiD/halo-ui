import * as React from "react";
import {
  Alert,
  AvatarStack,
  Badge,
  BottomSheet,
  Breadcrumbs,
  Button,
  ConfirmDialog,
  Drawer,
  FeatureCard,
  Footer,
  Icon,
  IconChip,
  LogoBand,
  MediaCard,
  Modal,
  ModalButton,
  Navbar,
  NotificationCard,
  PricingCard,
  SpotlightCard,
  StatCard,
  StepDialog,
  TeamCard,
  TestimonialCard,
  DocumentEditor,
  WhiteboardBlock,
  type Block,
  type Whiteboard,
} from "../src";
import { Section } from "./forms";

function Grid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={
        cols === 2
          ? "grid gap-6 md:grid-cols-2"
          : cols === 4
            ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      }
    >
      {children}
    </div>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {label ? <span className="text-body-s text-text-secondary">{label}</span> : null}
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

const people = [
  { name: "Marie Dupont" },
  { name: "Jean Bernard" },
  { name: "Alice Moreau" },
  { name: "Paul Girard" },
  { name: "Chloé Petit" },
  { name: "Hugo Blanc" },
];

const slow = (ms = 1200) => () => new Promise((resolve) => setTimeout(resolve, ms));
const fails = (ms = 1000) => () =>
  new Promise((_, reject) => setTimeout(() => reject(new Error("The server refused.")), ms));


// A small sketch: a stroke, two boxes, an arrow and a note.
const boardSeed: Whiteboard = {
  shapes: [
    { id: "w1", kind: "rect", x: 40, y: 40, x2: 200, y2: 110, stroke: "var(--color-text-primary)", fill: "var(--color-mist)", width: 2 },
    { id: "w2", kind: "text", x: 60, y: 62, w: 130, h: 28, text: "At the counter", stroke: "var(--color-text-primary)" },
    { id: "w3", kind: "arrow", x: 210, y: 75, x2: 300, y2: 75, stroke: "var(--color-info)", width: 2 },
    { id: "w4", kind: "ellipse", x: 310, y: 40, x2: 470, y2: 110, stroke: "var(--color-success)", width: 2 },
    { id: "w5", kind: "text", x: 335, y: 62, w: 130, h: 28, text: "Card credited", stroke: "var(--color-text-primary)" },
    { id: "w6", kind: "note", x: 130, y: 150, w: 180, h: 96, text: "Three seconds, nothing to download.", fill: "var(--color-accent)" },
    {
      id: "w7", kind: "pen", x: 0, y: 0, stroke: "var(--color-error)", width: 2.5,
      points: [
        { x: 330, y: 150 }, { x: 348, y: 176 }, { x: 372, y: 198 }, { x: 402, y: 210 },
        { x: 434, y: 206 }, { x: 456, y: 188 }, { x: 466, y: 162 }, { x: 458, y: 140 },
      ],
    },
  ],
};


const docSeed: Block[] = [
  { id: "d1", type: "h1", html: "How a stamp gets credited" },
  { id: "d2", type: "p", html: "The whole exchange takes about three seconds, and the customer never installs anything." },
  { id: "d3", type: "h2", html: "At the counter" },
  { id: "d4", type: "numbered", html: "The customer gives their phone number." },
  { id: "d5", type: "numbered", html: "The staff member taps <b>Credit</b>." },
  { id: "d6", type: "numbered", html: "The card updates on the customer's phone." },
  { id: "d7", type: "callout", html: "No app, no password, no account to reset at the till." },
  { id: "d8", type: "h2", html: "What the platform does" },
  { id: "d9", type: "todo", html: "Find the card by phone number", checked: true },
  { id: "d10", type: "todo", html: "Write the visit, append-only", checked: true },
  { id: "d11", type: "todo", html: "Send the wallet push", checked: false },
  {
    id: "d12", type: "code", lang: "sql",
    html: "select count(*) from visits&#10;where card_id = $1 and at &gt; now() - interval '90 days';",
  },
  { id: "d13", type: "quote", html: "It takes three seconds and the customers actually use it." },
  {
    id: "d14", type: "kpis",
    caption: "Ninety days",
    kpis: [
      { label: "Cards in circulation", value: "1 208", delta: 14 },
      { label: "Active", value: "842", delta: 9 },
      { label: "Redemption rate", value: "11,4", unit: "%", delta: -2 },
    ],
  },
  { id: "d15", type: "divider" },
  {
    id: "d16", type: "signature",
    caption: "Approved by",
    people: [
      { name: "Marie Dupont", role: "Owner", email: "marie@example.fr", signedAt: "2026-08-24" },
      { name: "Jean Bernard", role: "Chef", email: "jean@example.fr" },
    ],
  },
];

export function SurfacesSheet() {
  const [board, setBoard] = React.useState(boardSeed);
  const [doc, setDoc] = React.useState(docSeed);
  const [docTitle, setDocTitle] = React.useState("Crediting a visit");
  const [modal, setModal] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [destructive, setDestructive] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [wizard, setWizard] = React.useState(false);
  const [tab, setTab] = React.useState("details");

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Feedback"
        note="A badge labels, an alert explains, a notification reports. The tone is carried by a chip and a wash — never by flooding the surface, which makes a page of two alerts unreadable."
      >
        <Row label="Badges">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Popular</Badge>
          <Badge tone="success">Live</Badge>
          <Badge tone="warning">Expiring</Badge>
          <Badge tone="error">Failed</Badge>
          <Badge tone="info">Draft</Badge>
        </Row>

        <div className="flex flex-col gap-4">
          <Alert tone="info" title="Your programme is in draft." onDismiss={() => undefined}>
            Publish it to let customers add their card at the counter.
          </Alert>
          <Alert tone="success" title="Programme published.">
            Customers can add their card from now on.
          </Alert>
          <Alert
            tone="warning"
            title="Two covers were not credited."
            action={
              <>
                <Button size="sm" variant="secondary">
                  Review
                </Button>
                <Button size="sm" variant="texted">
                  Ignore
                </Button>
              </>
            }
          >
            The scanner lost connection during service on Tuesday.
          </Alert>
          <Alert tone="error" density="compact">
            The card could not be read. Try again.
          </Alert>
        </div>

        <Grid cols={2}>
          <NotificationCard
            actor={{ name: "Marie Dupont" }}
            action="credited a reward to"
            object="table 4"
            time="12 minutes ago"
            workspace={{ label: "Le Bistrot du Coin" }}
            marker="verified"
            onDismiss={() => undefined}
          />
          <NotificationCard
            actor={{ name: "Jean Bernard" }}
            action="uploaded"
            object="the new menu"
            time="Yesterday"
            status="read"
            attachment={{ name: "menu-automne.pdf", meta: "1.2 MB" }}
            actions={
              <>
                <Button size="sm" variant="secondary">
                  Open
                </Button>
                <Button size="sm" variant="texted">
                  Later
                </Button>
              </>
            }
            onDismiss={() => undefined}
          />
        </Grid>
      </Section>

      <Section
        title="Overlays"
        note="The primary action carries the request: a spinner while it runs, a drawn tick before the dialog closes, an error inside the panel if it fails. A dialog that closes optimistically makes the user hunt for what went wrong."
      >
        <Row label="Press any of these — the failing one keeps the dialog open">
          <Button onClick={() => setModal(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Confirm
          </Button>
          <Button variant="outlined" onClick={() => setDestructive(true)}>
            Delete (hold)
          </Button>
          <Button variant="outlined" onClick={() => setDrawer(true)}>
            Drawer
          </Button>
          <Button variant="outlined" onClick={() => setSheet(true)}>
            Counter sheet
          </Button>
          <Button variant="outlined" onClick={() => setWizard(true)}>
            Wizard
          </Button>
          <ModalButton
            title="Loyalty programme."
            description="Ten visits, the eleventh on the house. Customers add their card at the counter, with nothing to download."
            onConfirm={slow()}
          >
            Grows from its button
          </ModalButton>
        </Row>

        <Modal
          open={modal}
          onClose={() => setModal(false)}
          icon="store"
          title="Publish this programme?"
          subtitle="It becomes available at the counter immediately."
          primaryLabel="Publish"
          doneLabel="Published."
          onPrimary={slow()}
        >
          <p className="m-0 text-text-secondary">
            Customers already holding a card keep their stamps. Nothing is reset.
          </p>
        </Modal>

        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          question="Send the reminder to 1 208 customers?"
          detail="They have not visited in more than fifteen days."
          confirmLabel="Send"
          onConfirm={fails()}
        />

        <ConfirmDialog
          open={destructive}
          onClose={() => setDestructive(false)}
          tone="destructive"
          title="Delete this programme."
          question="This cannot be undone."
          consequences={[
            "1 208 cards will stop working immediately.",
            "The history of credited rewards is kept.",
            "Customers are not notified.",
          ]}
          confirmLabel="Delete"
          hold
          onConfirm={slow()}
        />

        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          icon="users"
          title="Marie Dupont"
          subtitle="42 visits · since March 2025"
          tabs={[
            { value: "details", label: "Details" },
            { value: "history", label: "History" },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          footer={
            <>
              <Button variant="outlined" size="sm">
                Export
              </Button>
              <Button size="sm">Credit a reward</Button>
            </>
          }
        >
          <p className="m-0 text-text-secondary">
            {tab === "details"
              ? "A drawer keeps the page visible beside it, so the row being edited stays on screen."
              : "Every visit, in order, with the service it fell in."}
          </p>
        </Drawer>

        <BottomSheet
          open={sheet}
          onClose={() => setSheet(false)}
          icon="qr-code"
          title="Scan a card"
          subtitle="Hold the customer's phone up to the reader."
          actions={
            <>
              <Button size="counter" fullWidth>
                Scan
              </Button>
              <Button variant="outlined" size="counter" fullWidth onClick={() => setSheet(false)}>
                Cancel
              </Button>
            </>
          }
        >
          <p className="m-0 text-text-secondary">
            Drag this sheet down to dismiss it — the gesture works with a mouse too.
          </p>
        </BottomSheet>

        <StepDialog
          open={wizard}
          onClose={() => setWizard(false)}
          onFinish={slow()}
          steps={[
            {
              label: "Restaurant",
              title: "Tell us about the place.",
              content: <p className="m-0 text-text-secondary">Name, address, opening days.</p>,
            },
            {
              label: "Programme",
              title: "How many visits before the reward?",
              content: <p className="m-0 text-text-secondary">Ten is the usual answer.</p>,
            },
            {
              label: "Review",
              title: "Everything in order?",
              content: <p className="m-0 text-text-secondary">Publishing takes effect at once.</p>,
            },
          ]}
        />
      </Section>

      <Section
        title="Cards"
        note="No shadow and no border: cards separate from the mist ground by value alone. Exactly one card per grid is inverted — it exists to break the reading rhythm, and two of them break nothing."
      >
        <Grid>
          <FeatureCard
            icon={<IconChip icon={<Icon name="qr-code" />} />}
            title="A card in three seconds."
            body="At the counter, nothing to download. The customer scans and it is done."
          />
          <FeatureCard
            icon={<IconChip icon={<Icon name="zap" />} inverted />}
            eyebrow="Automatic"
            title="Reminders that run themselves."
            body="Fifteen days without a visit and the message goes out on its own."
            inverted
            cta={{ label: "See how" }}
          />
          <FeatureCard
            icon={<IconChip icon={<Icon name="line-chart" />} inverted />}
            title="Covers won back, counted."
            body="Not engagement. Covers."
            halo
            footerIcons={[
              { icon: <Icon name="users" size={14} />, label: "1 208 customers" },
              { icon: <Icon name="store" size={14} />, label: "3 sites" },
            ]}
          />
        </Grid>

        <Grid cols={4}>
          <StatCard label="Covers won back" value="1 208" delta={18} deltaLabel="vs last month" accent />
          <StatCard label="Active cards" value="842" delta={4} deltaLabel="this week" />
          <StatCard label="Rewards credited" value="96" delta={-3} deltaLabel="vs last month" />
          <StatCard label="Average basket" value="24" unit="€" inverted />
        </Grid>

        <Grid>
          <PricingCard
            name="Starter"
            subtitle="One site"
            price="0 €"
            period="/ month"
            features={["Up to 200 cards", "One programme", "Email support"]}
            excluded={["Automatic reminders", "Multi-site"]}
            cta={{ label: "Start free" }}
          />
          <PricingCard
            name="Growth"
            subtitle="Up to three sites"
            price="29 €"
            oldPrice="49 €"
            period="/ month"
            badge="Popular"
            featured
            highlight={{ icon: <Icon name="zap" size={16} />, label: "Reminders included" }}
            features={["Unlimited cards", "Automatic reminders", "Counter mode", "Priority support"]}
            cta={{ label: "Choose Growth" }}
          />
          <PricingCard
            name="Scale"
            subtitle="Chains"
            price="On request"
            period=""
            features={["Everything in Growth", "Unlimited sites", "API access", "Dedicated contact"]}
            cta={{ label: "Talk to us" }}
          />
        </Grid>

        <Grid>
          <TestimonialCard
            quote="We stopped guessing. The number of covers we win back is on the screen every morning."
            author="Marie Dupont"
            role="Owner"
            place="Le Bistrot du Coin"
            initials="MD"
            stat={{ value: "+18 %", label: "repeat visits" }}
          />
          <TeamCard
            eyebrow="Your team"
            title="Six people can credit a reward."
            body="Each one signs in with their own code at the counter."
            people={people}
            caption="and 2 others"
            action={{ label: "Invite someone" }}
            cta={{ label: "Manage access" }}
          />
          <SpotlightCard
            icon={<IconChip icon={<Icon name="gift" />} inverted />}
            eyebrow="Counter mode"
            title="Built for standing up."
            body="Move the pointer across this card — the glow follows it."
            cta={{ label: "See counter mode" }}
          />
        </Grid>

        <Grid cols={2}>
          <MediaCard
            kind="video"
            duration="2 min"
            eyebrow="Demo"
            title="Ten minutes, start to finish."
            body="Building a programme from scratch, in real time."
            meta="Recorded in a working kitchen"
            cta={{ label: "Watch" }}
          />
          <MediaCard
            layout="overlay"
            eyebrow="Case study"
            title="Three sites, one programme."
            body="How a small group runs the same card across three kitchens."
            tags={["Multi-site", "Reminders"]}
            cta={{ label: "Read" }}
          />
        </Grid>

        <Row label="Avatar stacks — the ring must match the surface behind it">
          <AvatarStack people={people} />
          <AvatarStack people={people} size="lg" max={3} />
          <span className="inline-flex rounded-card bg-ink p-4">
            <AvatarStack people={people} tone="dark" ring="ink" />
          </span>
        </Row>
      </Section>

      <Section
        title="Navigation"
        note="Menus open on hover with a delay in both directions: 70ms to open so passing the cursor does not flash three panels, 300ms to close so the diagonal towards a panel does not lose it."
      >
        <div className="flex flex-col gap-3">
          <span className="text-body-s text-text-secondary">
            On the ink régime — hover “Product” and “Resources”
          </span>
          <div className="halo-halo rounded-card px-6">
            <Navbar
              brand="Halo"
              activeHref="/pricing"
              action="Create a programme"
              links={[
                {
                  label: "Product",
                  menu: {
                    kind: "mega",
                    width: 720,
                    columns: [
                      {
                        title: "For the counter",
                        items: [
                          { label: "Scan a card", icon: "qr-code", description: "Three seconds, no app." },
                          { label: "Credit a reward", icon: "gift", description: "Held to confirm." },
                        ],
                      },
                      {
                        title: "For the office",
                        items: [
                          { label: "Programmes", icon: "layout-dashboard", description: "Build and publish." },
                          { label: "Customers", icon: "users", description: "Who comes back." },
                        ],
                      },
                    ],
                    media: [{ kind: "video", title: "See it in use", meta: "2 min", duration: "2 min" }],
                  },
                },
                {
                  label: "Resources",
                  menu: {
                    kind: "list",
                    width: 260,
                    items: [
                      { label: "Guides", icon: "book-open", description: "Getting started" },
                      { label: "Changelog", icon: "history", badge: "New" },
                      {
                        label: "Support",
                        icon: "life-buoy",
                        items: [
                          { label: "Contact us", icon: "mail" },
                          { label: "Status", icon: "activity" },
                        ],
                      },
                      { label: "Sign out", icon: "log-out", tone: "error", separated: true },
                    ],
                  },
                },
                { label: "Pricing", href: "/pricing" },
              ]}
            />
          </div>
        </div>

        <Row label="Breadcrumbs — a long path collapses in the middle, not at the end">
          <Breadcrumbs
            items={[
              { label: "Home", icon: "house" },
              { label: "Sites" },
              { label: "Le Bistrot du Coin" },
              { label: "Programmes" },
              { label: "Autumn card" },
            ]}
          />
        </Row>

        <LogoBand
          intro="Already running at"
          names={["Le Bistrot du Coin", "Chez Marcel", "La Cantine", "Café des Halles"]}
        />

        <Footer
          brand="Halo"
          tagline="We do not sell loyalty. We sell covers won back."
          columns={[
            {
              title: "Product",
              links: [
                { label: "Counter mode" },
                { label: "Programmes" },
                { label: "Reminders", badge: "New" },
              ],
            },
            { title: "Company", links: [{ label: "About" }, { label: "Careers" }] },
            { title: "Legal", links: [{ label: "Privacy" }, { label: "Terms" }] },
          ]}
          contact={[
            { label: "hello@example.com", icon: "mail" },
            { label: "+33 1 23 45 67 89", icon: "phone" },
          ]}
          socials={[{ icon: "linkedin" }, { icon: "github" }]}
          newsletter={{
            title: "One email a month.",
            note: "What shipped, and what we learned at the counter.",
          }}
          legal={[{ label: "Privacy" }, { label: "Terms" }]}
          className="-mx-page rounded-card"
        />
      </Section>

      <Section
        title="Whiteboard"
        note="The thumbnail is a crop, not a scale. A board grows past its frame as soon as anyone uses it, and shrinking the whole thing to fit turns a diagram into a smudge in the document that embeds it — so the author frames the part that matters and the rest keeps existing off-screen. Press Edit for the unbounded canvas."
      >
        <WhiteboardBlock value={board} onChange={setBoard} height={280} />
      </Section>

      <Section
        title="Document"
        note="Every block is a row in a flat list, not a node in a tree. Nesting is what makes a block editor hard to reason about and easy to corrupt — a list inside a quote inside a callout has no obvious backspace behaviour — so every operation here is an array splice. Press / on an empty line for the palette. Export to HTML or Markdown."
      >
        <DocumentEditor
          value={doc}
          onChange={setDoc}
          title={docTitle}
          onTitleChange={setDocTitle}
          minHeight={420}
          onSave={() => new Promise((resolve) => setTimeout(resolve, 700))}
        />
      </Section>
    </div>
  );
}
