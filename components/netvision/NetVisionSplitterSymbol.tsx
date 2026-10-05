/**
 * Símbolo del adaptador PoE (splitter): un cuadro ámbar con una línea que se
 * divide en dos (datos + corriente). Es el mismo dibujo que el plano pone junto
 * a cada cámara que lo necesita (ver CameraPlacementTool).
 */
export const SPLITTER_SYMBOL_FILL = '#ffb000'
export const SPLITTER_SYMBOL_INK = '#0f172a'

export default function NetVisionSplitterSymbol({
  size = 14,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 13 13"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <rect
        x={0.75}
        y={0.75}
        width={11.5}
        height={11.5}
        rx={3}
        fill={SPLITTER_SYMBOL_FILL}
        stroke={SPLITTER_SYMBOL_INK}
        strokeWidth={1.5}
      />
      <path
        d="M2.5 6.5H6L10.5 3.5M6 6.5l4.5 3"
        fill="none"
        stroke={SPLITTER_SYMBOL_INK}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
