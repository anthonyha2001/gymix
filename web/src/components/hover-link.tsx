"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

// A link that loads its whole page (data included) as soon as the pointer or a
// finger is on it, so the click itself opens instantly. Meant for long lists,
// where prefetching every row up front would be wasteful.
export function HoverLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [warm, setWarm] = useState(false);
  const heat = () => setWarm(true);
  return (
    <Link
      {...props}
      prefetch={warm ? true : false}
      onMouseEnter={(e) => {
        heat();
        props.onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        heat();
        props.onTouchStart?.(e);
      }}
      onFocus={(e) => {
        heat();
        props.onFocus?.(e);
      }}
    />
  );
}
