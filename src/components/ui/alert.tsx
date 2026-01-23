import * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'info' | 'success' | 'warning' | 'error'
    title?: string
    dismissible?: boolean
    onDismiss?: () => void
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'info', title, dismissible, onDismiss, children, ...props }, ref) => {
        const variants = {
            info: {
                container: 'bg-blue-50 border-blue-200 text-blue-800',
                icon: <Info className="h-5 w-5 text-blue-500" />
            },
            success: {
                container: 'bg-green-50 border-green-200 text-green-800',
                icon: <CheckCircle className="h-5 w-5 text-green-500" />
            },
            warning: {
                container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
                icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
            },
            error: {
                container: 'bg-red-50 border-red-200 text-red-800',
                icon: <XCircle className="h-5 w-5 text-red-500" />
            }
        }

        const { container, icon } = variants[variant]

        return (
            <div
                ref={ref}
                role="alert"
                className={cn(
                    'relative flex gap-3 p-4 border rounded-lg',
                    container,
                    className
                )}
                {...props}
            >
                <div className="flex-shrink-0">{icon}</div>
                <div className="flex-1">
                    {title && <h4 className="font-medium mb-1">{title}</h4>}
                    <div className="text-sm">{children}</div>
                </div>
                {dismissible && onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>
        )
    }
)
Alert.displayName = 'Alert'

export { Alert }
