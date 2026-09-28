import React, { memo } from 'react';

interface AnatomicalMouthArtworkProps {
  width?: number;
  height?: number;
}

/**
 * High-fidelity Anatomical Oral Cavity Background.
 * Renders BEHIND the 3D tooth canvas:
 * - Deep dark burgundy posterior pharyngeal depth
 * - Hard palate with anatomical palatine rugae
 * - Soft palate & uvula palatina
 * - Anatomical tongue with central lingual groove & papillae shading
 * - Lateral buccal corridor shadows behind posterior molars
 * - Maxillary & mandibular alveolar gingival base
 */
export const AnatomicalMouthBackground = memo(function AnatomicalMouthBackground({
  width = 800,
  height = 580,
}: AnatomicalMouthArtworkProps) {
  return (
    <svg
      viewBox="0 0 800 580"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Deep Oropharyngeal Throat Depth Gradient */}
        <radialGradient id="mouthThroatDepth" cx="50%" cy="48%" r="52%" fx="50%" fy="46%">
          <stop offset="0%" stopColor="#1a0408" />
          <stop offset="35%" stopColor="#300810" />
          <stop offset="65%" stopColor="#4f121d" />
          <stop offset="85%" stopColor="#6e1a29" />
          <stop offset="100%" stopColor="#872334" />
        </radialGradient>

        {/* Vaulted Hard Palate Gradient */}
        <linearGradient id="mouthHardPalate" x1="50%" y1="18%" x2="50%" y2="44%">
          <stop offset="0%" stopColor="#f59ea9" />
          <stop offset="30%" stopColor="#e88290" />
          <stop offset="70%" stopColor="#d46b7a" />
          <stop offset="100%" stopColor="#8c2333" />
        </linearGradient>

        {/* Soft Palate & Uvula Gradient */}
        <linearGradient id="mouthUvulaGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#f48ea0" />
          <stop offset="60%" stopColor="#e5677d" />
          <stop offset="100%" stopColor="#bf3d52" />
        </linearGradient>

        {/* Anatomical Tongue Gradient */}
        <radialGradient id="mouthTongueDorsum" cx="50%" cy="42%" r="55%" fx="50%" fy="32%">
          <stop offset="0%" stopColor="#ffa0b2" />
          <stop offset="28%" stopColor="#f77f96" />
          <stop offset="62%" stopColor="#ea5c77" />
          <stop offset="88%" stopColor="#cf405c" />
          <stop offset="100%" stopColor="#962337" />
        </radialGradient>

        {/* Buccal Corridor Lateral Shadow (Left & Right) */}
        <linearGradient id="buccalShadowLeft" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#420b14" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#6b1625" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#6b1625" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="buccalShadowRight" x1="100%" y1="50%" x2="0%" y2="50%">
          <stop offset="0%" stopColor="#420b14" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#6b1625" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#6b1625" stopOpacity="0" />
        </linearGradient>

        {/* Maxillary Gingival Base */}
        <linearGradient id="gingivaUpper" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#e8788a" />
          <stop offset="45%" stopColor="#f28d9c" />
          <stop offset="85%" stopColor="#f9a3b0" />
          <stop offset="100%" stopColor="#f48696" />
        </linearGradient>

        {/* Mandibular Gingival Base */}
        <linearGradient id="gingivaLower" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#e8788a" />
          <stop offset="45%" stopColor="#f28d9c" />
          <stop offset="85%" stopColor="#f9a3b0" />
          <stop offset="100%" stopColor="#f48696" />
        </linearGradient>

        {/* Soft blur for organic tissue transitions */}
        <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ── 1. Posterior Oral Cavity Backdrop ── */}
      <path
        d="M 100 290 
           C 100 160, 220 100, 400 100 
           C 580 100, 700 160, 700 290 
           C 700 420, 580 480, 400 480 
           C 220 480, 100 420, 100 290 Z"
        fill="url(#mouthThroatDepth)"
      />

      {/* ── 2. Vaulted Hard Palate (Roof of the mouth behind upper teeth) ── */}
      <path
        d="M 155 185 
           C 210 145, 290 120, 400 120 
           C 510 120, 590 145, 645 185 
           C 580 230, 490 252, 400 252 
           C 310 252, 220 230, 155 185 Z"
        fill="url(#mouthHardPalate)"
        opacity="0.94"
      />

      {/* Palatine Rugae (Transverse mucosal ridges on hard palate) */}
      <g stroke="#f8afb9" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.6">
        <path d="M 330 162 Q 400 156 470 162" />
        <path d="M 315 178 Q 400 171 485 178" />
        <path d="M 305 195 Q 400 187 495 195" />
        <path d="M 320 212 Q 400 204 480 212" />
      </g>

      {/* ── 3. Soft Palate & Uvula Palatina ── */}
      <path
        d="M 320 240 
           Q 360 254 390 256 
           Q 393 282 400 286 
           Q 407 282 410 256 
           Q 440 254 480 240 
           Q 400 248 320 240 Z"
        fill="url(#mouthUvulaGrad)"
      />
      {/* Uvula bulb highlight */}
      <circle cx="400" cy="283" r="4.5" fill="#fca8b7" opacity="0.8" />

      {/* ── 4. Anatomical Tongue filling the floor of the mouth ── */}
      <g>
        {/* Tongue Body (Dorsal surface) */}
        <path
          d="M 195 390 
             C 195 320, 270 270, 400 270 
             C 530 270, 605 320, 605 390 
             C 580 435, 510 448, 400 448 
             C 290 448, 220 435, 195 390 Z"
          fill="url(#mouthTongueDorsum)"
        />

        {/* Tongue Dorsal Edge Highlight */}
        <path
          d="M 230 365 
             C 285 305, 345 282, 400 282 
             C 455 282, 515 305, 570 365"
          fill="none"
          stroke="#ffbac7"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.55"
          filter="url(#softGlow)"
        />

        {/* Median Lingual Sulcus (Central longitudinal groove of the tongue) */}
        <path
          d="M 400 286 C 400 320, 399 355, 400 392"
          fill="none"
          stroke="#8c1f32"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.65"
        />
        <path
          d="M 401.5 288 C 401.5 320, 400.5 355, 401.5 390"
          fill="none"
          stroke="#ffb0c0"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>

      {/* ── 5. Buccal Corridor Lateral Shadows (Behind Molars 18, 17 / 27, 28) ── */}
      <path
        d="M 100 290 C 100 210, 125 170, 165 170 L 165 410 C 125 410, 100 370, 100 290 Z"
        fill="url(#buccalShadowLeft)"
      />
      <path
        d="M 700 290 C 700 210, 675 170, 635 170 L 635 410 C 675 410, 700 370, 700 290 Z"
        fill="url(#buccalShadowRight)"
      />

      {/* ── 6. Gingival Background Anchors (Behind tooth cervical lines) ── */}
      {/* Maxillary Gingival Band (Upper Arch) */}
      <path
        d="M 130 190 
           C 180 135, 280 108, 400 108 
           C 520 108, 620 135, 670 190 
           C 625 150, 520 128, 400 128 
           C 280 128, 175 150, 130 190 Z"
        fill="url(#gingivaUpper)"
      />

      {/* Mandibular Gingival Band (Lower Arch) */}
      <path
        d="M 140 395 
           C 185 450, 285 478, 400 478 
           C 515 478, 615 450, 660 395 
           C 615 435, 515 455, 400 455 
           C 285 455, 185 435, 140 395 Z"
        fill="url(#gingivaLower)"
      />
    </svg>
  );
});

