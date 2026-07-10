export default function Eyebrow({ children, right }) {
  return (
    <div className="flex justify-between items-center mb-2.5">
      <div className="font-mono text-[10.5px] tracking-[0.16em] text-fg-dim uppercase">
        {children}
      </div>
      {right}
    </div>
  )
}
