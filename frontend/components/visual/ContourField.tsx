import { useId } from "react";

export function ContourField({ className = "" }: { className?: string }) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 620 370" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="52" y1="58" x2="578" y2="314" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="0.52" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      {[
        "M60 192C73 94 172 38 281 62C392 87 435 36 519 70C602 104 590 204 526 258C457 316 366 334 281 300C189 263 43 311 60 192Z",
        "M82 193C94 111 177 62 269 80C365 99 414 57 494 87C564 114 561 198 505 243C443 294 368 310 291 282C203 250 67 291 82 193Z",
        "M105 195C118 126 183 86 260 98C345 112 393 79 466 104C526 125 530 193 484 229C431 270 368 286 299 264C217 237 91 275 105 195Z",
        "M129 196C143 143 191 111 254 116C326 123 372 102 438 120C489 135 499 186 463 215C419 250 366 264 307 246C235 225 116 260 129 196Z",
        "M154 197C169 158 201 135 251 134C310 132 351 124 409 137C451 147 468 181 443 202C408 231 363 243 314 228C253 211 142 244 154 197Z",
        "M180 198C195 173 214 157 251 152C295 145 331 146 381 154C414 160 436 177 423 190C398 211 361 221 322 210C271 196 170 229 180 198Z",
        "M208 199C221 186 233 177 253 170C282 160 312 166 352 171C377 174 404 177 402 182C386 192 358 200 330 192C291 182 203 213 208 199Z",
      ].map((path) => (
        <path key={path} d={path} stroke={`url(#${gradientId})`} strokeWidth="2.4" className="drop-shadow-[0_0_8px_rgba(139,92,246,.35)]" />
      ))}
    </svg>
  );
}
