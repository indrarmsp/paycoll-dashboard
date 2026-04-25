import { LoaderCircle } from 'lucide-react';

export default function DashboardARLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <LoaderCircle className="mb-4 h-10 w-10 animate-spin text-brand-500" />
      <p className="font-medium text-slate-700">Please wait a moment</p>
      <p className="mt-1 text-sm text-slate-500">We are opening your AR dashboard.</p>
    </div>
  );
}