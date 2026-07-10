export default function Panel({ children, className = '' }) {
  return (
    <div className={`bg-panel border border-hairline rounded-[14px] p-4 ${className}`}>
      {children}
    </div>
  )
}
