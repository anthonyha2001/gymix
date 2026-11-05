"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell } from "lucide-react";

// Shake the phone (three times, quickly) to open the Programs page. The shake
// itself is recognised by MotionGestures; iPhones need motion permission once.
export function ShakeQuickStart({ href }: { href: string }) {
  const router = useRouter();
  // A lime wave fills the screen, then the program opens underneath it.
  const [wave, setWave] = useState(0);

  useEffect(() => {
    const onShake = () => {
      navigator.vibrate?.(40);
      setWave(Date.now());
      router.prefetch(href);
      setTimeout(() => router.push(href), 350);
    };
    window.addEventListener("gymix:shake", onShake);
    return () => window.removeEventListener("gymix:shake", onShake);
  }, [href, router]);

  if (!wave) return null;
  return (
    <div key={wave} aria-hidden className="shake-wave" onAnimationEnd={(e) => e.target === e.currentTarget && setWave(0)}>
      <span className="shake-wave-label">
        <Dumbbell className="size-10" />
        My programs
      </span>
    </div>
  );
}
