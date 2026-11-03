import type { ComponentProps } from 'react'
import { useTheme } from '../domain/theme'
import { Button } from '../vendor/looseleaf/ui/button'

export function ThemedButton({ className = '', ...props }: ComponentProps<'button'>) {
  const [theme] = useTheme()
  if (theme === 'classic') return <button className={className} {...props} />
  const answeredOption = className.includes('option__pick') && props.disabled
  const variant = answeredOption ? 'outline'
    : props['aria-pressed'] === true && (className.includes('option__pick') || className.includes('segmented__item')) ? 'secondary'
    : className.includes('btn--primary') ? 'secondary'
    : className.includes('btn--ghost') ? 'ghost' : 'outline'
  const size = className.includes('btn--lg') ? 'lg' : className.includes('btn--sm') ? 'sm' : 'default'
  return <Button type="button" variant={variant} size={size} className={className} {...props}
    {...(answeredOption ? { disabled: false, 'aria-disabled': true, onClick: undefined } : {})} />
}
