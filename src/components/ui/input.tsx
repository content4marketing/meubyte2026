import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    hint?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, type, id, ...props }, ref) => {
        const inputId = id || React.useId()

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
                        {label}
                    </label>
                )}
                <input
                    id={inputId}
                    type={type}
                    className={cn(
                        'w-full px-3 py-2 border rounded-lg text-gray-900 placeholder-gray-400',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent',
                        'transition-colors duration-200',
                        error
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500',
                        'disabled:bg-gray-100 disabled:cursor-not-allowed',
                        className
                    )}
                    ref={ref}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    {...props}
                />
                {error && (
                    <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p id={`${inputId}-hint`} className="mt-1 text-sm text-gray-500">
                        {hint}
                    </p>
                )}
            </div>
        )
    }
)
Input.displayName = 'Input'

export { Input }
