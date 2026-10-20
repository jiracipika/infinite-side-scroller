"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * MotionStagger — spring fade-up reveal for one start-screen block.
 *
 * Purely presentational: renders a plain passthrough div, changes no aria
 * attributes, and (for reduced-motion users) applies no initial hidden
 * state, so content is never invisible when animations are off.
 */
export default function MotionStagger({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  // Keep the same Motion node through hydration. Swapping an initially-hidden
  // motion.div for a plain div left its server-rendered opacity:0 inline style
  // on reduced-motion clients (the Play button and title stayed invisible).
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, transform: "translateY(14px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.25, duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}
