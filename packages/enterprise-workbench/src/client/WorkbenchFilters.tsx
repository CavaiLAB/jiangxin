/**
 * 台账面板的筛选和导出：页面上的快捷筛选、抽屉里的「更多筛选」、导出的弹窗。
 *
 * 用的是 @jx/ui-kit 的下拉选择、带搜索的选择器、日期选择、单选组、多行输入和抽屉；按钮、弹窗用 DSH 自己的。
 * 两条规矩（见 @jx/ui-kit 的 README「放进 DSH 弹窗的两条规矩」）：
 *   - 弹窗和抽屉的壳用 DSH 的：导出用 DSH 的 Modal，筛选用 @jx/ui-kit 的 Drawer（它也是 DSH 的 Modal 改的）；
 *   - 弹层落在弹窗里：DSH 的 Modal 里面包一层 PortalContainerProvider（Drawer 自己包了）。
 * 组件的宽度用 jx: 类名改（cn 会合并掉组件自己的宽度类名）；用 CSS Modules 的类名改同一个属性，谁赢要看样式表的先后。
 */
import { useId, useState, type ReactNode } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList,
  DatePicker, Drawer, PortalContainerProvider, RadioGroup, RadioGroupItem,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, type DateLocale,
} from '@jx/ui-kit'
import { QUERY_LIMIT } from '../shared/protocol.ts'
import { fromDateString, parseIds, RUNTIME_STEPS, toDateString, type Filters } from './filters.ts'
import type { WorkbenchPageProps } from './WorkbenchPage.tsx'
import css from './WorkbenchPage.module.css'

type Translate = WorkbenchPageProps['t']

/** 车间、类别的全集，来自宿主。 */
export interface FilterOptions {
  workshops: string[]
  categories: string[]
}

/** 日期选择要的两样：日历的语言、日期怎么写。 */
export interface DateFormat {
  locale: DateLocale
  format: (date: Date) => string
}

/** 下拉选择里「全部车间」那一项的值。Base UI 的下拉要每一项都有值，空值留给「没选」。 */
const ALL_WORKSHOPS = '__all__'

function WorkshopSelect({ t, workshops, value, onChange, className, id }: {
  t: Translate; workshops: string[]; value: string | undefined; onChange: (value: string | undefined) => void
  className?: string; id?: string
}): ReactNode {
  const items = [{ value: ALL_WORKSHOPS, label: t('filter.workshop.all') }, ...workshops.map(w => ({ value: w, label: w }))]
  return (
    <Select
      items={items}
      value={value ?? ALL_WORKSHOPS}
      onValueChange={(next) => { onChange(next === ALL_WORKSHOPS || next === null ? undefined : next) }}
    >
      <SelectTrigger {...(id === undefined ? { 'aria-label': t('filter.workshop') } : { id })} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function CategoryCombobox({ t, categories, value, onChange, className, id }: {
  t: Translate; categories: string[]; value: string | undefined; onChange: (value: string | undefined) => void
  className?: string; id?: string
}): ReactNode {
  return (
    <Combobox items={categories} value={value ?? null} onValueChange={(next) => { onChange(next ?? undefined) }}>
      <ComboboxInput
        {...(id === undefined ? { 'aria-label': t('filter.category') } : { id })}
        placeholder={t('filter.category.placeholder')}
        showClear={value !== undefined}
        className={className}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t('filter.category.empty')}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function MaintenanceDate({ t, date, value, onChange, className, id }: {
  t: Translate; date: DateFormat; value: string | undefined; onChange: (value: string | undefined) => void
  className?: string; id?: string
}): ReactNode {
  // 给了 id 的（抽屉里）旁边有写着「上次保养不晚于」的标签，按钮上只写日期；页面上没有标签，按钮上带着这几个字。
  const labelled = id !== undefined
  return (
    <DatePicker
      {...(labelled ? { id } : { 'aria-label': t('filter.maintainedBefore') })}
      value={value === undefined ? null : fromDateString(value)}
      onValueChange={(next) => { onChange(next === null ? undefined : toDateString(next)) }}
      placeholder={t('filter.maintainedBefore.placeholder')}
      formatDate={(next) => labelled ? date.format(next) : `${t('filter.maintainedBefore')} ${date.format(next)}`}
      locale={date.locale}
      className={className}
    />
  )
}

/**
 * 页面上的快捷筛选：车间、类别、上次保养。改了立刻生效。
 */
export function QuickFilters({ t, options, filters, onChange, date }: {
  t: Translate; options: FilterOptions; filters: Filters; onChange: (next: Filters) => void; date: DateFormat
}): ReactNode {
  const set = (patch: Partial<Filters>): void => { onChange({ ...filters, ...patch }) }
  return (
    <>
      <WorkshopSelect t={t} workshops={options.workshops} value={filters.workshop} onChange={(workshop) => { set({ workshop }) }} className="jx:w-36" />
      <CategoryCombobox t={t} categories={options.categories} value={filters.category} onChange={(category) => { set({ category }) }} className="jx:w-52" />
      <MaintenanceDate t={t} date={date} value={filters.maintainedBefore} onChange={(maintainedBefore) => { set({ maintainedBefore }) }} className="jx:w-56" />
    </>
  )
}

/** 抽屉里一项：标签加控件。 */
function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }): ReactNode {
  return (
    <div className={css.field}>
      {htmlFor === undefined ? <span className={css.fieldLabel}>{label}</span> : <label className={css.fieldLabel} htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint === undefined ? null : <span className={css.fieldHint}>{hint}</span>}
    </div>
  )
}

/**
 * 「更多筛选」抽屉。改的是一份草稿：点「应用」才生效，点「取消」、按 Esc、点遮罩都丢掉草稿。
 */
export function FilterDrawer({ t, open, onClose, options, filters, onApply, date }: {
  t: Translate; open: boolean; onClose: () => void; options: FilterOptions; filters: Filters
  onApply: (next: Filters) => void; date: DateFormat
}): ReactNode {
  const ids = useId()
  const [draft, setDraft] = useState<Filters>(filters)
  const [idsText, setIdsText] = useState('')
  // 每次打开都从当前生效的条件开始。
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(filters)
      setIdsText((filters.ids ?? []).join('\n'))
    }
  }
  const set = (patch: Partial<Filters>): void => { setDraft(previous => ({ ...previous, ...patch })) }
  const apply = (): void => {
    const parsed = parseIds(idsText)
    onApply({ ...draft, ...(parsed === undefined ? { ids: undefined } : { ids: parsed }) })
    onClose()
  }
  const runtimeLabel = `${ids}-runtime`
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('drawer.title')}
      closeLabel={t('drawer.close')}
      footer={(
        <>
          <Button variant="ghost" onClick={() => { setDraft({}); setIdsText('') }}>{t('drawer.reset')}</Button>
          <span className={css.footerSpacer} />
          <Button variant="outline" onClick={onClose}>{t('drawer.cancel')}</Button>
          <Button variant="primary" onClick={apply}>{t('drawer.apply')}</Button>
        </>
      )}
    >
      <Field label={t('filter.workshop')} htmlFor={`${ids}-workshop`}>
        <WorkshopSelect t={t} workshops={options.workshops} value={draft.workshop} onChange={(workshop) => { set({ workshop }) }} className="jx:w-full" id={`${ids}-workshop`} />
      </Field>
      <Field label={t('filter.category')} htmlFor={`${ids}-category`}>
        <CategoryCombobox t={t} categories={options.categories} value={draft.category} onChange={(category) => { set({ category }) }} className="jx:w-full" id={`${ids}-category`} />
      </Field>
      <Field label={t('filter.maintainedBefore')} htmlFor={`${ids}-date`}>
        <MaintenanceDate t={t} date={date} value={draft.maintainedBefore} onChange={(maintainedBefore) => { set({ maintainedBefore }) }} className="jx:w-full" id={`${ids}-date`} />
      </Field>
      <div className={css.field} role="group" aria-labelledby={runtimeLabel}>
        <span className={css.fieldLabel} id={runtimeLabel}>{t('filter.runtime')}</span>
        <RadioGroup
          value={draft.minRuntimeHours ?? 0}
          onValueChange={(value) => { set({ minRuntimeHours: value === 0 ? undefined : value as number }) }}
          aria-labelledby={runtimeLabel}
          className="jx:grid-cols-2 jx:gap-x-4"
        >
          {RUNTIME_STEPS.map(hours => (
            <label key={hours} className={css.radio}>
              <RadioGroupItem value={hours} />
              {hours === 0 ? t('filter.runtime.any') : t('filter.runtime.atLeast', { hours: hours.toLocaleString() })}
            </label>
          ))}
        </RadioGroup>
      </div>
      <Field label={t('filter.ids')} htmlFor={`${ids}-ids`} hint={t('filter.ids.hint', { max: QUERY_LIMIT.ids })}>
        <Textarea
          id={`${ids}-ids`}
          value={idsText}
          onChange={(event) => { setIdsText(event.target.value) }}
          placeholder={t('filter.ids.placeholder')}
          rows={4}
        />
      </Field>
    </Drawer>
  )
}

