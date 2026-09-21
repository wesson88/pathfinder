const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** 2026.09.18 20:36 */
export function formatDateTime(input: string | number | Date): string {
  const d = new Date(input)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
