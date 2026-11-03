import { useTheme, type Theme } from '../domain/theme'
import { RadioGroup, RadioGroupItem } from '../vendor/looseleaf/ui/radio-group'

export function ThemePicker() {
  const [theme, setTheme] = useTheme()
  if (theme === 'looseleaf') return (
    <fieldset className="theme-picker">
      <legend className="settingrow__name">界面主题</legend>
      <RadioGroup value={theme} onValueChange={value => setTheme(value as Theme)} className="theme-picker__choices" aria-label="界面主题">
        {([['classic', '油印卷子', '原版 · 靛蓝与冷灰'], ['looseleaf', '手绘笔记', 'Looseleaf · 独立学习工作区']] as const).map(([value, name, description]) => <label htmlFor={`theme-${value}`} key={value} className={`theme-choice theme-choice--${value}${theme === value ? ' theme-choice--selected' : ''}`}>
          <RadioGroupItem value={value} id={`theme-${value}`} aria-label={name} className="theme-choice__radio" />
          <span className="theme-choice__sample" aria-hidden="true"><span>ALL RIGHT</span><i /><i /><b /></span>
          <span className="theme-choice__name">{name}</span><span className="theme-choice__description">{description}</span>
        </label>)}
      </RadioGroup>
    </fieldset>
  )
  return (
    <fieldset className="theme-picker">
      <legend className="settingrow__name">界面主题</legend>
      <div className="theme-picker__choices">
        {([
          ['classic', '油印卷子', '原版 · 靛蓝与冷灰'],
          ['looseleaf', '手绘笔记', 'Looseleaf · 铅笔与荧光笔'],
        ] as const).map(([value, name, description]) => (
          <label key={value} className={`theme-choice theme-choice--${value}${theme === value ? ' theme-choice--selected' : ''}`}>
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />
            <span className="theme-choice__sample" aria-hidden="true"><span>ALL RIGHT</span><i /><i /><b /></span>
            <span className="theme-choice__name">{name}</span>
            <span className="theme-choice__description">{description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