/**
 * 导出的弹窗：DSH 的 Modal，里面的单选组和下拉都是 @jx/ui-kit 的。下拉的弹层落在弹窗里（PortalContainerProvider），
 * 在下拉里按 Tab 不会被 DSH 把焦点拉走。
 */
export function ExportDialog({ t, open, onClose, filteredCount, total, onExport }: {
  t: Translate; open: boolean; onClose: () => void; filteredCount: number | undefined; total: number | undefined
  onExport: (options: { filtered: boolean; bom: boolean }) => void
}): ReactNode {
  const ids = useId()
  const [filtered, setFiltered] = useState(true)
  const [encoding, setEncoding] = useState<'bom' | 'plain'>('bom')
  const encodings = [
    { value: 'bom', label: t('export.encoding.bom') },
    { value: 'plain', label: t('export.encoding.plain') },
  ]
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('export.title')}
      closeLabel={t('export.close')}
      description={t('export.description')}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>{t('export.cancel')}</Button>
          <Button variant="primary" onClick={() => { onExport({ filtered, bom: encoding === 'bom' }); onClose() }}>{t('export.confirm')}</Button>
        </>
      )}
    >
      <PortalContainerProvider>
        <div className={css.dialogForm}>
          <div className={css.field} role="group" aria-labelledby={`${ids}-scope`}>
            <span className={css.fieldLabel} id={`${ids}-scope`}>{t('export.scope')}</span>
            <RadioGroup value={filtered} onValueChange={(value) => { setFiltered(value as boolean) }} aria-labelledby={`${ids}-scope`}>
              <label className={css.radio}>
                <RadioGroupItem value data-modal-autofocus="" />
                {t('export.scope.filtered', { count: filteredCount ?? '…' })}
              </label>
              <label className={css.radio}>
                <RadioGroupItem value={false} />
                {t('export.scope.all', { count: total ?? '…' })}
              </label>
            </RadioGroup>
          </div>
          <Field label={t('export.encoding')} htmlFor={`${ids}-encoding`}>
            <Select items={encodings} value={encoding} onValueChange={(value) => { if (value === 'bom' || value === 'plain') setEncoding(value) }}>
              <SelectTrigger id={`${ids}-encoding`} className="jx:w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {encodings.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </PortalContainerProvider>
    </Modal>
  )
}
