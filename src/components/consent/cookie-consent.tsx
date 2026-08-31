import * as React from "react";
import { cn } from "../../lib/cn";
import { Button } from "../core/button";
import { Switch } from "../forms/switch";

export interface ConsentCategory {
  id: string;
  label: string;
  description: string;
  /** Cannot be turned off. Shown fixed rather than as a disabled switch. */
  required?: boolean;
}

export interface CookieConsentProps {
  open?: boolean;
  title?: React.ReactNode;
  body?: React.ReactNode;
  categories?: ConsentCategory[];
  /** Current choices. Omit for an unmade decision. */
  values?: Record<string, boolean>;

  policyHref?: string;
  policyLabel?: string;

  onAccept?: (values: Record<string, boolean>) => void;
  onRefuse?: (values: Record<string, boolean>) => void;
  onSave?: (values: Record<string, boolean>) => void;

  position?: "bottom" | "top" | "inline";
  tone?: "ink" | "card";
  /** Forces a view, for a specimen sheet. */
  view?: "bar" | "panel";
  labels?: {
    acceptAll?: string;
    refuseAll?: string;
    customise?: string;
    save?: string;
    back?: string;
    required?: string;
  };
  className?: string;
}

export const defaultConsentCategories: ConsentCategory[] = [
  {
    id: "necessary",
    label: "Necessary",
    description: "Sign-in, security, and the basics. Without them the service does not work.",
    required: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "How many people open their dashboard, and from where. Aggregate figures only.",
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Which campaign brought you here, and not showing you the same one twice.",
  },
];

/**
 * A consent bar that opens into a panel.
 *
 * TWO VIEWS, ONE COMPONENT: the bar states the position in a sentence with
 * three buttons; "Customise" swaps it for the per-category panel. A bar that
 * links away to a settings page loses the decision half the time.
 *
 * REFUSE IS AS PROMINENT AS ACCEPT. Both are real buttons of the same size —
 * hiding refusal behind a link is the pattern regulators keep striking down,
 * and it is dishonest regardless.
 */
export function CookieConsent({
  open = true,
  title = "Three switches, then we leave you alone.",
  body = "We keep what makes the service run. The rest is your call — changeable at any time from the footer.",
  categories = defaultConsentCategories,
  values,
  policyHref = "#cookies",
  policyLabel = "Our cookie policy",
  onAccept,
  onRefuse,
  onSave,
  position = "bottom",
  tone = "ink",
  view,
  labels,
  className,
}: CookieConsentProps) {
  const [mode, setMode] = React.useState<"bar" | "panel">(view ?? "bar");

  const [choices, setChoices] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        category.required ? true : Boolean(values?.[category.id]),
      ]),
    ),
  );

  React.useEffect(() => {
    if (view) setMode(view);
  }, [view]);

  if (!open) return null;

  const text = {
    acceptAll: "Accept all",
    refuseAll: "Refuse all",
    customise: "Customise",
    save: "Save my choices",
    back: "Back",
    required: "Always on",
    ...labels,
  };

  const dark = tone === "ink";
  const all = () => Object.fromEntries(categories.map((category) => [category.id, true]));
  const none = () =>
    Object.fromEntries(categories.map((category) => [category.id, Boolean(category.required)]));

  return (
    <div
      className={cn(
        "z-300 overflow-hidden rounded-panel border shadow-float font-sans",
        position === "inline" ? "relative m-0" : "fixed inset-x-6 mx-auto",
        position === "bottom" && "bottom-6",
        position === "top" && "top-6",
        dark ? "border-ink-hairline bg-ink text-paper" : "border-border-subtle bg-surface-card text-text-primary",
        className,
      )}
      style={{
        maxWidth: mode === "bar" ? 1240 : 560,
        animation: "halo-consent-in 320ms cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {mode === "bar" ? (
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-[280px] flex-1">
            <p className="m-0 text-[15px] font-medium tracking-[-0.01em]">{title}</p>
            <p
              className={cn(
                "m-0 mt-1 text-pretty text-body-s",
                dark ? "text-text-muted-dark" : "text-text-secondary",
              )}
            >
              {body}{" "}
              <a
                href={policyHref}
                className={cn("underline underline-offset-2", dark ? "text-paper" : "text-text-primary")}
              >
                {policyLabel}
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="texted" size="sm" onDark={dark} onClick={() => setMode("panel")}>
              {text.customise}
            </Button>
            <Button variant="outlined" size="sm" onDark={dark} onClick={() => onRefuse?.(none())}>
              {text.refuseAll}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onAccept?.(all())}>
              {text.acceptAll}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="m-0 text-[15px] font-medium tracking-[-0.01em]">{title}</p>
            <a
              href={policyHref}
              className={cn(
                "mt-1 inline-block text-body-s underline underline-offset-2",
                dark ? "text-text-muted-dark" : "text-text-secondary",
              )}
            >
              {policyLabel}
            </a>
          </div>

          <ul className="m-0 flex list-none flex-col gap-0 p-0">
            {categories.map((category, index) => (
              <li
                key={category.id}
                className={cn(
                  "flex items-start gap-4 py-3.5",
                  index > 0 && (dark ? "border-t border-ink-hairline" : "border-t border-border-subtle"),
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body-s font-medium">{category.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-pretty text-[12.5px] leading-[1.45]",
                      dark ? "text-text-muted-dark" : "text-text-secondary",
                    )}
                  >
                    {category.description}
                  </span>
                </span>

                {category.required ? (
                  // A word rather than a disabled switch: a switch that cannot
                  // move invites people to keep trying it.
                  <span
                    className={cn(
                      "shrink-0 pt-0.5 text-[12.5px]",
                      dark ? "text-text-muted-dark" : "text-text-secondary",
                    )}
                  >
                    {text.required}
                  </span>
                ) : (
                  <Switch
                    checked={choices[category.id] ?? false}
                    onChange={(checked) =>
                      setChoices((current) => ({ ...current, [category.id]: checked }))
                    }
                    onDark={dark}
                    className="shrink-0 pt-0.5"
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {view ? null : (
              <Button variant="texted" size="sm" onDark={dark} onClick={() => setMode("bar")}>
                {text.back}
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="outlined" size="sm" onDark={dark} onClick={() => onRefuse?.(none())}>
              {text.refuseAll}
            </Button>
            <Button variant="primary" size="sm" onClick={() => onSave?.(choices)}>
              {text.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
