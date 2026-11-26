import { LogoMark } from "./Logo";

/** Loading indicator: the purple house hops and shakes, and its roof wobbles on its own. */
export default function HouseLoader({ size = 56, label }: { size?: number; label?: string }) {
  return (
    <span className="house-loader" role="status" aria-label={label ?? "טוען"}>
      <span className="hl-body" style={{ width: size }}>
        <LogoMark size={size} />
      </span>
      <span className="hl-shadow" style={{ width: size * 0.7 }} />
      {label && <span className="hl-label">{label}</span>}
    </span>
  );
}
