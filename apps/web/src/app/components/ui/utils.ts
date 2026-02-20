import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Screen reader only class - visually hidden but accessible to assistive technologies
 * WCAG 2.1 compliant sr-only implementation
 */
export const srOnlyClass = "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0";
