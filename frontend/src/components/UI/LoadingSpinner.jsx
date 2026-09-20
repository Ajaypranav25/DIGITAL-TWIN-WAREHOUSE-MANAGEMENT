import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-400">
      <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
      <span>{text}</span>
    </div>
  );
}