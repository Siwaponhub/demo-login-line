// Reusable group avatar — shows uploaded photo or first-letter fallback
// with a deterministic gradient based on the group name.

const PALETTES = [
  ["#06c755", "#04a346"],
  ["#2374ab", "#1098ad"],
  ["#f59f00", "#e8590c"],
  ["#845ef7", "#5f3dc4"],
  ["#d6336c", "#fa5252"],
  ["#22b8cf", "#1098ad"],
  ["#fd7e14", "#fab005"],
  ["#15aabf", "#5f3dc4"],
];

function hashName(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function firstLetter(name = "") {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // Use Array.from to handle Thai characters / emoji
  const chars = Array.from(trimmed);
  return chars[0].toUpperCase();
}

function GroupAvatar({ name = "", photoURL = "", size = 64, className = "" }) {
  const palette = PALETTES[hashName(name) % PALETTES.length];
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
    background: photoURL
      ? undefined
      : `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`,
  };

  return (
    <span className={`group-avatar ${className}`} style={style} aria-hidden="true">
      {photoURL ? (
        <img src={photoURL} alt={name} />
      ) : (
        <span className="group-avatar-letter">{firstLetter(name)}</span>
      )}
    </span>
  );
}

export default GroupAvatar;
