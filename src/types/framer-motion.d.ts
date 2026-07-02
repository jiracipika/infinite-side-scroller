declare module 'framer-motion' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react';

  type MotionProps = Record<string, unknown> & {
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
  };

  type MotionFactory = {
    div: ComponentType<MotionProps>;
    button: ComponentType<MotionProps>;
    h2: ComponentType<MotionProps>;
  };

  export const motion: MotionFactory;
  export const AnimatePresence: ComponentType<{
    children?: ReactNode;
    mode?: 'sync' | 'popLayout' | 'wait';
    initial?: boolean;
  }>;
}
