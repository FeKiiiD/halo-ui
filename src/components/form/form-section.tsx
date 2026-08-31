import * as React from "react";
import { cn } from "../../lib/cn";
import { SectionMarker } from "../core/section-marker";

export interface FormSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Extra content under the description: a note, a link, a small illustration. */
  aside?: React.ReactNode;
  /** `split` puts the title beside the fields; `stacked` puts it above. */
  layout?: "split" | "stacked";
  divider?: boolean;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * One named group of decisions in a form.
 *
 * The split layout — title left, fields right — is what makes a long settings
 * page scannable: the left column is a table of contents the eye can run down
 * without reading a single field. It collapses to stacked below the breakpoint,
 * where a 260px column would leave the fields too narrow to fill in.
 */
export function FormSection({
  title,
  description,
  aside,
  layout = "split",
  divider = true,
  id,
  children,
  className,
}: FormSectionProps) {
  const split = layout === "split";

  return (
    <section
      id={id}
      className={cn(
        "grid py-8 font-sans",
        split
          ? "gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:gap-12"
          : "gap-6 grid-cols-1",
        divider && "border-t border-border-subtle",
        className,
      )}
    >
      <div>
        <SectionMarker />
        <h3 className="mb-2 mt-0 text-[20px] font-semibold leading-[1.25] tracking-[-0.01em] text-text-primary">
          {title}
        </h3>
        {description ? (
          <p className="m-0 text-pretty text-body-s leading-[1.55] text-text-secondary">
            {description}
          </p>
        ) : null}
        {aside ? <div className="mt-4">{aside}</div> : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
