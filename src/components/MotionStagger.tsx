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
  if (reduced) {
    return <div>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0.25, duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}
