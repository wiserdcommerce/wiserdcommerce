"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Quiet, fast, intentional headline entrance (<= 280ms).
 * No gimmicky character scrambling; respects prefers-reduced-motion.
 */
export function TechScrambleHeadline({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        el,
        { opacity: 0.01, y: 6 },
        { opacity: 1, y: 0, duration: 0.28, ease: "power2.out", clearProps: "transform" }
      );
    });
    return () => mm.revert();
  }, [text]);

  return (
    <h1 ref={ref} className={`${className} font-medium leading-[1.1] tracking-[-0.02em]`}>
      {text}
    </h1>
  );
}

/**
 * Quiet section header container (no distracting scroll-triggered slides on every section).
 */
export function DirectionalReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}

/**
 * Crisp modal / overlay transition powered by GSAP (<= 220ms).
 */
export function CenterRevealPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.97, y: 6 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.22,
          ease: "power2.out",
          clearProps: "transform",
        }
      );
    });
    return () => mm.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function GridMosaicOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return null;
}

/**
 * Clean grid wrapper without repetitive scroll entrance animations.
 */
export function ScrollStaggerSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
