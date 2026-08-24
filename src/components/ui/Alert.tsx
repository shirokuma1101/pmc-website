import type { ReactNode } from "react";

import { classNames } from "./classNames";

export type AlertTone = "info" | "success" | "warning" | "error";

export interface AlertProps {
  children: ReactNode;
  title?: string;
  tone?: AlertTone;
  className?: string;
}

const marks: Record<AlertTone, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
};

export function Alert({ children, title, tone = "info", className }: AlertProps) {
  return (
    <div
      className={classNames("alert", `alert--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="alert__mark" aria-hidden="true">
        {marks[tone]}
      </span>
      <div>
        {title ? <p className="alert__title">{title}</p> : null}
        <div className="alert__body">{children}</div>
      </div>
    </div>
  );
}
