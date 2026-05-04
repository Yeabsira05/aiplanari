export type Deadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "assignment" | "exam";
  url?: string;
  description?: string;
  urgencyScore?: number;
  aiReason?: string;
  aiStudyTip?: string;
};
