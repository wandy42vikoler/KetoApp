export default function Stamp({ status }) {
  const isBreach = status === 'BREACH'
  return (
    <div
      className={`font-mono font-bold text-[10.5px] tracking-[0.14em] px-[9px] py-1 rounded-[5px] inline-block -rotate-[1.5deg] border ${
        isBreach
          ? 'text-alert border-alert/35 bg-alert-dim/35'
          : 'text-signal border-signal/35 bg-signal-dim/35'
      }`}
    >
      {status}
    </div>
  )
}
