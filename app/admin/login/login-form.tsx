"use client";

import { type ReactNode, useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { loginAction, type LoginState } from "../_actions/auth";

export function LoginForm({ next }: { next: string }): ReactNode {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  );
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email) || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={state?.email ?? ""}
            required
            aria-invalid={Boolean(errors.email)}
            className="h-10"
          />
          <FieldError>{errors.email}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.password) || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(errors.password)}
            className="h-10"
          />
          <FieldError>{errors.password}</FieldError>
        </Field>
        {state?.error && !errors.email && !errors.password ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? <Spinner /> : null}
          Masuk
        </Button>
      </FieldGroup>
    </form>
  );
}
