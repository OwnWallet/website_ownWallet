"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Enter-only fade: no exit animation, so navigation never waits on the previous page to animate out.
export function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