/**
 * High-fidelity Anatomical Mouth Foreground Frame.
 * Renders AROUND / IN FRONT OF the mouth perimeter (with central aperture transparent):
 * - Upper Lip with authentic Cupid's bow and philtral crests
 * - Lower Lip with full, smooth curved vermilion border
 * - Oral Commissures and Cheeks framing the lateral mouth angles
 * - Fleshy vermilion highlights and depth contours
 * - Wide anatomical opening that NEVER covers any tooth crowns (especially molars 18, 28, 48, 38)
 */
export const AnatomicalMouthForeground = memo(function AnatomicalMouthForeground({
  width = 800,
  height = 580,
}: AnatomicalMouthArtworkProps) {
  return (
    <svg
      viewBox="0 0 800 580"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
      aria-hidden="true"
    >
      <defs>
        {/* Upper Lip Vermilion Gradient */}
        <linearGradient id="upperLipGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#f4788c" />
          <stop offset="25%" stopColor="#f8899b" />
          <stop offset="65%" stopColor="#ea5d75" />
          <stop offset="90%" stopColor="#d84862" />
          <stop offset="100%" stopColor="#b73048" />
        </linearGradient>

        {/* Lower Lip Vermilion Gradient */}
        <linearGradient id="lowerLipGrad" x1="50%" y1="100%" x2="50%" y2="0%">
          <stop offset="0%" stopColor="#f27085" />
          <stop offset="30%" stopColor="#f88496" />
          <stop offset="70%" stopColor="#ea5971" />
          <stop offset="90%" stopColor="#d4435d" />
          <stop offset="100%" stopColor="#b52e46" />
        </linearGradient>

        {/* Cheeks / Lateral Commissure Blending */}
        <linearGradient id="cheekLeftGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#f48294" />
          <stop offset="50%" stopColor="#ea637a" />
          <stop offset="100%" stopColor="#c83e54" />
        </linearGradient>

        <linearGradient id="cheekRightGrad" x1="100%" y1="50%" x2="0%" y2="50%">
          <stop offset="0%" stopColor="#f48294" />
          <stop offset="50%" stopColor="#ea637a" />
          <stop offset="100%" stopColor="#c83e54" />
        </linearGradient>

        {/* Natural Lip Vermilion Border Specular Sheen */}
        <linearGradient id="lipHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Soft shadow framing perioral tissue */}
        <filter id="perioralShadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#991b1b" floodOpacity="0.14" />
        </filter>
      </defs>

      {/* ── 1. Upper Lip & Commissures ── */}
      {/* Outer contour: Cupid's bow dip at (400, 68), peaks at (345, 52) and (455, 52), tapering to commissures (75, 290) and (725, 290) */}
      {/* Inner aperture contour: frames gracefully above maxillary gums and incisors (350-450, 118-124), staying well clear of crowns */}
      <path
        d="M 75 290 
           C 75 195, 170 82, 345 52 
           C 375 48, 390 68, 400 68 
           C 410 68, 425 48, 455 52 
           C 630 82, 725 195, 725 290 
           C 705 270, 645 155, 455 120 
           C 425 115, 375 115, 345 120 
           C 155 155, 95 270, 75 290 Z"
        fill="url(#upperLipGrad)"
        filter="url(#perioralShadow)"
      />

      {/* Upper Lip Vermilion Crest Highlight (Subtle natural skin sheen) */}
      <path
        d="M 160 160 
           C 220 98, 320 68, 348 64 
           C 370 60, 388 78, 400 78 
           C 412 78, 430 60, 452 64 
           C 480 68, 580 98, 640 160"
        fill="none"
        stroke="url(#lipHighlight)"
        strokeWidth="4.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Philtrum Ridge Highlights */}
      <path d="M 378 54 Q 380 32 382 15" stroke="#fbcfe8" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
      <path d="M 422 54 Q 420 32 418 15" stroke="#fbcfe8" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />

      {/* ── 2. Lower Lip & Commissures ── */}
      {/* Outer contour: curves smoothly under mandibular teeth to (400, 545) */}
      {/* Inner aperture contour: frames gracefully below mandibular teeth, leaving all lower crowns completely visible */}
      <path
        d="M 75 290 
           C 95 310, 155 425, 345 460 
           C 375 465, 425 465, 455 460 
           C 645 425, 705 310, 725 290 
           C 725 385, 630 500, 455 538 
           C 425 544, 375 544, 345 538 
           C 170 500, 75 385, 75 290 Z"
        fill="url(#lowerLipGrad)"
        filter="url(#perioralShadow)"
      />

      {/* Lower Lip Central Fullness Highlight */}
      <path
        d="M 230 460 
           C 300 508, 350 524, 400 524 
           C 450 524, 500 508, 570 460"
        fill="none"
        stroke="url(#lipHighlight)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.65"
      />
      <path
        d="M 280 478 
           C 330 514, 370 520, 400 520 
           C 430 520, 470 514, 520 478"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* ── 3. Smooth Lateral Cheek / Oral Commissure Transitions ── */}
      {/* Left Commissure & Cheek Contour (Viewer Left = Patient Right) */}
      <path
        d="M 75 290 
           C 70 260, 80 230, 95 210 
           C 90 240, 90 340, 95 370 
           C 80 350, 70 320, 75 290 Z"
        fill="url(#cheekLeftGrad)"
        opacity="0.85"
      />

      {/* Right Commissure & Cheek Contour (Viewer Right = Patient Left) */}
      <path
        d="M 725 290 
           C 730 260, 720 230, 705 210 
           C 710 240, 710 340, 705 370 
           C 720 350, 730 320, 725 290 Z"
        fill="url(#cheekRightGrad)"
        opacity="0.85"
      />

      {/* Subtle commissure crease lines */}
      <path d="M 68 290 Q 78 290 92 290" stroke="#7f1d1d" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M 732 290 Q 722 290 708 290" stroke="#7f1d1d" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
});
