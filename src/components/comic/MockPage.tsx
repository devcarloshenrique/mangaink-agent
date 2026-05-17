interface Props {
  seed: number;
  width: number;
  height: number;
}

export function MockPage({ seed, width, height }: Props) {
  const hue = (seed * 57) % 360;
  return (
    <div
      className="border-[3px] border-ink rounded shadow-comic-sm overflow-hidden relative"
      style={{ width, height, background: `hsl(${hue} 70% 88%)` }}
    >
      <div className="absolute inset-2 grid grid-rows-3 gap-1.5">
        <div
          className="border-[2px] border-ink bg-card flex items-center justify-center font-display text-comic-red"
          style={{ fontSize: 14 }}
        >
          BAM!
        </div>
        <div className="border-[2px] border-ink bg-comic-yellow" />
        <div className="border-[2px] border-ink bg-card flex items-end p-1">
          <span className="text-[8px] font-bold leading-tight">— Não posso perder!</span>
        </div>
      </div>
    </div>
  );
}
