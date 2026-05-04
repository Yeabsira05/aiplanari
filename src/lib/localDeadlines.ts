export type LocalDeadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "exam" | "assignment";
};

export function getLocalDeadlines(): LocalDeadline[] {
  const data = localStorage.getItem("local_deadlines");
  return data ? JSON.parse(data) : [];
}

export function saveLocalDeadlines(deadlines: LocalDeadline[]) {
  localStorage.setItem("local_deadlines", JSON.stringify(deadlines));
}