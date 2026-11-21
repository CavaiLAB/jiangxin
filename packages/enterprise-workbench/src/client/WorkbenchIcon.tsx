/** 侧栏入口的图标。名称由侧栏自己显示和朗读，这里只画图标。 */
import type { ReactNode } from 'react'
import { IconDatabaseOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * 按侧栏要的尺寸画图标。图标要直接作为这一行的子元素，外面再包一层会让它比文字高出一截。
 * @param props 侧栏给的尺寸。
 * @returns 图标。
 */
export function WorkbenchIcon({ size }: PropsRuntime<'sidebar.panellist'>): ReactNode {
  return <IconDatabaseOutlineRegular size={size} />
}
