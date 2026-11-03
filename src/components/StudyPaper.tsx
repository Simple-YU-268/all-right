import type { ComponentProps } from 'react'
import { useTheme } from '../domain/theme'
import { Paper } from '../vendor/looseleaf/ui/paper'

export function StudyPaper(props: ComponentProps<'div'>) {
  const [theme] = useTheme()
  return theme === 'looseleaf' ? <Paper stock="paper" edge={{ bottom: 'deckle' }} tilt={false} {...props} /> : <div {...props} />
}
