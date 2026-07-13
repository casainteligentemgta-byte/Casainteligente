import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    'flex min-h-[80px] w-full rounded-md border border-[#E5E5EA] bg-white px-3 py-2 text-sm text-[#1C1C1E] placeholder:text-[#8E8E93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Textarea.displayName = 'Textarea';

export { Textarea };
