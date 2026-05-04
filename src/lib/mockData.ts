export type Deadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "assignment" | "exam";
};

export const deadlines: Deadline[] = [
  {
    id: "1",
    course: "Web Development",
    title: "Final Project",
    dueDate: "2026-05-08",
    type: "assignment",
  },
  {
    id: "2",
    course: "Operating Systems",
    title: "Final Exam",
    dueDate: "2026-05-15",
    type: "exam",
  },
  {
    id: "3",
    course: "Innovation",
    title: "Business Model Presentation",
    dueDate: "2026-05-03",
    type: "assignment",
  },
];