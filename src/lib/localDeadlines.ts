import type { Deadline } from "@/lib/types";

export type LocalDeadline = Deadline;

export function getLocalDeadlines(): LocalDeadline[] {
  const data = localStorage.getItem("local_deadlines");
  return data ? JSON.parse(data) : [];
}

export function saveLocalDeadlines(deadlines: LocalDeadline[]) {
  localStorage.setItem("local_deadlines", JSON.stringify(deadlines));
}