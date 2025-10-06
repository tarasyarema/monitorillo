import * as React from 'react';
import { Label } from './label';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface FormFieldProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(({ label, error, className, ...props }, ref) => {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Input ref={ref} className={cn(error && 'border-destructive', className)} {...props} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});
FormField.displayName = 'FormField';

export { FormField as Input };
