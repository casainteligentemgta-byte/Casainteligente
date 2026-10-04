import {
  ROTULO_COMPANY,
  ROTULO_LOGO_SRC,
} from '@/lib/netvision/utils/planoRotulo'

export default function NetVisionCompanyMark({
  company = ROTULO_COMPANY,
  size = 28,
  className = '',
}: {
  company?: string
  size?: number
  className?: string
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <img
        src={ROTULO_LOGO_SRC}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
      <span className="truncate">{company}</span>
    </span>
  )
}
