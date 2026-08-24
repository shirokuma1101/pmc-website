"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  containerClassName,
  required,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={classNames("field", containerClassName)}>
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required ? <span className="field__required">必須</span> : null}
      </label>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        id={inputId}
        className={classNames("input", Boolean(error) && "input--error", className)}
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
