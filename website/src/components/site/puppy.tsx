// A sad puppy, for the page people see when they remove the extension.
export function Puppy({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="A sad puppy looking up at you">
      {/* Floppy ears, behind the head */}
      <path d="M58 52C32 48 12 74 16 112c2 20 12 34 24 32 13-2 18-22 20-44 1-16 4-32-2-48Z" fill="#9a6a47" />
      <path d="M142 52c26-4 46 22 42 60-2 20-12 34-24 32-13-2-18-22-20-44-1-16-4-32 2-48Z" fill="#9a6a47" />

      {/* Head, and the patch over one eye */}
      <ellipse cx="100" cy="98" rx="62" ry="60" fill="#e9c6a1" />
      <path d="M118 42c26 4 42 26 40 52-1 14-14 22-30 18-16-5-24-20-23-38 1-13 5-24 13-32Z" fill="#c4935f" />

      {/* Muzzle */}
      <ellipse cx="100" cy="128" rx="34" ry="26" fill="#f8e8d6" />

      {/* Worried eyebrows */}
      <path d="M58 72c5-6 11-9 18-10" fill="none" stroke="#7a5236" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M142 72c-5-6-11-9-18-10" fill="none" stroke="#7a5236" strokeWidth="4.5" strokeLinecap="round" />

      {/* Big eyes, looking up */}
      <circle cx="72" cy="92" r="15" fill="#2a2030" />
      <circle cx="128" cy="92" r="15" fill="#2a2030" />
      <circle cx="67" cy="85" r="5.5" fill="#fff" />
      <circle cx="123" cy="85" r="5.5" fill="#fff" />
      <circle cx="77" cy="97" r="2.5" fill="#fff" />
      <circle cx="133" cy="97" r="2.5" fill="#fff" />

      {/* Nose and a small frown */}
      <ellipse cx="100" cy="115" rx="11" ry="8" fill="#2a2030" />
      <ellipse cx="96.5" cy="112.5" rx="3" ry="1.8" fill="#fff" opacity="0.55" />
      <path d="M100 123v7" stroke="#2a2030" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M86 141c3-7 8-11 14-11s11 4 14 11" fill="none" stroke="#2a2030" strokeWidth="3.5" strokeLinecap="round" />

      {/* One tear, in the brand's violet */}
      <path d="M61 110c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12Z" fill="#a5a1f8" />

      {/* Paws on the edge */}
      <ellipse cx="66" cy="162" rx="24" ry="16" fill="#d9b189" />
      <ellipse cx="134" cy="162" rx="24" ry="16" fill="#d9b189" />
      <path d="M58 158v9M66 156v11M74 158v9M126 158v9M134 156v11M142 158v9" stroke="#a97e55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
