import './SavingsIllustration.css'

export default function SavingsIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 220 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`savings-illust ${className}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="illust-clip-head">
          <circle cx="85" cy="44" r="22" />
        </clipPath>
        <clipPath id="illust-clip-torso">
          <path d="M48 78 C48 74 55 72 62 72 L108 72 C115 72 118 74 118 78 L106 166 C105 169 103 170 99 170 L67 170 C63 170 61 169 60 166 Z" />
        </clipPath>
        <clipPath id="illust-clip-arm">
          <path d="M115 80 C130 78 150 76 172 74 C180 73 184 75 183 79 C181 83 155 87 135 89 C120 90 113 88 113 85 Z" />
        </clipPath>
      </defs>

      {/* ARM (behind torso) */}
      <g className="savings-illust__arm">
        <path d="M115 80 C130 78 150 76 172 74 C180 73 184 75 183 79 C181 83 155 87 135 89 C120 90 113 88 113 85 Z"
              fill="#9478FF" />
        <path d="M115 79 C132 76 155 74 175 72 C178 73 160 76 138 79 C122 81 115 80 115 79 Z"
              fill="#C4B5FD" opacity="0.45" clipPath="url(#illust-clip-arm)" />
      </g>

      {/* TORSO */}
      <g className="savings-illust__torso">
        <path d="M48 78 C48 74 55 72 62 72 L108 72 C115 72 118 74 118 78 L106 166 C105 169 103 170 99 170 L67 170 C63 170 61 169 60 166 Z"
              fill="#7C5CFC" />
        <path d="M48 72 L118 72 L60 170 L48 78 Z"
              fill="#9478FF" opacity="0.25" clipPath="url(#illust-clip-torso)" />
      </g>

      {/* HEAD centered at x=85 — yin-yang S-curve divides circle in two halves */}
      <g className="savings-illust__head">
        <circle cx="85" cy="44" r="22" fill="#7C5CFC" />
        <path d="M 85 22 A 11 11 0 0 1 85 44 A 11 11 0 0 0 85 66 A 22 22 0 0 1 85 22 Z"
              fill="#B8A4FF" clipPath="url(#illust-clip-head)" />
      </g>

      {/* PIGGY BANK */}
      <g className="savings-illust__piggy">
        <g transform="translate(158, 108) scale(2.4)"
           stroke="#7C5CFC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z" />
          <path d="M16 10h.01" strokeWidth="2.2" />
          <path d="M2 8v1a2 2 0 0 0 2 2h1" />
        </g>
      </g>

      {/* COIN */}
      <g className="savings-illust__coin">
        <circle cx="184" cy="76" r="7" stroke="#FBBF77" strokeWidth="2" />
        <circle cx="184" cy="76" r="4.5" stroke="#FBBF77" strokeWidth="0.8" />
        <text x="184" y="79.5" textAnchor="middle" fontSize="8" fontWeight="700"
              fontFamily="'Geist Mono', monospace" fill="#FBBF77">$</text>
      </g>
    </svg>
  )
}
