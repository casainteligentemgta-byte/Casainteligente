import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ProcurementClient = dynamic(() => import('./ProcurementClient'), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="h-10 w-64 bg-zinc-900 rounded-xl animate-pulse mb-8" />
                <div className="flex gap-4 mb-8">
                    <div className="flex-1 h-32 bg-zinc-900/50 rounded-3xl animate-pulse" />
                    <div className="flex-1 h-32 bg-zinc-900/50 rounded-3xl animate-pulse" />
                </div>
                <div className="h-80 bg-zinc-900/30 rounded-3xl border border-zinc-800 animate-pulse" />
            </div>
        </div>
    ),
});

export default function ProcurementPage() {
    return (
        <Suspense fallback={null}>
            <ProcurementClient />
        </Suspense>
    );
}
