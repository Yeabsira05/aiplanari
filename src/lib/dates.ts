export function getDaysLeft(dueDate: string) {
  const today = new Date();
  const deadline = new Date(dueDate);

  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diff = deadline.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getUrgency(daysLeft: number) {
  if (daysLeft < 0) return "Overdue";
  if (daysLeft <= 2) return "Urgent";
  if (daysLeft <= 7) return "Soon";
  return "Upcoming";
}