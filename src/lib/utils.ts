import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(amount: number, currency = "UGX") {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function friendlyError(error: { message: string } | null) {
  if (!error) return "Something went wrong.";
  const message = error.message;
  if (message.toLowerCase().includes("row-level security")) {
    return "You do not have permission to do that.";
  }
  if (message.toLowerCase().includes("duplicate")) {
    return "A record with that code already exists.";
  }
  return message;
}
