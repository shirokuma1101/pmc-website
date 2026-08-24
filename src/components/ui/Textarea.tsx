"use client";

import { useId } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";

import { classNames } from "./classNames";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export function Textarea({
  label,
  hint,
  error,
  id,
  className,
  containerClassName,
  required,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={classNames("field", containerClassName)}>
      <label className="field__label" htmlFor={textareaId}>
        {label}
        {required ? <span className="field__required">必須</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <textarea
        id={textareaId}
        className={classNames("textarea", Boolean(error) && "input--error", className)}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        required={required}
        {...props}
      />
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
