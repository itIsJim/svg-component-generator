/** A realistic design-tool export: nested named groups, gradient + clip-path defs. */
export const SAMPLE_SVG = `<svg width="240" height="120" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Pricing Card" clip-path="url(#clip0_101_2)">
<rect id="Card Background" width="240" height="120" rx="12" fill="url(#paint0_linear_101_2)"/>
<g id="Header">
<rect id="Avatar" x="16" y="16" width="32" height="32" rx="16" fill="#7C3AED"/>
<g id="Title Block">
<rect id="Title" x="56" y="18" width="96" height="10" rx="5" fill="#E5E7EB"/>
<rect id="Subtitle" x="56" y="34" width="64" height="8" rx="4" fill="#9CA3AF" fill-opacity="0.6"/>
</g>
</g>
<g id="Body">
<rect id="Divider" x="16" y="60" width="208" height="1" fill="#374151"/>
<g id="CTA Button">
<rect id="Button Base" x="16" y="76" width="120" height="28" rx="14" fill="#22D3EE"/>
<circle id="Button Icon" cx="30" cy="90" r="6" stroke="#0F172A" stroke-width="1.5"/>
<rect id="Button Label" x="44" y="86" width="60" height="8" rx="4" fill="#0F172A"/>
</g>
<g id="Badge" opacity="0.9">
<rect id="Badge Base" x="168" y="76" width="56" height="28" rx="14" fill="#F59E0B" fill-opacity="0.2"/>
<rect id="Badge Label" x="180" y="86" width="32" height="8" rx="4" fill="#F59E0B"/>
</g>
</g>
</g>
<defs>
<linearGradient id="paint0_linear_101_2" x1="0" y1="0" x2="240" y2="120" gradientUnits="userSpaceOnUse">
<stop stop-color="#111827"/>
<stop offset="1" stop-color="#1F2937"/>
</linearGradient>
<clipPath id="clip0_101_2">
<rect width="240" height="120" rx="12" fill="white"/>
</clipPath>
</defs>
</svg>
`;
