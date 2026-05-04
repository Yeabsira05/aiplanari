import { getDaysLeft, getUrgency } from "@/lib/dates";

type Deadline = {
  id: string;
  course: string;
  title: string;
  dueDate: string;
  type: "assignment" | "exam";
};

type Props = {
  deadline: Deadline;
  onDone: (id: string) => void;
};

export default function DeadlineCard({ deadline, onDone }: Props) {
  const daysLeft = getDaysLeft(deadline.dueDate);
  const urgency = getUrgency(daysLeft);

  const isUrgent = daysLeft <= 2;
  const isSoon = daysLeft > 2 && daysLeft <= 7;

  const cardStyle = isUrgent
    ? "border-red-200 bg-red-50"
    : isSoon
    ? "border-yellow-200 bg-yellow-50"
    : "border-green-200 bg-green-50";

  const badgeStyle = isUrgent
    ? "bg-red-600 text-white"
    : isSoon
    ? "bg-yellow-500 text-white"
    : "bg-green-600 text-white";

  const progress = Math.max(8, Math.min(100, 100 - daysLeft * 7));

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition hover:scale-[1.02] hover:shadow-md ${cardStyle}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-600">
            {deadline.course}
          </p>

          <h2 className="mt-1 text-xl font-bold text-gray-900">
            {deadline.title}
          </h2>

          <p className="mt-2 text-sm text-gray-700">
            Due: {new Date(deadline.dueDate).toLocaleDateString()}
          </p>

          <p className="mt-1 text-sm font-semibold text-gray-900">
            {daysLeft === 0
              ? "Due today"
              : daysLeft === 1
              ? "1 day left"
              : `${daysLeft} days left`}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${badgeStyle}`}
        >
          {urgency}
        </span>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white">
        <div
          className={`h-2 rounded-full ${
            isUrgent ? "bg-red-600" : isSoon ? "bg-yellow-500" : "bg-green-600"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        onClick={() => onDone(deadline.id)}
        className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Done
      </button>
    </div>
  );
}