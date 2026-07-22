"use client";

import { Button, type ButtonProps } from "@/components/ui/button";

export function ConfirmSubmitButton({ confirmation, ...props }: ButtonProps & { confirmation: string }) {
  return <Button {...props} onClick={(event) => {
    props.onClick?.(event);
    if (!event.defaultPrevented && !window.confirm(confirmation)) event.preventDefault();
  }} />;
}
