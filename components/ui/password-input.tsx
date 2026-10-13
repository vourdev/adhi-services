"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * A password (or secret key) field with an eye button that shows what was
 * typed. `className` sizes the outer group, like the height of an Input.
 */
function PasswordInput({
  className,
  showLabel = "Tampilkan password",
  hideLabel = "Sembunyikan password",
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  showLabel?: string;
  hideLabel?: string;
}): ReactNode {
  const [visible, setVisible] = useState(false);
  const label = visible ? hideLabel : showLabel;
  return (
    <InputGroup className={className}>
      <InputGroupInput
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={label}
          aria-pressed={visible}
          title={label}
          disabled={props.disabled}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };
