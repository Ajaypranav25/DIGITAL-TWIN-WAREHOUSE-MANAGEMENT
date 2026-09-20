import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'No data', message = 'There is nothing to display here.' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border border-dashed border-slate-700 rounded-lg bg-slate-800/50">
      <Inbox className="h-12 w-12 mb-4 text-slate-500" />
      <h3 className="text-lg font-medium text-slate-200">{title}</h3>
      <p className="mt-1">{message}</p>
    </div>
  );
}