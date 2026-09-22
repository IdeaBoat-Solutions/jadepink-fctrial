"use client";

/* Boutique image — next/image with a load fade so photos settle in instead
   of popping. Space is pre-reserved by width/height + aspect classes at the
   call site, so there is no layout shift. Client-side only for the onLoad
   flip; motion-safe keeps reduced-motion users on an instant swap. */

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function BoutiqueImage({ className, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is a required ImageProps field, forwarded via spread
    <Image
      {...props}
      onLoad={() => setLoaded(true)}
      className={`${className ?? ""} motion-safe:transition-opacity motion-safe:duration-500 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
