import { useState } from "react";
import { faviconUrl, iconDomainForTicker, monogramForTicker } from "@/lib/assetIcons";
import { cn } from "@/lib/cn";

type Props = {
  ticker: string;
  size?: 20 | 24 | 32;
  className?: string;
  domain?: string;
};

export function AssetIcon({ ticker, size = 24, className, domain }: Props) {
  const [failed, setFailed] = useState(false);
  const px = size;
  const mono = monogramForTicker(ticker);
  const src = faviconUrl(domain ?? iconDomainForTicker(ticker), size >= 24 ? 32 : 24);

  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-raised border border-border-subtle font-mono font-semibold text-ink-muted shrink-0",
          className,
        )}
        style={{ width: px, height: px, fontSize: px <= 20 ? 9 : 11 }}
        aria-hidden
      >
        {mono}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      className={cn("rounded-full border border-border-subtle bg-zinc-900 object-cover shrink-0", className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
