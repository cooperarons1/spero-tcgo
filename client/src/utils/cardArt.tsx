import React, { useState } from 'react';
import { CARD_ART_PNGS } from './cardArtPngs';

// Shared gradient definitions by theme
const jimmyGradients = (
  <>
    <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff6600" />
      <stop offset="100%" stopColor="#cc2200" />
    </linearGradient>
    <linearGradient id="lavaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff4400" />
      <stop offset="100%" stopColor="#881100" />
    </linearGradient>
    <linearGradient id="emberGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#ff3300" />
      <stop offset="100%" stopColor="#ffaa00" />
    </linearGradient>
  </>
);

const talaGradients = (
  <>
    <linearGradient id="leafGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#66cc33" />
      <stop offset="100%" stopColor="#337711" />
    </linearGradient>
    <linearGradient id="barkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#8B6914" />
      <stop offset="100%" stopColor="#5a3e0a" />
    </linearGradient>
    <linearGradient id="healGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#88ff88" />
      <stop offset="100%" stopColor="#33aa33" />
    </linearGradient>
  </>
);

const derekGradients = (
  <>
    <linearGradient id="techGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffdd44" />
      <stop offset="100%" stopColor="#cc9900" />
    </linearGradient>
    <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#cccccc" />
      <stop offset="100%" stopColor="#888888" />
    </linearGradient>
    <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#ffee66" />
      <stop offset="100%" stopColor="#ffaa00" />
    </linearGradient>
  </>
);

const andersGradients = (
  <>
    <linearGradient id="iceGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#88ccff" />
      <stop offset="100%" stopColor="#3366cc" />
    </linearGradient>
    <linearGradient id="frostGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#aaeeff" />
      <stop offset="100%" stopColor="#4488cc" />
    </linearGradient>
    <linearGradient id="deepBlue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#2255aa" />
      <stop offset="100%" stopColor="#112266" />
    </linearGradient>
  </>
);

const desGradients = (
  <>
    <linearGradient id="darkOrraGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#9933ff" />
      <stop offset="100%" stopColor="#4a0080" />
    </linearGradient>
    <linearGradient id="shadowGrad2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#6622aa" />
      <stop offset="100%" stopColor="#330066" />
    </linearGradient>
    <linearGradient id="voidGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#220044" />
      <stop offset="100%" stopColor="#7733cc" />
    </linearGradient>
  </>
);

const astridGradients = (
  <>
    <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffe066" />
      <stop offset="100%" stopColor="#cc9900" />
    </linearGradient>
    <linearGradient id="holyLightGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffffff" />
      <stop offset="100%" stopColor="#ffdd88" />
    </linearGradient>
    <linearGradient id="guardGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#ffd700" />
      <stop offset="100%" stopColor="#b8860b" />
    </linearGradient>
  </>
);

const avaGradients = (
  <>
    <linearGradient id="gadgetGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff69b4" />
      <stop offset="100%" stopColor="#cc3388" />
    </linearGradient>
    <linearGradient id="techPinkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff99cc" />
      <stop offset="100%" stopColor="#cc6699" />
    </linearGradient>
    <linearGradient id="circuitGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#ff3399" />
      <stop offset="100%" stopColor="#ff88bb" />
    </linearGradient>
  </>
);

const lucasGradients = (
  <>
    <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#2dd4bf" />
      <stop offset="100%" stopColor="#0d9488" />
    </linearGradient>
    <linearGradient id="coyoteGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#b8860b" />
      <stop offset="100%" stopColor="#8b6914" />
    </linearGradient>
    <linearGradient id="trickGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#14b8a6" />
      <stop offset="100%" stopColor="#5eead4" />
    </linearGradient>
  </>
);

const izzyGradients = (
  <>
    <linearGradient id="sparkleGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff9933" />
      <stop offset="100%" stopColor="#cc6600" />
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ff8800" />
      <stop offset="100%" stopColor="#cc5500" />
    </linearGradient>
    <linearGradient id="navGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stopColor="#ff6600" />
      <stop offset="100%" stopColor="#ffaa44" />
    </linearGradient>
  </>
);

const neutralGradients = (
  <>
    <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#aaaaaa" />
      <stop offset="100%" stopColor="#666666" />
    </linearGradient>
    <linearGradient id="darkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#555555" />
      <stop offset="100%" stopColor="#222222" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffcc33" />
      <stop offset="100%" stopColor="#cc8800" />
    </linearGradient>
    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#9966cc" />
      <stop offset="100%" stopColor="#553388" />
    </linearGradient>
    <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#cc3333" />
      <stop offset="100%" stopColor="#881111" />
    </linearGradient>
    <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#55aa55" />
      <stop offset="100%" stopColor="#336633" />
    </linearGradient>
    <linearGradient id="holyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffffaa" />
      <stop offset="100%" stopColor="#ddaa44" />
    </linearGradient>
    <linearGradient id="shadowGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#443366" />
      <stop offset="100%" stopColor="#221133" />
    </linearGradient>
    <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#ffd700" />
      <stop offset="100%" stopColor="#b8860b" />
    </linearGradient>
  </>
);

// Background helpers
const fireBg = <rect x="0" y="0" width="100" height="80" fill="#1a0500" />;
const natureBg = <rect x="0" y="0" width="100" height="80" fill="#0a1a05" />;
const techBg = <rect x="0" y="0" width="100" height="80" fill="#1a1500" />;
const iceBg = <rect x="0" y="0" width="100" height="80" fill="#051020" />;
const neutralBg = <rect x="0" y="0" width="100" height="80" fill="#111111" />;
const desBg = <rect x="0" y="0" width="100" height="80" fill="#150020" />;
const astridBg = <rect x="0" y="0" width="100" height="80" fill="#1a1500" />;
const avaBg = <rect x="0" y="0" width="100" height="80" fill="#1a0515" />;
const lucasBg = <rect x="0" y="0" width="100" height="80" fill="#051a15" />;
const izzyBg = <rect x="0" y="0" width="100" height="80" fill="#1a0f00" />;

// Helper: flame shape at position
function flames(x: number, y: number, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="4" ry="8" fill="#ff6600" opacity="0.8" />
      <ellipse cx="-3" cy="2" rx="3" ry="6" fill="#ff4400" opacity="0.6" />
      <ellipse cx="3" cy="2" rx="3" ry="6" fill="#ffaa00" opacity="0.6" />
    </g>
  );
}

// Helper: simple humanoid silhouette
function humanoid(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="-18" r="6" fill={color} />
      <rect x="-5" y="-12" width="10" height="16" rx="2" fill={color} />
      <rect x="-10" y="-10" width="5" height="12" rx="2" fill={color} />
      <rect x="5" y="-10" width="5" height="12" rx="2" fill={color} />
      <rect x="-4" y="4" width="4" height="12" rx="2" fill={color} />
      <rect x="0" y="4" width="4" height="12" rx="2" fill={color} />
    </g>
  );
}

// Helper: simple tree shape
function tree(x: number, y: number, trunkColor: string, leafColor: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="-3" y="0" width="6" height="16" fill={trunkColor} />
      <polygon points="0,-25 -15,0 15,0" fill={leafColor} />
      <polygon points="0,-18 -12,2 12,2" fill={leafColor} opacity="0.8" />
    </g>
  );
}

// Helper: dragon/drake shape
function dragon(x: number, y: number, color: string, wingColor: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="12" ry="7" fill={color} />
      <circle cx="14" cy="-4" r="5" fill={color} />
      <polygon points="17,-2 24,-1 17,2" fill={color} />
      <path d="M-5,-6 Q-15,-20 -2,-14 Q5,-22 8,-6" fill={wingColor} opacity="0.8" />
      <path d="M-10,2 Q-18,8 -14,4" fill={color} />
      <circle cx="16" cy="-5" r="1.5" fill="#ffffff" />
    </g>
  );
}

// Helper: shield shape
function shield(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <path d="M0,-12 L10,-6 L10,4 L0,12 L-10,4 L-10,-6 Z" fill={color} stroke="#ffffff" strokeWidth="1" opacity="0.9" />
    </g>
  );
}

// Helper: sword shape
function sword(x: number, y: number, bladeColor: string, hiltColor: string, scale = 1, rotation = -30) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale}) rotate(${rotation})`}>
      <rect x="-1.5" y="-20" width="3" height="25" rx="1" fill={bladeColor} />
      <rect x="-6" y="4" width="12" height="3" rx="1" fill={hiltColor} />
      <rect x="-2" y="7" width="4" height="6" rx="1" fill={hiltColor} />
    </g>
  );
}

// Helper: wolf/dog silhouette
function wolf(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="14" ry="8" fill={color} />
      <circle cx="14" cy="-5" r="6" fill={color} />
      <polygon points="12,-10 15,-16 18,-10" fill={color} />
      <polygon points="16,-10 19,-16 22,-10" fill={color} />
      <polygon points="19,-3 26,-2 19,0" fill={color} />
      <rect x="-10" y="6" width="4" height="10" rx="1" fill={color} />
      <rect x="-3" y="6" width="4" height="10" rx="1" fill={color} />
      <rect x="4" y="6" width="4" height="10" rx="1" fill={color} />
      <rect x="10" y="6" width="4" height="10" rx="1" fill={color} />
      <path d="M-14,0 Q-20,-4 -18,2" fill={color} />
      <circle cx="17" cy="-6" r="1.5" fill="#ffffff" />
    </g>
  );
}

// Helper: bear silhouette
function bear(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="16" ry="10" fill={color} />
      <circle cx="14" cy="-6" r="7" fill={color} />
      <circle cx="10" cy="-12" r="4" fill={color} />
      <circle cx="18" cy="-12" r="4" fill={color} />
      <rect x="-12" y="8" width="5" height="8" rx="2" fill={color} />
      <rect x="-4" y="8" width="5" height="8" rx="2" fill={color} />
      <rect x="4" y="8" width="5" height="8" rx="2" fill={color} />
      <rect x="10" y="8" width="5" height="8" rx="2" fill={color} />
      <circle cx="16" cy="-6" r="1.5" fill="#ffffff" />
    </g>
  );
}

// Helper: mounted figure (rider on beast)
function mountedFigure(x: number, y: number, riderColor: string, mountColor: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="5" rx="16" ry="8" fill={mountColor} />
      <circle cx="14" cy="0" r="5" fill={mountColor} />
      <rect x="-10" y="12" width="4" height="10" rx="1" fill={mountColor} />
      <rect x="-2" y="12" width="4" height="10" rx="1" fill={mountColor} />
      <rect x="6" y="12" width="4" height="10" rx="1" fill={mountColor} />
      <circle cx="0" cy="-10" r="5" fill={riderColor} />
      <rect x="-4" y="-5" width="8" height="10" rx="2" fill={riderColor} />
    </g>
  );
}

// Helper: golem/large bulky creature
function golem(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="-14" r="9" fill={color} />
      <rect x="-12" y="-6" width="24" height="20" rx="4" fill={color} />
      <rect x="-18" y="-4" width="8" height="16" rx="3" fill={color} />
      <rect x="10" y="-4" width="8" height="16" rx="3" fill={color} />
      <rect x="-8" y="14" width="7" height="12" rx="3" fill={color} />
      <rect x="1" y="14" width="7" height="12" rx="3" fill={color} />
      <circle cx="-4" cy="-16" r="2" fill="#ffffff" />
      <circle cx="4" cy="-16" r="2" fill="#ffffff" />
    </g>
  );
}

// Helper: archer figure
function archer(x: number, y: number, bodyColor: string, bowColor: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="-18" r="6" fill={bodyColor} />
      <rect x="-5" y="-12" width="10" height="16" rx="2" fill={bodyColor} />
      <rect x="-4" y="4" width="4" height="12" rx="2" fill={bodyColor} />
      <rect x="0" y="4" width="4" height="12" rx="2" fill={bodyColor} />
      <path d="M8,-10 Q18,-20 8,0" fill="none" stroke={bowColor} strokeWidth="2" />
      <line x1="8" y1="-10" x2="8" y2="0" stroke={bowColor} strokeWidth="0.8" />
      <line x1="8" y1="-5" x2="22" y2="-5" stroke={bowColor} strokeWidth="1" />
      <polygon points="22,-5 19,-7 19,-3" fill={bowColor} />
    </g>
  );
}

// Helper: knight/armored figure
function knight(x: number, y: number, armorColor: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="-18" r="7" fill={armorColor} />
      <polygon points="0,-26 -3,-18 3,-18" fill={armorColor} />
      <rect x="-7" y="-12" width="14" height="18" rx="2" fill={armorColor} />
      <rect x="-13" y="-10" width="6" height="14" rx="2" fill={armorColor} />
      <rect x="7" y="-10" width="6" height="14" rx="2" fill={armorColor} />
      <rect x="-5" y="6" width="5" height="14" rx="2" fill={armorColor} />
      <rect x="0" y="6" width="5" height="14" rx="2" fill={armorColor} />
    </g>
  );
}

// Helper: ice crystal
function iceCrystal(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <polygon points="0,-12 3,-4 12,-4 5,2 7,10 0,5 -7,10 -5,2 -12,-4 -3,-4" fill={color} opacity="0.9" />
    </g>
  );
}

// Helper: gear shape
function gear(x: number, y: number, color: string, scale = 1) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <circle cx="0" cy="0" r="8" fill={color} />
      <rect x="-2" y="-12" width="4" height="6" fill={color} />
      <rect x="-2" y="6" width="4" height="6" fill={color} />
      <rect x="-12" y="-2" width="6" height="4" fill={color} />
      <rect x="6" y="-2" width="6" height="4" fill={color} />
      <rect x="5" y="-10" width="4" height="5" fill={color} transform="rotate(45)" />
      <rect x="-9" y="5" width="4" height="5" fill={color} transform="rotate(45)" />
      <rect x="5" y="5" width="4" height="5" fill={color} transform="rotate(-45)" />
      <rect x="-9" y="-10" width="4" height="5" fill={color} transform="rotate(-45)" />
      <circle cx="0" cy="0" r="4" fill="#1a1500" />
    </g>
  );
}

const cardArtMap: Record<string, () => React.ReactNode> = {
  // ==================== JIMMY (red/fire) ====================
  JIM001: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Flame Imp - small demon with horns */}
      <circle cx="50" cy="38" r="10" fill="url(#fireGrad)" />
      <rect x="43" y="38" width="5" height="14" rx="2" fill="#cc3300" />
      <rect x="52" y="38" width="5" height="14" rx="2" fill="#cc3300" />
      <polygon points="43,30 40,18 46,28" fill="#cc3300" />
      <polygon points="57,30 60,18 54,28" fill="#cc3300" />
      <circle cx="46" cy="36" r="2" fill="#ffff00" />
      <circle cx="54" cy="36" r="2" fill="#ffff00" />
      <path d="M45,55 Q50,62 55,55" fill="#cc3300" />
      {flames(50, 18, 0.8)}
    </>
  ),
  JIM002: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Cinder Scout - figure with ember trail */}
      {humanoid(50, 48, '#cc4400', 0.9)}
      <circle cx="35" cy="55" r="2" fill="#ff6600" opacity="0.8" />
      <circle cx="30" cy="50" r="3" fill="#ff4400" opacity="0.6" />
      <circle cx="24" cy="46" r="2" fill="#ff3300" opacity="0.4" />
      <circle cx="20" cy="42" r="1.5" fill="#ff2200" opacity="0.3" />
      <circle cx="28" cy="58" r="1.5" fill="#ffaa00" opacity="0.5" />
      {flames(50, 20, 0.5)}
    </>
  ),
  JIM003: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Emberheart Berserker - muscular warrior with flames */}
      <circle cx="50" cy="22" r="8" fill="#cc3300" />
      <rect x="40" y="28" width="20" height="22" rx="3" fill="#cc3300" />
      <rect x="30" y="30" width="10" height="16" rx="3" fill="#cc3300" />
      <rect x="60" y="30" width="10" height="16" rx="3" fill="#cc3300" />
      <rect x="42" y="50" width="7" height="16" rx="3" fill="#cc3300" />
      <rect x="51" y="50" width="7" height="16" rx="3" fill="#cc3300" />
      {flames(50, 12, 1)}
      {flames(35, 28, 0.6)}
      {flames(65, 28, 0.6)}
      <circle cx="46" cy="20" r="2" fill="#ffff00" />
      <circle cx="54" cy="20" r="2" fill="#ffff00" />
    </>
  ),
  JIM004: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Pyro Whelp - small dragon breathing fire */}
      {dragon(42, 42, '#cc3300', '#ff4400', 0.9)}
      {flames(72, 36, 0.7)}
      {flames(78, 34, 0.5)}
      <ellipse cx="82" cy="38" rx="4" ry="3" fill="#ff6600" opacity="0.6" />
    </>
  ),
  JIM005: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Blazing Raider - mounted warrior with fire */}
      {mountedFigure(50, 40, '#dd4400', '#882200', 1)}
      {flames(50, 18, 0.8)}
      {flames(30, 35, 0.5)}
      {flames(70, 35, 0.5)}
      <line x1="60" y1="28" x2="68" y2="10" stroke="#ff6600" strokeWidth="2" />
      <polygon points="68,10 64,8 66,14" fill="#ff6600" />
    </>
  ),
  JIM006: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Inferno Hound - fiery wolf */}
      {wolf(48, 42, '#cc3300', 1.1)}
      {flames(48, 26, 0.7)}
      {flames(58, 28, 0.5)}
      {flames(38, 30, 0.5)}
      <circle cx="66" cy="36" r="2" fill="#ffff00" />
    </>
  ),
  JIM007: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Magma Brute - lava golem */}
      {golem(50, 40, '#993300', 1.1)}
      <rect x="38" y="34" width="24" height="20" rx="4" fill="url(#lavaGrad)" opacity="0.6" />
      <ellipse cx="50" cy="60" rx="12" ry="4" fill="#ff4400" opacity="0.4" />
      <circle cx="44" cy="24" r="3" fill="#ff6600" />
      <circle cx="56" cy="24" r="3" fill="#ff6600" />
      {flames(50, 14, 0.6)}
    </>
  ),
  JIM008: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Fire Elemental - fire being */}
      <ellipse cx="50" cy="50" rx="14" ry="10" fill="url(#fireGrad)" opacity="0.9" />
      <ellipse cx="50" cy="38" rx="10" ry="12" fill="url(#emberGrad)" opacity="0.8" />
      {flames(50, 18, 1.2)}
      {flames(42, 22, 0.8)}
      {flames(58, 22, 0.8)}
      <circle cx="45" cy="36" r="3" fill="#ffffff" opacity="0.9" />
      <circle cx="55" cy="36" r="3" fill="#ffffff" opacity="0.9" />
      <ellipse cx="50" cy="62" rx="18" ry="5" fill="#ff4400" opacity="0.3" />
    </>
  ),
  JIM009: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Volcanic Drake - large dragon */}
      {dragon(46, 42, '#882200', '#cc3300', 1.5)}
      {flames(50, 18, 1)}
      <ellipse cx="50" cy="65" rx="20" ry="5" fill="#ff4400" opacity="0.3" />
      <polygon points="68,38 80,30 76,42" fill="#cc3300" />
      {flames(82, 32, 0.6)}
    </>
  ),
  JIM010: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Lava Burst - erupting lava */}
      <ellipse cx="50" cy="65" rx="30" ry="10" fill="#882200" />
      <path d="M40,60 Q35,30 45,40 Q42,15 50,35 Q55,10 55,38 Q60,25 58,42 Q65,30 60,58" fill="url(#lavaGrad)" />
      {flames(50, 15, 1.2)}
      {flames(40, 25, 0.8)}
      {flames(60, 20, 0.8)}
      <circle cx="42" cy="50" r="3" fill="#ffaa00" opacity="0.8" />
      <circle cx="58" cy="48" r="2" fill="#ffaa00" opacity="0.7" />
    </>
  ),
  JIM011: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Searing Bolt - lightning bolt on fire */}
      <polygon points="55,5 40,35 48,35 38,70 65,32 55,32 68,5" fill="url(#emberGrad)" />
      {flames(48, 30, 0.6)}
      {flames(55, 15, 0.5)}
      <polygon points="55,5 40,35 48,35 38,70 65,32 55,32 68,5" fill="none" stroke="#ffff00" strokeWidth="1" opacity="0.5" />
    </>
  ),
  JIM012: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Infernal Rain - fire raining down */}
      {flames(20, 12, 0.6)}
      {flames(35, 8, 0.7)}
      {flames(50, 5, 0.8)}
      {flames(65, 10, 0.7)}
      {flames(80, 14, 0.6)}
      {flames(28, 28, 0.5)}
      {flames(42, 25, 0.6)}
      {flames(58, 22, 0.6)}
      {flames(72, 30, 0.5)}
      <ellipse cx="50" cy="68" rx="35" ry="8" fill="#882200" opacity="0.6" />
      {flames(35, 50, 0.4)}
      {flames(50, 45, 0.5)}
      {flames(65, 48, 0.4)}
    </>
  ),
  JIM013: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Pyroblast - massive fireball */}
      <circle cx="50" cy="38" r="22" fill="url(#fireGrad)" opacity="0.9" />
      <circle cx="50" cy="38" r="15" fill="url(#emberGrad)" opacity="0.8" />
      <circle cx="50" cy="38" r="8" fill="#ffffff" opacity="0.6" />
      {flames(50, 10, 1.3)}
      {flames(30, 30, 1)}
      {flames(70, 30, 1)}
      {flames(50, 60, 0.8)}
      <ellipse cx="50" cy="68" rx="25" ry="6" fill="#ff4400" opacity="0.3" />
    </>
  ),
  JIM014: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Fire Axe - flaming axe weapon */}
      <rect x="48" y="20" width="4" height="45" rx="1" fill="#884422" />
      <path d="M38,20 Q32,10 38,5 Q45,8 52,18 Z" fill="url(#fireGrad)" />
      <path d="M38,20 Q32,10 38,5 Q45,8 52,18 Z" fill="none" stroke="#ffaa00" strokeWidth="1" opacity="0.5" />
      {flames(42, 8, 0.7)}
      {flames(38, 14, 0.5)}
      <circle cx="50" cy="68" r="3" fill="#884422" />
    </>
  ),
  JIM015: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Molten Greatsword - glowing sword */}
      {sword(50, 42, '#ff6600', '#882200', 1.4, -15)}
      <rect x="44" y="14" width="6" height="35" rx="1" fill="url(#lavaGrad)" opacity="0.5" />
      {flames(48, 10, 0.6)}
      <line x1="47" y1="16" x2="47" y2="45" stroke="#ffaa00" strokeWidth="1" opacity="0.4" />
    </>
  ),

  // ==================== TALA (green/nature) ====================
  TAL001: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Seedling Sprite - tiny plant fairy */}
      <circle cx="50" cy="35" r="7" fill="#88dd44" />
      <ellipse cx="50" cy="45" rx="5" ry="8" fill="#66aa22" />
      <ellipse cx="42" cy="30" rx="6" ry="3" fill="#66cc33" opacity="0.7" transform="rotate(-30 42 30)" />
      <ellipse cx="58" cy="30" rx="6" ry="3" fill="#66cc33" opacity="0.7" transform="rotate(30 58 30)" />
      <circle cx="47" cy="33" r="2" fill="#ffffff" />
      <circle cx="53" cy="33" r="2" fill="#ffffff" />
      <circle cx="47" cy="33" r="1" fill="#224400" />
      <circle cx="53" cy="33" r="1" fill="#224400" />
      <ellipse cx="50" cy="24" rx="3" ry="6" fill="#44bb22" />
      <circle cx="50" cy="58" r="2" fill="#88dd44" opacity="0.5" />
      <circle cx="44" cy="56" r="1.5" fill="#88dd44" opacity="0.4" />
      <circle cx="56" cy="54" r="1.5" fill="#88dd44" opacity="0.4" />
    </>
  ),
  TAL002: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Grove Warden - tree guardian */}
      {tree(50, 55, '#6B4226', '#44aa22', 1.2)}
      <circle cx="45" cy="36" r="2" fill="#88ff88" />
      <circle cx="55" cy="36" r="2" fill="#88ff88" />
      <rect x="32" y="42" width="10" height="4" rx="2" fill="#6B4226" />
      <rect x="58" y="42" width="10" height="4" rx="2" fill="#6B4226" />
    </>
  ),
  TAL003: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Thornguard - thorny defender */}
      {humanoid(50, 48, '#447722', 1)}
      <polygon points="38,32 34,24 42,30" fill="#558833" />
      <polygon points="62,32 66,24 58,30" fill="#558833" />
      <polygon points="44,20 40,12 48,18" fill="#558833" />
      <polygon points="56,20 60,12 52,18" fill="#558833" />
      <polygon points="50,55 46,48 54,48" fill="#447722" />
      {shield(36, 42, '#337711', 0.8)}
    </>
  ),
  TAL004: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Verdant Stag - noble deer */}
      <ellipse cx="48" cy="42" rx="16" ry="10" fill="#558833" />
      <circle cx="62" cy="32" r="7" fill="#558833" />
      <polygon points="58,24 52,5 56,22" fill="#6B4226" />
      <polygon points="52,5 48,10 55,15" fill="#6B4226" />
      <polygon points="64,24 68,5 66,22" fill="#6B4226" />
      <polygon points="68,5 72,10 65,15" fill="#6B4226" />
      <rect x="36" y="50" width="4" height="14" rx="1" fill="#558833" />
      <rect x="44" y="50" width="4" height="14" rx="1" fill="#558833" />
      <rect x="52" y="50" width="4" height="14" rx="1" fill="#558833" />
      <rect x="58" y="50" width="4" height="14" rx="1" fill="#558833" />
      <circle cx="65" cy="31" r="2" fill="#ffffff" />
    </>
  ),
  TAL005: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Elder Treant - ancient tree creature */}
      <rect x="42" y="30" width="16" height="35" rx="4" fill="url(#barkGrad)" />
      <ellipse cx="50" cy="22" rx="20" ry="16" fill="url(#leafGrad)" />
      <ellipse cx="35" cy="18" rx="10" ry="8" fill="#44aa22" opacity="0.7" />
      <ellipse cx="65" cy="18" rx="10" ry="8" fill="#44aa22" opacity="0.7" />
      <circle cx="45" cy="38" r="3" fill="#88ff88" />
      <circle cx="55" cy="38" r="3" fill="#88ff88" />
      <path d="M44,46 Q50,50 56,46" fill="none" stroke="#5a3e0a" strokeWidth="2" />
      <rect x="32" y="42" width="12" height="5" rx="2" fill="#6B4226" />
      <rect x="56" y="42" width="12" height="5" rx="2" fill="#6B4226" />
    </>
  ),
  TAL006: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Wildbloom Healer - flower healer */}
      {humanoid(50, 48, '#44aa44', 0.9)}
      <circle cx="50" cy="14" r="8" fill="#ff88aa" opacity="0.7" />
      <circle cx="50" cy="14" r="4" fill="#ffdd44" />
      <ellipse cx="42" cy="14" rx="4" ry="6" fill="#ff88aa" opacity="0.6" />
      <ellipse cx="58" cy="14" rx="4" ry="6" fill="#ff88aa" opacity="0.6" />
      <ellipse cx="50" cy="8" rx="6" ry="4" fill="#ff88aa" opacity="0.6" />
      <circle cx="35" cy="45" r="3" fill="url(#healGrad)" opacity="0.6" />
      <circle cx="65" cy="40" r="2" fill="url(#healGrad)" opacity="0.5" />
    </>
  ),
  TAL007: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Ancient of Lore - wise tree */}
      <rect x="40" y="25" width="20" height="40" rx="5" fill="url(#barkGrad)" />
      <ellipse cx="50" cy="18" rx="22" ry="14" fill="url(#leafGrad)" />
      <circle cx="44" cy="35" r="3" fill="#aaddaa" />
      <circle cx="56" cy="35" r="3" fill="#aaddaa" />
      <path d="M44,42 Q50,46 56,42" fill="none" stroke="#5a3e0a" strokeWidth="1.5" />
      <circle cx="30" cy="28" r="5" fill="#88ff88" opacity="0.4" />
      <circle cx="70" cy="25" r="4" fill="#88ff88" opacity="0.4" />
      <circle cx="50" cy="8" r="3" fill="#ffdd44" opacity="0.5" />
    </>
  ),
  TAL008: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Ironbark Protector - armored tree */}
      <rect x="38" y="20" width="24" height="42" rx="4" fill="#5a3e0a" />
      <rect x="36" y="22" width="28" height="38" rx="4" fill="url(#barkGrad)" opacity="0.8" />
      <ellipse cx="50" cy="14" rx="16" ry="10" fill="#337711" />
      <circle cx="44" cy="32" r="3" fill="#88ff88" />
      <circle cx="56" cy="32" r="3" fill="#88ff88" />
      <rect x="26" y="30" width="14" height="6" rx="3" fill="#5a3e0a" />
      <rect x="60" y="30" width="14" height="6" rx="3" fill="#5a3e0a" />
      {shield(30, 38, '#557744', 0.7)}
      <rect x="38" y="22" width="24" height="3" fill="#888888" opacity="0.4" />
      <rect x="38" y="42" width="24" height="3" fill="#888888" opacity="0.4" />
    </>
  ),
  TAL009: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Gaia, World Tree - massive tree */}
      <rect x="40" y="30" width="20" height="45" rx="5" fill="url(#barkGrad)" />
      <ellipse cx="50" cy="22" rx="35" ry="20" fill="url(#leafGrad)" />
      <ellipse cx="25" cy="15" rx="14" ry="10" fill="#44aa22" opacity="0.7" />
      <ellipse cx="75" cy="15" rx="14" ry="10" fill="#44aa22" opacity="0.7" />
      <ellipse cx="50" cy="8" rx="18" ry="8" fill="#55bb33" opacity="0.6" />
      <circle cx="30" cy="25" r="2" fill="#88ff88" opacity="0.6" />
      <circle cx="70" cy="22" r="2" fill="#88ff88" opacity="0.6" />
      <circle cx="50" cy="12" r="3" fill="#ffdd44" opacity="0.5" />
      <circle cx="40" cy="18" r="1.5" fill="#88ff88" opacity="0.5" />
      <circle cx="60" cy="16" r="1.5" fill="#88ff88" opacity="0.5" />
      <path d="M35,70 Q30,75 25,72" fill="#6B4226" opacity="0.6" />
      <path d="M65,70 Q70,75 75,72" fill="#6B4226" opacity="0.6" />
    </>
  ),
  TAL010: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Nature's Blessing - glowing leaves */}
      <ellipse cx="50" cy="40" rx="25" ry="25" fill="url(#healGrad)" opacity="0.2" />
      <ellipse cx="40" cy="30" rx="8" ry="4" fill="#66cc33" transform="rotate(-30 40 30)" />
      <ellipse cx="60" cy="28" rx="8" ry="4" fill="#66cc33" transform="rotate(20 60 28)" />
      <ellipse cx="45" cy="45" rx="8" ry="4" fill="#55bb22" transform="rotate(-10 45 45)" />
      <ellipse cx="58" cy="48" rx="8" ry="4" fill="#55bb22" transform="rotate(15 58 48)" />
      <ellipse cx="50" cy="36" rx="6" ry="3" fill="#77dd44" transform="rotate(5 50 36)" />
      <circle cx="50" cy="38" r="10" fill="#88ff88" opacity="0.3" />
      <circle cx="50" cy="38" r="5" fill="#aaffaa" opacity="0.4" />
      <circle cx="38" cy="32" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="62" cy="30" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="50" cy="22" r="1" fill="#ffffff" opacity="0.5" />
    </>
  ),
  TAL011: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Wild Growth - sprouting plants */}
      <ellipse cx="50" cy="68" rx="35" ry="8" fill="#334422" />
      <path d="M30,68 Q28,50 32,40 Q34,50 30,68" fill="#44aa22" />
      <path d="M40,68 Q36,42 42,28 Q44,42 40,68" fill="#55bb33" />
      <path d="M50,68 Q46,35 52,18 Q54,35 50,68" fill="#66cc33" />
      <path d="M60,68 Q56,42 62,30 Q64,42 60,68" fill="#55bb33" />
      <path d="M70,68 Q68,52 72,42 Q74,52 70,68" fill="#44aa22" />
      <circle cx="52" cy="16" r="3" fill="#88ff88" opacity="0.5" />
      <circle cx="42" cy="26" r="2" fill="#88ff88" opacity="0.4" />
      <circle cx="62" cy="28" r="2" fill="#88ff88" opacity="0.4" />
    </>
  ),
  TAL012: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Rejuvenation - healing spiral */}
      <circle cx="50" cy="40" r="20" fill="url(#healGrad)" opacity="0.15" />
      <path d="M50,40 Q60,25 70,35 Q65,50 50,45 Q35,50 30,38 Q35,25 50,30 Q58,32 55,40" fill="none" stroke="#88ff88" strokeWidth="2.5" opacity="0.7" />
      <path d="M50,40 Q55,35 58,38 Q56,42 50,40" fill="#aaffaa" opacity="0.6" />
      <circle cx="50" cy="40" r="4" fill="#ffffff" opacity="0.5" />
      <circle cx="68" cy="34" r="2" fill="#88ff88" opacity="0.5" />
      <circle cx="32" cy="38" r="2" fill="#88ff88" opacity="0.5" />
      <circle cx="54" cy="26" r="1.5" fill="#aaffaa" opacity="0.4" />
    </>
  ),
  TAL013: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Overgrowth - vines overtaking */}
      <rect x="40" y="25" width="20" height="40" rx="2" fill="#666666" opacity="0.5" />
      <path d="M35,70 Q30,50 38,35 Q42,45 36,55 Q34,62 35,70" fill="#44aa22" />
      <path d="M65,70 Q70,50 62,30 Q58,42 64,52 Q66,60 65,70" fill="#44aa22" />
      <path d="M40,25 Q45,15 50,20 Q48,10 55,18 Q58,12 60,25" fill="#55bb33" />
      <path d="M38,40 Q32,38 28,42 Q35,44 38,40" fill="#55bb33" />
      <path d="M62,45 Q68,42 72,46 Q65,48 62,45" fill="#55bb33" />
      <circle cx="45" cy="16" r="2" fill="#ff6688" opacity="0.6" />
      <circle cx="58" cy="14" r="1.5" fill="#ff6688" opacity="0.5" />
    </>
  ),
  TAL014: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Claw - bear claw */}
      <path d="M50,60 Q45,40 30,15" fill="none" stroke="#aa8844" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,60 Q48,38 40,12" fill="none" stroke="#aa8844" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,60 Q50,35 50,10" fill="none" stroke="#aa8844" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,60 Q52,38 60,12" fill="none" stroke="#aa8844" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,60 Q55,40 70,15" fill="none" stroke="#aa8844" strokeWidth="4" strokeLinecap="round" />
      <circle cx="30" cy="13" r="3" fill="#ccaa66" />
      <circle cx="40" cy="10" r="3" fill="#ccaa66" />
      <circle cx="50" cy="8" r="3" fill="#ccaa66" />
      <circle cx="60" cy="10" r="3" fill="#ccaa66" />
      <circle cx="70" cy="13" r="3" fill="#ccaa66" />
    </>
  ),
  TAL015: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Vine Lash - thorny whip */}
      <path d="M20,60 Q35,50 45,35 Q55,20 70,15 Q80,12 85,10" fill="none" stroke="#44aa22" strokeWidth="4" strokeLinecap="round" />
      <polygon points="40,38 36,34 42,36" fill="#558833" />
      <polygon points="52,26 48,22 54,24" fill="#558833" />
      <polygon points="62,18 58,14 64,16" fill="#558833" />
      <polygon points="72,14 68,10 74,12" fill="#558833" />
      <polygon points="46,42 42,38 48,40" fill="#558833" />
      <circle cx="85" cy="10" r="3" fill="#66cc33" />
    </>
  ),

  // ==================== DEREK (yellow/tech) ====================
  DRK001: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Clockwork Gnome - small robot/gnome */}
      <circle cx="50" cy="30" r="10" fill="url(#metalGrad)" />
      <rect x="42" y="38" width="16" height="16" rx="3" fill="url(#metalGrad)" />
      <rect x="34" y="40" width="8" height="4" rx="2" fill="#aaaaaa" />
      <rect x="58" y="40" width="8" height="4" rx="2" fill="#aaaaaa" />
      <rect x="44" y="54" width="5" height="10" rx="2" fill="#aaaaaa" />
      <rect x="51" y="54" width="5" height="10" rx="2" fill="#aaaaaa" />
      {gear(50, 22, '#cc9900', 0.5)}
      <circle cx="46" cy="28" r="3" fill="#ffdd44" />
      <circle cx="54" cy="28" r="3" fill="#ffdd44" />
      <circle cx="46" cy="28" r="1.5" fill="#1a1500" />
      <circle cx="54" cy="28" r="1.5" fill="#1a1500" />
    </>
  ),
  DRK002: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Gizmo Technician - engineer figure */}
      {humanoid(50, 48, '#aa8833', 1)}
      <rect x="60" y="32" width="12" height="8" rx="2" fill="url(#metalGrad)" />
      {gear(66, 28, '#cc9900', 0.4)}
      <circle cx="46" cy="28" r="2" fill="#ffdd44" />
      <circle cx="54" cy="28" r="2" fill="#ffdd44" />
      <rect x="35" y="38" width="6" height="4" rx="1" fill="#cc9900" />
    </>
  ),
  DRK003: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Spare Parts Dealer - merchant with gears */}
      {humanoid(42, 48, '#887744', 0.9)}
      <rect x="58" y="30" width="18" height="22" rx="3" fill="#665533" />
      {gear(62, 34, '#cc9900', 0.35)}
      {gear(72, 38, '#aaaaaa', 0.3)}
      {gear(66, 46, '#cc9900', 0.25)}
      <rect x="58" y="28" width="18" height="3" rx="1" fill="#887744" />
    </>
  ),
  DRK004: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Blueprint Archivist - figure with scrolls */}
      {humanoid(45, 48, '#777788', 0.9)}
      <rect x="60" y="22" width="14" height="18" rx="2" fill="#3355aa" opacity="0.7" />
      <line x1="63" y1="26" x2="71" y2="26" stroke="#88aaff" strokeWidth="0.8" />
      <line x1="63" y1="29" x2="71" y2="29" stroke="#88aaff" strokeWidth="0.8" />
      <line x1="63" y1="32" x2="71" y2="32" stroke="#88aaff" strokeWidth="0.8" />
      <line x1="63" y1="35" x2="68" y2="35" stroke="#88aaff" strokeWidth="0.8" />
      <rect x="58" y="44" width="10" height="14" rx="3" fill="#ddcc88" />
      <ellipse cx="63" cy="44" rx="5" ry="3" fill="#ddcc88" />
    </>
  ),
  DRK005: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Copper Automaton - robot */}
      <circle cx="50" cy="24" r="10" fill="url(#techGrad)" />
      <rect x="38" y="32" width="24" height="22" rx="4" fill="url(#techGrad)" />
      <rect x="28" y="34" width="10" height="6" rx="3" fill="#cc9900" />
      <rect x="62" y="34" width="10" height="6" rx="3" fill="#cc9900" />
      <rect x="40" y="54" width="8" height="12" rx="3" fill="#cc9900" />
      <rect x="52" y="54" width="8" height="12" rx="3" fill="#cc9900" />
      <circle cx="44" cy="22" r="3" fill="#ffffff" />
      <circle cx="56" cy="22" r="3" fill="#ffffff" />
      <circle cx="44" cy="22" r="1.5" fill="#1a1500" />
      <circle cx="56" cy="22" r="1.5" fill="#1a1500" />
      <rect x="44" y="40" width="12" height="2" fill="#ffee66" opacity="0.6" />
    </>
  ),
  DRK006: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Gadget Auctioneer - figure with gadgets */}
      {humanoid(50, 48, '#aa8833', 1)}
      <rect x="65" y="25" width="8" height="6" rx="1" fill="url(#metalGrad)" />
      <circle cx="69" cy="24" r="3" fill="#ffdd44" />
      <rect x="26" y="35" width="10" height="6" rx="2" fill="#cc9900" />
      <circle cx="31" cy="34" r="2" fill="#ffee66" />
      <rect x="35" y="22" width="4" height="8" rx="1" fill="#aaaaaa" />
      <circle cx="37" cy="21" r="2" fill="#ffdd44" opacity="0.7" />
    </>
  ),
  DRK007: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Mech Overseer - large mech */}
      <rect x="34" y="15" width="32" height="30" rx="5" fill="url(#metalGrad)" />
      <circle cx="44" cy="26" r="5" fill="#ffdd44" />
      <circle cx="56" cy="26" r="5" fill="#ffdd44" />
      <circle cx="44" cy="26" r="2.5" fill="#1a1500" />
      <circle cx="56" cy="26" r="2.5" fill="#1a1500" />
      <rect x="24" y="20" width="12" height="8" rx="3" fill="#aaaaaa" />
      <rect x="64" y="20" width="12" height="8" rx="3" fill="#aaaaaa" />
      <rect x="36" y="45" width="12" height="18" rx="4" fill="#999999" />
      <rect x="52" y="45" width="12" height="18" rx="4" fill="#999999" />
      <rect x="40" y="36" width="20" height="4" fill="#cc9900" />
      {gear(20, 24, '#cc9900', 0.3)}
      {gear(80, 24, '#cc9900', 0.3)}
    </>
  ),
  DRK008: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Stealth Drone - flying drone */}
      <ellipse cx="50" cy="36" rx="20" ry="6" fill="url(#metalGrad)" />
      <circle cx="50" cy="36" r="5" fill="#333333" />
      <circle cx="50" cy="36" r="2" fill="#ff3333" />
      <line x1="30" y1="36" x2="20" y2="30" stroke="#aaaaaa" strokeWidth="2" />
      <line x1="70" y1="36" x2="80" y2="30" stroke="#aaaaaa" strokeWidth="2" />
      <circle cx="20" cy="30" r="4" fill="#888888" opacity="0.3" />
      <circle cx="80" cy="30" r="4" fill="#888888" opacity="0.3" />
      <ellipse cx="20" cy="30" rx="6" ry="1" fill="#aaaaaa" opacity="0.3" />
      <ellipse cx="80" cy="30" rx="6" ry="1" fill="#aaaaaa" opacity="0.3" />
    </>
  ),
  DRK009: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Siege Engine - tank/cannon */}
      <rect x="20" y="40" width="55" height="20" rx="4" fill="url(#metalGrad)" />
      <circle cx="30" cy="62" r="6" fill="#666666" />
      <circle cx="50" cy="62" r="6" fill="#666666" />
      <circle cx="68" cy="62" r="6" fill="#666666" />
      <circle cx="30" cy="62" r="3" fill="#444444" />
      <circle cx="50" cy="62" r="3" fill="#444444" />
      <circle cx="68" cy="62" r="3" fill="#444444" />
      <rect x="60" y="30" width="28" height="8" rx="3" fill="#999999" />
      <circle cx="88" cy="34" r="4" fill="#666666" />
      <rect x="35" y="35" width="15" height="8" rx="2" fill="#cc9900" />
    </>
  ),
  DRK010: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* The Innovator - heroic inventor */}
      {humanoid(50, 46, '#cc9900', 1.1)}
      <rect x="64" y="28" width="14" height="10" rx="2" fill="url(#metalGrad)" />
      <circle cx="71" cy="26" r="4" fill="url(#sparkGrad)" />
      {gear(28, 25, '#cc9900', 0.4)}
      <circle cx="50" cy="14" r="4" fill="#ffee66" opacity="0.4" />
      <line x1="50" y1="10" x2="50" y2="4" stroke="#ffee66" strokeWidth="1" opacity="0.3" />
      <line x1="44" y1="11" x2="40" y2="6" stroke="#ffee66" strokeWidth="1" opacity="0.3" />
      <line x1="56" y1="11" x2="60" y2="6" stroke="#ffee66" strokeWidth="1" opacity="0.3" />
    </>
  ),
  DRK011: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Quick Hack - circuit board spark */}
      <rect x="20" y="20" width="60" height="40" rx="4" fill="#224422" />
      <line x1="30" y1="30" x2="50" y2="30" stroke="#cc9900" strokeWidth="1.5" />
      <line x1="50" y1="30" x2="50" y2="50" stroke="#cc9900" strokeWidth="1.5" />
      <line x1="50" y1="50" x2="70" y2="50" stroke="#cc9900" strokeWidth="1.5" />
      <line x1="30" y1="40" x2="40" y2="40" stroke="#cc9900" strokeWidth="1" />
      <line x1="40" y1="40" x2="40" y2="50" stroke="#cc9900" strokeWidth="1" />
      <line x1="60" y1="30" x2="70" y2="30" stroke="#cc9900" strokeWidth="1" />
      <circle cx="50" cy="30" r="3" fill="url(#sparkGrad)" />
      <circle cx="50" cy="30" r="6" fill="#ffee66" opacity="0.2" />
      <circle cx="30" cy="30" r="2" fill="#cc9900" />
      <circle cx="70" cy="50" r="2" fill="#cc9900" />
      <circle cx="70" cy="30" r="2" fill="#cc9900" />
    </>
  ),
  DRK012: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Schematic Surge - blueprint with energy */}
      <rect x="22" y="15" width="56" height="50" rx="3" fill="#223355" opacity="0.8" />
      <rect x="28" y="25" width="20" height="15" rx="1" fill="none" stroke="#5588cc" strokeWidth="0.8" />
      <line x1="28" y1="45" x2="55" y2="45" stroke="#5588cc" strokeWidth="0.8" />
      <line x1="28" y1="50" x2="48" y2="50" stroke="#5588cc" strokeWidth="0.8" />
      <line x1="28" y1="55" x2="52" y2="55" stroke="#5588cc" strokeWidth="0.8" />
      <circle cx="60" cy="30" r="8" fill="url(#sparkGrad)" opacity="0.6" />
      <line x1="60" y1="22" x2="60" y2="16" stroke="#ffee66" strokeWidth="2" />
      <line x1="66" y1="24" x2="72" y2="18" stroke="#ffee66" strokeWidth="2" />
      <line x1="68" y1="30" x2="74" y2="30" stroke="#ffee66" strokeWidth="2" />
    </>
  ),
  DRK013: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Sprint Protocol - speed lines */}
      <line x1="10" y1="25" x2="55" y2="25" stroke="#ffdd44" strokeWidth="3" opacity="0.8" />
      <line x1="15" y1="35" x2="65" y2="35" stroke="#ffdd44" strokeWidth="4" opacity="0.9" />
      <line x1="20" y1="45" x2="75" y2="45" stroke="#ffdd44" strokeWidth="5" opacity="1" />
      <line x1="15" y1="55" x2="65" y2="55" stroke="#ffdd44" strokeWidth="4" opacity="0.9" />
      <line x1="10" y1="65" x2="55" y2="65" stroke="#ffdd44" strokeWidth="3" opacity="0.8" />
      <polygon points="80,45 90,40 90,50" fill="url(#sparkGrad)" />
      <polygon points="70,35 78,32 78,38" fill="#ffdd44" opacity="0.6" />
      <polygon points="60,55 68,52 68,58" fill="#ffdd44" opacity="0.6" />
    </>
  ),
  DRK014: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Tinker's Oil - oil bottle */}
      <rect x="38" y="35" width="24" height="28" rx="4" fill="#555544" />
      <rect x="44" y="25" width="12" height="12" rx="2" fill="#555544" />
      <rect x="46" y="20" width="8" height="6" rx="2" fill="#888877" />
      <ellipse cx="50" cy="63" rx="12" ry="3" fill="#333322" opacity="0.5" />
      <ellipse cx="55" cy="45" rx="4" ry="6" fill="#778844" opacity="0.4" />
      <circle cx="42" cy="68" r="4" fill="#556633" opacity="0.5" />
      <circle cx="38" cy="72" r="2" fill="#556633" opacity="0.3" />
    </>
  ),
  DRK015: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Electro Wrench - electric wrench */}
      <rect x="46" y="15" width="8" height="40" rx="2" fill="url(#metalGrad)" />
      <path d="M40,12 Q38,5 44,8 L44,18 Q42,20 40,18 Z" fill="#aaaaaa" />
      <path d="M56,18 Q58,20 56,18 L56,8 Q62,5 60,12 Z" fill="#aaaaaa" />
      <circle cx="50" cy="58" r="6" fill="#888888" />
      <circle cx="50" cy="58" r="3" fill="#666666" />
      <line x1="42" y1="30" x2="34" y2="24" stroke="#ffee66" strokeWidth="2" />
      <line x1="58" y1="30" x2="66" y2="24" stroke="#ffee66" strokeWidth="2" />
      <line x1="40" y1="35" x2="32" y2="35" stroke="#ffee66" strokeWidth="1.5" />
      <line x1="60" y1="35" x2="68" y2="35" stroke="#ffee66" strokeWidth="1.5" />
      <circle cx="50" cy="25" r="3" fill="#ffee66" opacity="0.3" />
    </>
  ),

  // ==================== ANDERS (blue/frost) ====================
  AND001: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frost Sprite - ice fairy */}
      <circle cx="50" cy="32" r="7" fill="#aaeeff" />
      <ellipse cx="50" cy="44" rx="5" ry="8" fill="#88ccff" />
      <ellipse cx="40" cy="28" rx="8" ry="3" fill="#aaeeff" opacity="0.5" transform="rotate(-30 40 28)" />
      <ellipse cx="60" cy="28" rx="8" ry="3" fill="#aaeeff" opacity="0.5" transform="rotate(30 60 28)" />
      <circle cx="47" cy="30" r="2" fill="#ffffff" />
      <circle cx="53" cy="30" r="2" fill="#ffffff" />
      {iceCrystal(50, 18, '#aaeeff', 0.5)}
      <circle cx="42" cy="50" r="1.5" fill="#aaeeff" opacity="0.4" />
      <circle cx="58" cy="48" r="1" fill="#aaeeff" opacity="0.4" />
    </>
  ),
  AND002: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Glacial Sentry - ice guard */}
      {knight(50, 48, '#4488cc', 1)}
      {iceCrystal(34, 38, '#88ccff', 0.6)}
      <rect x="62" y="30" width="4" height="22" rx="1" fill="#88ccff" />
      <polygon points="64,28 60,22 68,22" fill="#aaeeff" />
      <circle cx="46" cy="28" r="2" fill="#aaeeff" />
      <circle cx="54" cy="28" r="2" fill="#aaeeff" />
    </>
  ),
  AND003: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Ice Barrier Guard - shield wall of ice */}
      <rect x="20" y="20" width="14" height="45" rx="2" fill="url(#iceGrad)" opacity="0.8" />
      <rect x="36" y="15" width="14" height="50" rx="2" fill="url(#frostGrad)" opacity="0.9" />
      <rect x="52" y="18" width="14" height="48" rx="2" fill="url(#iceGrad)" opacity="0.85" />
      <rect x="68" y="22" width="14" height="44" rx="2" fill="url(#frostGrad)" opacity="0.8" />
      {iceCrystal(27, 18, '#aaeeff', 0.4)}
      {iceCrystal(43, 12, '#aaeeff', 0.45)}
      {iceCrystal(59, 15, '#aaeeff', 0.4)}
      {iceCrystal(75, 20, '#aaeeff', 0.35)}
    </>
  ),
  AND004: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Water Elemental - water being */}
      <ellipse cx="50" cy="50" rx="14" ry="10" fill="url(#iceGrad)" opacity="0.8" />
      <ellipse cx="50" cy="36" rx="11" ry="14" fill="url(#frostGrad)" opacity="0.7" />
      <ellipse cx="50" cy="24" rx="8" ry="10" fill="#88ccff" opacity="0.6" />
      <circle cx="45" cy="32" r="3" fill="#ffffff" opacity="0.7" />
      <circle cx="55" cy="32" r="3" fill="#ffffff" opacity="0.7" />
      <ellipse cx="42" cy="40" rx="8" ry="4" fill="#88ccff" opacity="0.4" transform="rotate(-20 42 40)" />
      <ellipse cx="58" cy="40" rx="8" ry="4" fill="#88ccff" opacity="0.4" transform="rotate(20 58 40)" />
      <ellipse cx="50" cy="62" rx="18" ry="5" fill="#4488cc" opacity="0.3" />
    </>
  ),
  AND005: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Icicle Archer - archer with ice arrows */}
      {archer(46, 48, '#4488cc', '#aaeeff', 1)}
      {iceCrystal(72, 42, '#aaeeff', 0.3)}
      <line x1="56" y1="42" x2="78" y2="42" stroke="#aaeeff" strokeWidth="1" />
      <polygon points="78,42 75,40 75,44" fill="#aaeeff" />
    </>
  ),
  AND006: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Tidal Sage - wave mage */}
      {humanoid(50, 48, '#3366aa', 1)}
      <path d="M15,55 Q25,45 35,55 Q45,45 55,55 Q65,45 75,55 Q85,45 95,55" fill="none" stroke="#88ccff" strokeWidth="3" opacity="0.6" />
      <path d="M10,62 Q20,52 30,62 Q40,52 50,62 Q60,52 70,62 Q80,52 90,62" fill="none" stroke="#4488cc" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="18" r="4" fill="#88ccff" opacity="0.5" />
    </>
  ),
  AND007: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Avalanche Guardian - mountain of ice */}
      <polygon points="50,10 20,70 80,70" fill="url(#iceGrad)" />
      <polygon points="50,10 30,55 70,55" fill="url(#frostGrad)" opacity="0.7" />
      {iceCrystal(50, 18, '#aaeeff', 0.6)}
      {iceCrystal(35, 40, '#88ccff', 0.4)}
      {iceCrystal(65, 38, '#88ccff', 0.4)}
      <circle cx="44" cy="35" r="3" fill="#ffffff" opacity="0.6" />
      <circle cx="56" cy="35" r="3" fill="#ffffff" opacity="0.6" />
    </>
  ),
  AND008: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frost Giant - huge ice creature */}
      {golem(50, 38, '#4488cc', 1.3)}
      {iceCrystal(50, 8, '#aaeeff', 0.7)}
      <rect x="30" y="18" width="6" height="4" rx="1" fill="#88ccff" opacity="0.5" />
      <rect x="64" y="18" width="6" height="4" rx="1" fill="#88ccff" opacity="0.5" />
      <ellipse cx="50" cy="72" rx="22" ry="5" fill="#4488cc" opacity="0.3" />
    </>
  ),
  AND009: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Anders, Tidecaller - heroic mage with waves */}
      {humanoid(50, 44, '#3366cc', 1.1)}
      <path d="M10,58 Q20,48 30,58 Q40,48 50,58 Q60,48 70,58 Q80,48 90,58" fill="none" stroke="#88ccff" strokeWidth="3" opacity="0.7" />
      <path d="M5,66 Q15,56 25,66 Q35,56 45,66 Q55,56 65,66 Q75,56 85,66 Q95,56 100,66" fill="none" stroke="#4488cc" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="12" r="6" fill="#88ccff" opacity="0.4" />
      <circle cx="50" cy="12" r="3" fill="#aaeeff" opacity="0.6" />
      <line x1="38" y1="36" x2="28" y2="30" stroke="#88ccff" strokeWidth="2" />
      <circle cx="26" cy="28" r="4" fill="#aaeeff" opacity="0.5" />
    </>
  ),
  AND010: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frostbolt - ice spike */}
      <polygon points="50,5 44,40 48,38 46,75 54,75 52,38 56,40" fill="url(#frostGrad)" />
      {iceCrystal(50, 15, '#aaeeff', 0.5)}
      <circle cx="50" cy="10" r="4" fill="#ffffff" opacity="0.3" />
      <line x1="40" y1="20" x2="35" y2="15" stroke="#aaeeff" strokeWidth="1" opacity="0.4" />
      <line x1="60" y1="20" x2="65" y2="15" stroke="#aaeeff" strokeWidth="1" opacity="0.4" />
    </>
  ),
  AND011: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Blizzard - snowstorm */}
      <circle cx="20" cy="15" r="3" fill="#aaeeff" opacity="0.6" />
      <circle cx="40" cy="10" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="60" cy="18" r="3" fill="#aaeeff" opacity="0.5" />
      <circle cx="80" cy="12" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="15" cy="35" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="35" cy="30" r="3" fill="#aaeeff" opacity="0.6" />
      <circle cx="55" cy="32" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="75" cy="28" r="3" fill="#aaeeff" opacity="0.5" />
      <circle cx="25" cy="50" r="3" fill="#aaeeff" opacity="0.5" />
      <circle cx="50" cy="48" r="2" fill="#ffffff" opacity="0.6" />
      <circle cx="70" cy="45" r="3" fill="#aaeeff" opacity="0.4" />
      <circle cx="85" cy="55" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="30" cy="65" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="55" cy="62" r="3" fill="#aaeeff" opacity="0.5" />
      <circle cx="80" cy="68" r="2" fill="#ffffff" opacity="0.4" />
      <path d="M10,40 Q30,25 50,40 Q70,25 90,40" fill="none" stroke="#88ccff" strokeWidth="2" opacity="0.3" />
      <path d="M5,55 Q25,42 50,55 Q75,42 95,55" fill="none" stroke="#88ccff" strokeWidth="2" opacity="0.25" />
    </>
  ),
  AND012: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frost Nova - ice explosion ring */}
      <circle cx="50" cy="40" r="25" fill="none" stroke="url(#frostGrad)" strokeWidth="4" opacity="0.8" />
      <circle cx="50" cy="40" r="18" fill="none" stroke="#aaeeff" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="40" r="8" fill="#aaeeff" opacity="0.4" />
      <circle cx="50" cy="40" r="3" fill="#ffffff" opacity="0.6" />
      {iceCrystal(50, 12, '#aaeeff', 0.5)}
      {iceCrystal(75, 40, '#88ccff', 0.4)}
      {iceCrystal(25, 40, '#88ccff', 0.4)}
      {iceCrystal(50, 68, '#aaeeff', 0.5)}
      {iceCrystal(68, 22, '#88ccff', 0.35)}
      {iceCrystal(32, 58, '#88ccff', 0.35)}
    </>
  ),
  AND013: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Glacial Storm - swirling ice */}
      <path d="M50,40 Q70,20 80,40 Q70,60 50,50 Q30,60 20,40 Q30,20 50,30" fill="none" stroke="#88ccff" strokeWidth="3" opacity="0.7" />
      <path d="M50,40 Q65,28 72,40 Q65,52 50,46 Q35,52 28,40 Q35,28 50,34" fill="none" stroke="#aaeeff" strokeWidth="2" opacity="0.5" />
      {iceCrystal(50, 40, '#aaeeff', 0.6)}
      {iceCrystal(72, 30, '#88ccff', 0.35)}
      {iceCrystal(28, 50, '#88ccff', 0.35)}
      <circle cx="80" cy="40" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="20" cy="40" r="2" fill="#ffffff" opacity="0.4" />
      <circle cx="50" cy="20" r="1.5" fill="#ffffff" opacity="0.3" />
      <circle cx="50" cy="60" r="1.5" fill="#ffffff" opacity="0.3" />
    </>
  ),
  AND014: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Ice Lance - single ice spear */}
      <polygon points="50,5 46,15 44,65 50,70 56,65 54,15" fill="url(#frostGrad)" />
      <polygon points="50,5 47,12 53,12" fill="#ffffff" opacity="0.6" />
      {iceCrystal(50, 8, '#aaeeff', 0.35)}
      <line x1="42" y1="25" x2="38" y2="22" stroke="#aaeeff" strokeWidth="1" opacity="0.3" />
      <line x1="58" y1="25" x2="62" y2="22" stroke="#aaeeff" strokeWidth="1" opacity="0.3" />
    </>
  ),
  AND015: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frozen Blade - ice sword */}
      {sword(50, 42, '#88ccff', '#4466aa', 1.4, -15)}
      {iceCrystal(44, 18, '#aaeeff', 0.35)}
      <line x1="42" y1="20" x2="42" y2="48" stroke="#aaeeff" strokeWidth="0.5" opacity="0.3" />
      <circle cx="48" cy="52" r="2" fill="#aaeeff" opacity="0.3" />
    </>
  ),

  // ==================== DES (dark purple/void) ====================
  DES001: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 48, '#6622aa', 0.8)}
      <circle cx="50" cy="20" r="4" fill="#9933ff" opacity="0.4" />
    </>
  ),
  DES002: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 48, '#7733cc', 0.8)}
      <rect x="55" y="38" width="12" height="3" rx="1" fill="#9933ff" />
      <circle cx="70" cy="40" r="3" fill="#ff3366" opacity="0.6" />
    </>
  ),
  DES003: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <circle cx="50" cy="35" r="16" fill="url(#darkOrraGrad)" opacity="0.7" />
      <circle cx="50" cy="35" r="10" fill="url(#voidGrad)" opacity="0.5" />
      <line x1="34" y1="35" x2="66" y2="35" stroke="#9933ff" strokeWidth="1" opacity="0.6" />
      <line x1="50" y1="19" x2="50" y2="51" stroke="#9933ff" strokeWidth="1" opacity="0.6" />
    </>
  ),
  DES004: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {knight(50, 48, '#551188', 0.9)}
      <rect x="44" y="22" width="12" height="2" rx="1" fill="#9933ff" opacity="0.5" />
    </>
  ),
  DES005: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <circle cx="50" cy="30" r="18" fill="none" stroke="#9933ff" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="30" r="10" fill="url(#shadowGrad2)" opacity="0.6" />
      <path d="M35,30 Q50,10 65,30 Q50,50 35,30" fill="none" stroke="#cc66ff" strokeWidth="1" opacity="0.7" />
    </>
  ),
  DES006: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 48, '#7733cc', 1)}
      <circle cx="50" cy="20" r="12" fill="url(#voidGrad)" opacity="0.3" />
      <circle cx="35" cy="55" r="3" fill="#9933ff" opacity="0.4" />
      <circle cx="65" cy="55" r="3" fill="#9933ff" opacity="0.4" />
    </>
  ),
  DES007: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 48, '#6622aa', 0.9)}
      <rect x="58" y="32" width="8" height="10" rx="2" fill="#551188" />
      <circle cx="62" cy="28" r="4" fill="#9933ff" opacity="0.5" />
    </>
  ),
  DES008: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <ellipse cx="50" cy="38" rx="18" ry="8" fill="url(#shadowGrad2)" />
      <rect x="42" y="30" width="16" height="6" rx="3" fill="#9933ff" />
      <circle cx="42" cy="33" r="3" fill="#cc66ff" opacity="0.6" />
      <circle cx="58" cy="33" r="3" fill="#cc66ff" opacity="0.6" />
    </>
  ),
  DES009: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 48, '#330066', 1)}
      <ellipse cx="50" cy="40" rx="20" ry="10" fill="#220044" opacity="0.4" />
      <circle cx="46" cy="28" r="2" fill="#cc66ff" />
      <circle cx="54" cy="28" r="2" fill="#cc66ff" />
    </>
  ),
  DES010: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {knight(50, 48, '#551188', 1.1)}
      <rect x="38" y="20" width="24" height="4" rx="2" fill="#9933ff" opacity="0.4" />
    </>
  ),
  DES011: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <circle cx="50" cy="35" r="20" fill="url(#voidGrad)" opacity="0.4" />
      <path d="M30,35 Q50,15 70,35 Q50,55 30,35" fill="none" stroke="#9933ff" strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="35" r="6" fill="#cc66ff" opacity="0.5" />
    </>
  ),
  DES012: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {golem(50, 42, '#551188', 0.8)}
      <rect x="40" y="18" width="20" height="3" rx="1" fill="#9933ff" />
      <circle cx="46" cy="26" r="2" fill="#ff3366" />
      <circle cx="54" cy="26" r="2" fill="#ff3366" />
    </>
  ),
  DES013: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <circle cx="50" cy="35" r="22" fill="url(#darkOrraGrad)" opacity="0.3" />
      <line x1="28" y1="35" x2="72" y2="35" stroke="#cc66ff" strokeWidth="3" />
      <line x1="50" y1="13" x2="50" y2="57" stroke="#cc66ff" strokeWidth="3" />
      <circle cx="50" cy="35" r="8" fill="#9933ff" opacity="0.7" />
    </>
  ),
  DES014: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {golem(50, 42, '#6622aa', 1)}
      <circle cx="30" cy="55" r="4" fill="#9933ff" opacity="0.4" />
      <circle cx="70" cy="55" r="4" fill="#9933ff" opacity="0.4" />
    </>
  ),
  DES015: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {knight(50, 48, '#7733cc', 1)}
      <circle cx="50" cy="15" r="8" fill="url(#voidGrad)" opacity="0.5" />
      <line x1="42" y1="15" x2="58" y2="15" stroke="#cc66ff" strokeWidth="1" />
    </>
  ),
  DES016: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {knight(50, 48, '#551188', 1.2)}
      <rect x="30" y="15" width="40" height="3" rx="1" fill="#9933ff" opacity="0.3" />
    </>
  ),
  DES017: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      <ellipse cx="50" cy="40" rx="35" ry="20" fill="url(#voidGrad)" opacity="0.3" />
      <path d="M15,40 Q50,5 85,40" fill="none" stroke="#9933ff" strokeWidth="3" opacity="0.7" />
      <path d="M15,40 Q50,75 85,40" fill="none" stroke="#cc66ff" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="40" r="5" fill="#cc66ff" opacity="0.8" />
    </>
  ),
  DES018: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {golem(50, 42, '#7733cc', 1.2)}
      <circle cx="50" cy="10" r="6" fill="#9933ff" opacity="0.5" />
      <line x1="50" y1="16" x2="50" y2="26" stroke="#cc66ff" strokeWidth="2" />
    </>
  ),
  DES019: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {golem(50, 42, '#551188', 1.3)}
      <circle cx="46" cy="22" r="3" fill="#cc66ff" />
      <circle cx="54" cy="22" r="3" fill="#cc66ff" />
    </>
  ),
  DES020: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {humanoid(50, 46, '#9933ff', 1.2)}
      <circle cx="50" cy="10" r="10" fill="url(#darkOrraGrad)" opacity="0.6" />
      <circle cx="50" cy="10" r="5" fill="#cc66ff" opacity="0.8" />
      <circle cx="30" cy="55" r="5" fill="#9933ff" opacity="0.3" />
      <circle cx="70" cy="55" r="5" fill="#9933ff" opacity="0.3" />
      <line x1="40" y1="10" x2="30" y2="55" stroke="#9933ff" strokeWidth="1" opacity="0.3" />
      <line x1="60" y1="10" x2="70" y2="55" stroke="#9933ff" strokeWidth="1" opacity="0.3" />
    </>
  ),

  // ==================== ASTRID (gold/white) ====================
  AST001: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {humanoid(50, 48, '#cc9900', 0.8)}
      {shield(50, 30, 'url(#shieldGrad)', 0.6)}
    </>
  ),
  AST002: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {humanoid(50, 48, '#b8860b', 0.8)}
      <circle cx="65" cy="35" r="5" fill="#ffe066" opacity="0.6" />
      <polygon points="65,28 63,35 67,35" fill="#ffe066" />
    </>
  ),
  AST003: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      <ellipse cx="50" cy="35" rx="20" ry="18" fill="url(#holyLightGrad)" opacity="0.3" />
      {shield(50, 35, 'url(#shieldGrad)', 1)}
      <circle cx="50" cy="35" r="5" fill="#ffffff" opacity="0.4" />
    </>
  ),
  AST004: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#b8860b', 0.9)}
      {shield(38, 40, 'url(#guardGrad)', 0.5)}
    </>
  ),
  AST005: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {shield(50, 32, 'url(#shieldGrad)', 1.2)}
      <circle cx="50" cy="32" r="6" fill="#ffffff" opacity="0.5" />
      <circle cx="50" cy="15" r="3" fill="#ffe066" opacity="0.6" />
    </>
  ),
  AST006: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#cc9900', 0.9)}
      <rect x="35" y="60" width="30" height="3" rx="1" fill="#b8860b" opacity="0.5" />
    </>
  ),
  AST007: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {wolf(48, 42, '#b8860b', 0.9)}
      <circle cx="48" cy="28" r="4" fill="#ffe066" opacity="0.4" />
    </>
  ),
  AST008: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#ffd700', 0.9)}
      {shield(38, 40, 'url(#shieldGrad)', 0.5)}
      <circle cx="50" cy="20" r="5" fill="#ffffff" opacity="0.3" />
    </>
  ),
  AST009: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      <ellipse cx="50" cy="35" rx="28" ry="18" fill="url(#holyLightGrad)" opacity="0.2" />
      <circle cx="50" cy="35" r="12" fill="url(#shieldGrad)" opacity="0.4" />
      <circle cx="50" cy="35" r="5" fill="#ffffff" opacity="0.6" />
    </>
  ),
  AST010: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#cc9900', 1)}
      {shield(38, 42, 'url(#guardGrad)', 0.6)}
    </>
  ),
  AST011: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {iceCrystal(50, 30, '#ffd700', 1)}
      {shield(50, 48, 'url(#shieldGrad)', 0.7)}
      <circle cx="50" cy="30" r="4" fill="#ffffff" opacity="0.5" />
    </>
  ),
  AST012: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#b8860b', 1.1)}
      <rect x="35" y="15" width="30" height="3" rx="1" fill="#ffe066" opacity="0.3" />
    </>
  ),
  AST013: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      <ellipse cx="50" cy="35" rx="30" ry="22" fill="url(#holyLightGrad)" opacity="0.2" />
      <circle cx="50" cy="35" r="15" fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="35" r="8" fill="#ffffff" opacity="0.3" />
      {shield(50, 35, 'url(#shieldGrad)', 0.5)}
    </>
  ),
  AST014: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {shield(50, 32, 'url(#shieldGrad)', 1.4)}
      {sword(58, 40, '#ffd700', '#b8860b', 0.8, -20)}
    </>
  ),
  AST015: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#ffd700', 1.1)}
      {shield(36, 42, 'url(#shieldGrad)', 0.6)}
      <circle cx="50" cy="15" r="6" fill="#ffffff" opacity="0.3" />
    </>
  ),
  AST016: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {knight(50, 48, '#cc9900', 1.1)}
      {sword(64, 42, '#ffd700', '#b8860b', 0.7)}
    </>
  ),
  AST017: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      <rect x="25" y="15" width="50" height="50" rx="5" fill="url(#guardGrad)" opacity="0.3" />
      <rect x="30" y="20" width="40" height="40" rx="3" fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.5" />
      {shield(50, 35, 'url(#shieldGrad)', 0.8)}
    </>
  ),
  AST018: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {wolf(48, 42, '#ffd700', 1.1)}
      <circle cx="48" cy="25" r="8" fill="#ffffff" opacity="0.2" />
      <circle cx="48" cy="25" r="4" fill="#ffe066" opacity="0.5" />
    </>
  ),
  AST019: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {golem(50, 42, '#cc9900', 1.1)}
      <circle cx="46" cy="22" r="3" fill="#ffe066" />
      <circle cx="54" cy="22" r="3" fill="#ffe066" />
    </>
  ),
  AST020: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {humanoid(50, 46, '#ffd700', 1.2)}
      {shield(36, 40, 'url(#shieldGrad)', 0.7)}
      <circle cx="50" cy="10" r="10" fill="url(#holyLightGrad)" opacity="0.3" />
      <circle cx="50" cy="10" r="5" fill="#ffffff" opacity="0.5" />
      <line x1="40" y1="10" x2="30" y2="55" stroke="#ffd700" strokeWidth="1" opacity="0.3" />
      <line x1="60" y1="10" x2="70" y2="55" stroke="#ffd700" strokeWidth="1" opacity="0.3" />
    </>
  ),

  // ==================== AVA (pink/magenta tech) ====================
  AVA001: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {humanoid(42, 48, '#cc3388', 0.8)}
      <rect x="60" y="35" width="8" height="5" rx="2" fill="#ff69b4" />
      <circle cx="64" cy="32" r="3" fill="#ff99cc" opacity="0.6" />
    </>
  ),
  AVA002: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <ellipse cx="50" cy="38" rx="12" ry="6" fill="#cc3388" />
      <path d="M38,36 Q25,20 42,34" fill="#ff69b4" opacity="0.7" />
      <path d="M62,36 Q75,20 58,34" fill="#ff69b4" opacity="0.7" />
      <circle cx="48" cy="36" r="2" fill="#ffffff" />
    </>
  ),
  AVA003: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="30" y="25" width="10" height="6" rx="2" fill="#ff69b4" />
      <circle cx="35" cy="22" r="3" fill="#ff99cc" opacity="0.6" />
      <rect x="55" y="35" width="10" height="6" rx="2" fill="#ff69b4" />
      <circle cx="60" cy="32" r="3" fill="#ff99cc" opacity="0.6" />
      <line x1="40" y1="28" x2="55" y2="38" stroke="#ff3399" strokeWidth="1" opacity="0.4" />
    </>
  ),
  AVA004: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="35" y="25" width="30" height="25" rx="4" fill="url(#gadgetGrad)" opacity="0.5" />
      <circle cx="50" cy="37" r="8" fill="#ff99cc" opacity="0.4" />
      <rect x="42" y="33" width="16" height="8" rx="2" fill="#cc3388" />
      <circle cx="50" cy="37" r="3" fill="#ffffff" opacity="0.5" />
    </>
  ),
  AVA005: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {humanoid(42, 48, '#cc3388', 0.8)}
      <rect x="58" y="38" width="8" height="5" rx="2" fill="#ff69b4" />
      <circle cx="62" cy="35" r="3" fill="#ff99cc" opacity="0.5" />
    </>
  ),
  AVA006: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="35" y="22" width="30" height="18" rx="5" fill="url(#techPinkGrad)" opacity="0.4" />
      <circle cx="50" cy="31" r="8" fill="#ff99cc" opacity="0.5" />
      <path d="M42,31 Q50,20 58,31" fill="none" stroke="#ff69b4" strokeWidth="2" />
    </>
  ),
  AVA007: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="38" y="30" width="24" height="12" rx="4" fill="#cc3388" />
      <circle cx="50" cy="27" r="5" fill="#ff69b4" opacity="0.5" />
      <ellipse cx="50" cy="45" rx="16" ry="6" fill="#330022" opacity="0.3" />
      <circle cx="48" cy="34" r="2" fill="#ffffff" />
    </>
  ),
  AVA008: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {humanoid(50, 48, '#cc3388', 0.9)}
      {gear(68, 28, '#ff69b4', 0.5)}
      <line x1="58" y1="38" x2="68" y2="28" stroke="#ff99cc" strokeWidth="1" opacity="0.4" />
    </>
  ),
  AVA009: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {humanoid(50, 48, '#cc3388', 0.9)}
      <rect x="58" y="30" width="14" height="8" rx="2" fill="#ff69b4" opacity="0.6" />
      <circle cx="65" cy="28" r="3" fill="#ff3399" opacity="0.5" />
    </>
  ),
  AVA010: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="42" y="20" width="6" height="30" rx="2" fill="#ff69b4" />
      <rect x="38" y="35" width="14" height="5" rx="2" fill="#cc3388" />
      {gear(50, 48, '#ff99cc', 0.4)}
    </>
  ),
  AVA011: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="30" y="25" width="40" height="25" rx="5" fill="url(#gadgetGrad)" opacity="0.3" />
      {humanoid(40, 48, '#cc3388', 0.7)}
      <rect x="62" y="32" width="8" height="5" rx="2" fill="#ff69b4" />
      <circle cx="66" cy="29" r="3" fill="#ff99cc" opacity="0.5" />
    </>
  ),
  AVA012: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <circle cx="50" cy="35" r="18" fill="url(#circuitGrad)" opacity="0.3" />
      <circle cx="50" cy="35" r="10" fill="#ff3399" opacity="0.4" />
      <line x1="32" y1="35" x2="68" y2="35" stroke="#ff69b4" strokeWidth="2" opacity="0.6" />
      <line x1="50" y1="17" x2="50" y2="53" stroke="#ff69b4" strokeWidth="2" opacity="0.6" />
    </>
  ),
  AVA013: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <ellipse cx="50" cy="38" rx="18" ry="10" fill="#cc3388" />
      <path d="M32,36 Q20,18 38,32" fill="#ff69b4" opacity="0.7" />
      <path d="M68,36 Q80,18 62,32" fill="#ff69b4" opacity="0.7" />
      <rect x="60" y="42" width="8" height="5" rx="2" fill="#ff99cc" />
      <circle cx="48" cy="36" r="2" fill="#ffffff" />
    </>
  ),
  AVA014: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="22" y="25" width="8" height="5" rx="2" fill="#ff69b4" />
      <rect x="35" y="18" width="8" height="5" rx="2" fill="#ff69b4" />
      <rect x="50" y="30" width="8" height="5" rx="2" fill="#ff69b4" />
      <rect x="65" y="22" width="8" height="5" rx="2" fill="#ff69b4" />
      <circle cx="26" cy="22" r="2" fill="#ff99cc" opacity="0.6" />
      <circle cx="39" cy="15" r="2" fill="#ff99cc" opacity="0.6" />
      <circle cx="54" cy="27" r="2" fill="#ff99cc" opacity="0.6" />
      <circle cx="69" cy="19" r="2" fill="#ff99cc" opacity="0.6" />
    </>
  ),
  AVA015: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="25" y="25" width="50" height="25" rx="6" fill="url(#gadgetGrad)" opacity="0.4" />
      <rect x="30" y="30" width="40" height="15" rx="3" fill="#cc3388" />
      <circle cx="40" cy="37" r="4" fill="#ff99cc" opacity="0.5" />
      <circle cx="60" cy="37" r="4" fill="#ff99cc" opacity="0.5" />
    </>
  ),
  AVA016: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="35" y="20" width="30" height="18" rx="5" fill="#cc3388" />
      <circle cx="50" cy="17" r="6" fill="#ff69b4" opacity="0.5" />
      <rect x="60" y="42" width="8" height="5" rx="2" fill="#ff69b4" />
      <rect x="32" y="42" width="8" height="5" rx="2" fill="#ff69b4" />
      <circle cx="64" cy="39" r="2" fill="#ff99cc" />
      <circle cx="36" cy="39" r="2" fill="#ff99cc" />
    </>
  ),
  AVA017: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="30" y="15" width="40" height="45" rx="5" fill="url(#techPinkGrad)" opacity="0.2" />
      {gear(50, 35, '#ff69b4', 0.8)}
      <line x1="50" y1="15" x2="50" y2="60" stroke="#ff3399" strokeWidth="1" opacity="0.3" />
    </>
  ),
  AVA018: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {iceCrystal(50, 32, '#ff69b4', 1.2)}
      <circle cx="50" cy="32" r="6" fill="#ff99cc" opacity="0.5" />
      <circle cx="50" cy="55" r="4" fill="#cc3388" opacity="0.4" />
    </>
  ),
  AVA019: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="25" y="15" width="50" height="50" rx="6" fill="url(#gadgetGrad)" opacity="0.2" />
      {gear(38, 35, '#ff69b4', 0.7)}
      {gear(62, 35, '#cc3388', 0.7)}
      <rect x="45" y="30" width="10" height="10" rx="2" fill="#ff3399" opacity="0.5" />
    </>
  ),
  AVA020: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {humanoid(50, 46, '#ff69b4', 1.1)}
      {gear(30, 22, '#cc3388', 0.5)}
      {gear(70, 22, '#cc3388', 0.5)}
      <circle cx="50" cy="10" r="8" fill="url(#circuitGrad)" opacity="0.4" />
      <rect x="62" y="50" width="8" height="5" rx="2" fill="#ff99cc" />
      <rect x="30" y="50" width="8" height="5" rx="2" fill="#ff99cc" />
      <circle cx="66" cy="47" r="2" fill="#ff3399" />
      <circle cx="34" cy="47" r="2" fill="#ff3399" />
    </>
  ),

  // ==================== LUCAS (teal/brown) ====================
  LUC001: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {wolf(50, 45, '#b8860b', 0.6)}
      <circle cx="62" cy="38" r="2" fill="#2dd4bf" />
    </>
  ),
  LUC002: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      <rect x="35" y="20" width="30" height="40" rx="3" fill="#0d9488" opacity="0.2" />
      <circle cx="50" cy="30" r="6" fill="url(#tealGrad)" opacity="0.5" />
      <path d="M44,38 Q50,28 56,38" fill="none" stroke="#2dd4bf" strokeWidth="2" />
    </>
  ),
  LUC003: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#0d9488', 0.8)}
      <ellipse cx="50" cy="45" rx="16" ry="8" fill="#051a15" opacity="0.4" />
    </>
  ),
  LUC004: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      <ellipse cx="50" cy="35" rx="16" ry="16" fill="url(#trickGrad)" opacity="0.2" />
      <path d="M40,25 Q50,45 60,25" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.7" />
      <circle cx="50" cy="35" r="5" fill="#14b8a6" opacity="0.5" />
    </>
  ),
  LUC005: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {wolf(48, 42, '#b8860b', 0.9)}
      <circle cx="62" cy="35" r="2" fill="#2dd4bf" />
      <circle cx="48" cy="28" r="4" fill="#14b8a6" opacity="0.3" />
    </>
  ),
  LUC006: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      <circle cx="50" cy="35" r="16" fill="url(#trickGrad)" opacity="0.2" />
      <path d="M34,35 Q50,15 66,35 Q50,55 34,35" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="35" r="4" fill="#5eead4" opacity="0.5" />
    </>
  ),
  LUC007: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#8b6914', 0.9)}
      {sword(62, 40, '#2dd4bf', '#8b6914', 0.7)}
    </>
  ),
  LUC008: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {wolf(48, 42, '#b8860b', 1)}
      <circle cx="62" cy="35" r="2" fill="#2dd4bf" />
      <circle cx="30" cy="50" r="2" fill="#b8860b" opacity="0.4" />
    </>
  ),
  LUC009: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#0d9488', 0.9)}
      <ellipse cx="50" cy="45" rx="18" ry="8" fill="#051a15" opacity="0.3" />
      <circle cx="46" cy="28" r="2" fill="#5eead4" />
      <circle cx="54" cy="28" r="2" fill="#5eead4" />
    </>
  ),
  LUC010: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {sword(50, 38, '#2dd4bf', '#b8860b', 1.2, -25)}
      <polygon points="50,12 48,18 52,18" fill="#b8860b" />
    </>
  ),
  LUC011: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      <path d="M30,40 Q50,20 70,40 Q50,60 30,40" fill="url(#trickGrad)" opacity="0.3" />
      <circle cx="50" cy="35" r="6" fill="#2dd4bf" opacity="0.5" />
      <path d="M44,35 L56,35" stroke="#5eead4" strokeWidth="2" />
    </>
  ),
  LUC012: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#0d9488', 1)}
      <ellipse cx="50" cy="42" rx="20" ry="10" fill="#051a15" opacity="0.3" />
    </>
  ),
  LUC013: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#14b8a6', 0.9)}
      <circle cx="62" cy="32" r="5" fill="url(#tealGrad)" opacity="0.4" />
      <circle cx="62" cy="32" r="2" fill="#5eead4" opacity="0.6" />
    </>
  ),
  LUC014: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      <ellipse cx="50" cy="35" rx="25" ry="18" fill="url(#coyoteGrad)" opacity="0.2" />
      <line x1="25" y1="35" x2="75" y2="35" stroke="#2dd4bf" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="35" r="6" fill="#14b8a6" opacity="0.5" />
      <circle cx="38" cy="28" r="2" fill="#b8860b" opacity="0.4" />
      <circle cx="62" cy="28" r="2" fill="#b8860b" opacity="0.4" />
    </>
  ),
  LUC015: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {wolf(48, 35, '#b8860b', 0.8)}
      <path d="M48,20 Q40,5 35,15" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
      <path d="M48,20 Q56,5 60,15" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
      <circle cx="48" cy="20" r="3" fill="#5eead4" opacity="0.5" />
    </>
  ),
  LUC016: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#0d9488', 1)}
      <ellipse cx="50" cy="42" rx="22" ry="10" fill="#051a15" opacity="0.4" />
      <circle cx="46" cy="28" r="2" fill="#5eead4" />
    </>
  ),
  LUC017: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 48, '#14b8a6', 1)}
      {sword(64, 40, '#2dd4bf', '#0d9488', 0.8)}
      <ellipse cx="50" cy="42" rx="18" ry="8" fill="#051a15" opacity="0.3" />
    </>
  ),
  LUC018: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {wolf(48, 42, '#b8860b', 1.1)}
      <circle cx="62" cy="35" r="3" fill="#2dd4bf" />
      <ellipse cx="48" cy="55" rx="20" ry="8" fill="#051a15" opacity="0.3" />
    </>
  ),
  LUC019: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {knight(50, 48, '#8b6914', 1.2)}
      {sword(66, 38, '#2dd4bf', '#b8860b', 0.9)}
    </>
  ),
  LUC020: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {humanoid(50, 46, '#14b8a6', 1.2)}
      {wolf(28, 55, '#b8860b', 0.5)}
      <ellipse cx="50" cy="42" rx="25" ry="10" fill="#051a15" opacity="0.3" />
      <circle cx="46" cy="24" r="2" fill="#5eead4" />
      <circle cx="54" cy="24" r="2" fill="#5eead4" />
      <line x1="50" y1="10" x2="50" y2="20" stroke="#2dd4bf" strokeWidth="1" opacity="0.5" />
    </>
  ),

  // ==================== IZZY (orange/sparkle) ====================
  IZZ001: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {humanoid(50, 48, '#cc6600', 0.8)}
      <polygon points="50,18 48,22 52,22" fill="#ff9933" />
      <circle cx="50" cy="18" r="3" fill="#ffaa44" opacity="0.5" />
    </>
  ),
  IZZ002: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <ellipse cx="50" cy="38" rx="10" ry="8" fill="#cc6600" />
      <circle cx="50" cy="30" r="6" fill="#ff8800" />
      <polygon points="47,26 50,20 53,26" fill="#ff9933" />
      <circle cx="48" cy="29" r="1.5" fill="#ffffff" />
      <rect x="44" y="46" width="4" height="6" rx="1" fill="#cc5500" />
      <rect x="52" y="46" width="4" height="6" rx="1" fill="#cc5500" />
    </>
  ),
  IZZ003: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <circle cx="50" cy="35" r="16" fill="url(#sparkleGrad)" opacity="0.3" />
      <polygon points="50,18 53,28 63,28 55,34 58,44 50,38 42,44 45,34 37,28 47,28" fill="#ff9933" opacity="0.6" />
    </>
  ),
  IZZ004: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {humanoid(50, 48, '#cc6600', 0.85)}
      <polygon points="50,20 48,24 52,24" fill="#ff9933" opacity="0.5" />
      <circle cx="62" cy="35" r="3" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ005: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <ellipse cx="50" cy="38" rx="12" ry="8" fill="#cc6600" />
      <circle cx="50" cy="30" r="7" fill="#ff8800" />
      <polygon points="47,26 50,18 53,26" fill="#ff9933" />
      <circle cx="48" cy="29" r="1.5" fill="#ffffff" />
      <rect x="43" y="46" width="4" height="7" rx="1" fill="#cc5500" />
      <rect x="53" y="46" width="4" height="7" rx="1" fill="#cc5500" />
      <circle cx="50" cy="15" r="3" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ006: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {shield(50, 35, 'url(#sparkleGrad)', 1.2)}
      <circle cx="50" cy="35" r="6" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ007: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {humanoid(50, 48, '#cc6600', 0.9)}
      <circle cx="50" cy="20" r="6" fill="#ff9933" opacity="0.4" />
      <polygon points="50,14 48,18 52,18" fill="#ffaa44" opacity="0.6" />
    </>
  ),
  IZZ008: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <circle cx="50" cy="35" r="20" fill="url(#orangeGrad)" opacity="0.2" />
      <path d="M30,35 Q50,15 70,35 Q50,55 30,35" fill="none" stroke="#ff9933" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="35" r="5" fill="#ffaa44" opacity="0.5" />
    </>
  ),
  IZZ009: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {knight(50, 48, '#cc6600', 0.9)}
      {iceCrystal(50, 20, '#ff9933', 0.5)}
      <circle cx="50" cy="20" r="3" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ010: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {golem(50, 42, '#cc6600', 0.9)}
      <polygon points="46,18 44,24 48,24" fill="#ff9933" opacity="0.5" />
      <polygon points="54,18 52,24 56,24" fill="#ff9933" opacity="0.5" />
    </>
  ),
  IZZ011: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <circle cx="50" cy="35" r="12" fill="url(#navGrad)" opacity="0.3" />
      <line x1="50" y1="23" x2="50" y2="47" stroke="#ff9933" strokeWidth="2" />
      <line x1="38" y1="35" x2="62" y2="35" stroke="#ff9933" strokeWidth="2" />
      <circle cx="50" cy="35" r="3" fill="#ffaa44" />
      <polygon points="50,20 48,25 52,25" fill="#ff6600" />
    </>
  ),
  IZZ012: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <circle cx="50" cy="35" r="18" fill="url(#sparkleGrad)" opacity="0.2" />
      <circle cx="50" cy="35" r="10" fill="url(#orangeGrad)" opacity="0.3" />
      <polygon points="50,22 48,30 52,30" fill="#ff9933" opacity="0.6" />
      <circle cx="50" cy="35" r="4" fill="#ffaa44" opacity="0.6" />
    </>
  ),
  IZZ013: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {knight(50, 48, '#cc6600', 1)}
      {sword(64, 40, '#ff9933', '#cc5500', 0.7)}
    </>
  ),
  IZZ014: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {golem(50, 42, '#ff8800', 1)}
      <polygon points="46,18 44,24 48,24" fill="#ff9933" />
      <polygon points="54,18 52,24 56,24" fill="#ff9933" />
      <circle cx="50" cy="10" r="4" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ015: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {knight(50, 48, '#cc6600', 1.1)}
      <circle cx="50" cy="15" r="8" fill="url(#sparkleGrad)" opacity="0.3" />
      <polygon points="50,7 48,13 52,13" fill="#ffaa44" opacity="0.6" />
    </>
  ),
  IZZ016: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {humanoid(50, 48, '#cc6600', 1)}
      <circle cx="50" cy="18" r="5" fill="url(#navGrad)" opacity="0.4" />
      <line x1="50" y1="13" x2="50" y2="23" stroke="#ff9933" strokeWidth="1" />
      <line x1="45" y1="18" x2="55" y2="18" stroke="#ff9933" strokeWidth="1" />
    </>
  ),
  IZZ017: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {golem(50, 42, '#ff8800', 1.1)}
      <polygon points="46,16 44,22 48,22" fill="#ff9933" />
      <polygon points="54,16 52,22 56,22" fill="#ff9933" />
      {iceCrystal(50, 8, '#ffaa44', 0.4)}
    </>
  ),
  IZZ018: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <rect x="25" y="15" width="50" height="50" rx="5" fill="url(#orangeGrad)" opacity="0.2" />
      {knight(50, 48, '#cc6600', 1.1)}
      {shield(38, 42, 'url(#sparkleGrad)', 0.5)}
    </>
  ),
  IZZ019: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      <ellipse cx="50" cy="35" rx="16" ry="12" fill="#ff8800" />
      <circle cx="50" cy="25" r="9" fill="#cc6600" />
      <polygon points="47,20 50,12 53,20" fill="#ff9933" />
      <circle cx="48" cy="24" r="2" fill="#ffffff" />
      <rect x="42" y="47" width="5" height="10" rx="2" fill="#cc5500" />
      <rect x="53" y="47" width="5" height="10" rx="2" fill="#cc5500" />
      <circle cx="50" cy="8" r="5" fill="#ffaa44" opacity="0.4" />
    </>
  ),
  IZZ020: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {humanoid(50, 46, '#ff8800', 1.2)}
      <circle cx="50" cy="10" r="10" fill="url(#sparkleGrad)" opacity="0.4" />
      <polygon points="50,0 47,8 53,8" fill="#ffaa44" opacity="0.7" />
      <circle cx="30" cy="55" r="4" fill="#ff9933" opacity="0.3" />
      <circle cx="70" cy="55" r="4" fill="#ff9933" opacity="0.3" />
      <line x1="40" y1="10" x2="30" y2="55" stroke="#ff9933" strokeWidth="1" opacity="0.3" />
      <line x1="60" y1="10" x2="70" y2="55" stroke="#ff9933" strokeWidth="1" opacity="0.3" />
    </>
  ),

  // ==================== TOKENS ====================
  AVA_TOKEN_01: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      <rect x="44" y="34" width="12" height="7" rx="3" fill="#ff69b4" />
      <circle cx="50" cy="31" r="4" fill="#ff99cc" opacity="0.6" />
    </>
  ),
  IZZ_TOKEN_01: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {iceCrystal(50, 38, '#ff9933', 0.6)}
      <circle cx="50" cy="38" r="3" fill="#ffaa44" opacity="0.5" />
    </>
  ),

  // ==================== NEUTRAL ====================
  NEU001: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Elven Archer - elf with bow */}
      {archer(48, 48, '#55aa55', '#8B6914', 1)}
      <polygon points="48,24 46,18 50,24" fill="#55aa55" />
      <polygon points="52,24 54,18 50,24" fill="#55aa55" />
    </>
  ),
  NEU002: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Squire - small knight */}
      {knight(50, 50, '#888888', 0.8)}
      {sword(64, 44, '#aaaaaa', '#666666', 0.6, -20)}
    </>
  ),
  NEU_TOKEN_03: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Squire token - small knight */}
      {knight(50, 50, '#888888', 0.8)}
      {sword(64, 44, '#aaaaaa', '#666666', 0.6, -20)}
    </>
  ),
  NEU003: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Scrappy Fighter - rough brawler */}
      {humanoid(50, 48, '#996633', 1)}
      <rect x="62" y="34" width="8" height="4" rx="1" fill="#888888" />
      <rect x="30" y="34" width="8" height="4" rx="1" fill="#888888" />
      <circle cx="46" cy="28" r="2" fill="#ffffff" />
      <circle cx="54" cy="28" r="2" fill="#ffffff" />
    </>
  ),
  NEU004: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* River Crocolisk - crocodile */}
      <ellipse cx="45" cy="45" rx="22" ry="10" fill="#447744" />
      <ellipse cx="70" cy="42" rx="12" ry="6" fill="#447744" />
      <polygon points="80,40 92,42 80,44" fill="#447744" />
      <circle cx="73" cy="39" r="2" fill="#ffff00" />
      <path d="M82,42 L84,40 L86,42 L88,40 L90,42" fill="none" stroke="#447744" strokeWidth="1.5" />
      <rect x="26" y="52" width="4" height="8" rx="1" fill="#447744" />
      <rect x="34" y="52" width="4" height="8" rx="1" fill="#447744" />
      <rect x="52" y="52" width="4" height="8" rx="1" fill="#447744" />
      <rect x="60" y="52" width="4" height="8" rx="1" fill="#447744" />
      <path d="M20,45 Q18,52 22,48" fill="#447744" />
    </>
  ),
  NEU005: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Raptor - dinosaur */}
      <ellipse cx="48" cy="40" rx="14" ry="10" fill="#668844" />
      <circle cx="62" cy="30" r="8" fill="#668844" />
      <polygon points="68,28 78,26 68,32" fill="#668844" />
      <circle cx="65" cy="28" r="2" fill="#ffff00" />
      <polygon points="68,28 72,24 72,32" fill="#556633" />
      <rect x="40" y="48" width="4" height="14" rx="1" fill="#668844" />
      <rect x="52" y="48" width="4" height="14" rx="1" fill="#668844" />
      <path d="M35,42 Q28,50 32,44" fill="#668844" />
      <polygon points="60,30 62,22 58,26" fill="#668844" />
    </>
  ),
  NEU006: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Shielded Recruit - shield bearer */}
      {humanoid(55, 48, '#777777', 0.9)}
      {shield(36, 42, '#aaaaaa', 1)}
      <rect x="32" y="36" width="8" height="2" fill="#cccccc" />
    </>
  ),
  NEU007: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Novice Explorer - adventurer with map */}
      {humanoid(45, 48, '#887744', 0.9)}
      <rect x="58" y="30" width="16" height="12" rx="1" fill="#ddcc88" />
      <line x1="60" y1="34" x2="72" y2="34" stroke="#886644" strokeWidth="0.5" />
      <line x1="60" y1="37" x2="72" y2="37" stroke="#886644" strokeWidth="0.5" />
      <line x1="66" y1="31" x2="66" y2="41" stroke="#886644" strokeWidth="0.5" />
      <circle cx="64" cy="35" r="1" fill="#cc3333" />
      <rect x="40" y="18" width="10" height="6" rx="2" fill="#887744" />
    </>
  ),
  NEU008: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Sunfury Protector - female guardian */}
      <circle cx="50" cy="25" r="7" fill="#cc8844" />
      <rect x="43" y="30" width="14" height="18" rx="2" fill="url(#goldGrad)" />
      <rect x="35" y="32" width="8" height="4" rx="2" fill="#cc8844" />
      <rect x="57" y="32" width="8" height="4" rx="2" fill="#cc8844" />
      <rect x="44" y="48" width="5" height="12" rx="2" fill="#cc8844" />
      <rect x="51" y="48" width="5" height="12" rx="2" fill="#cc8844" />
      {shield(32, 40, '#ffcc33', 0.7)}
      <circle cx="50" cy="14" r="4" fill="#ffdd44" opacity="0.3" />
    </>
  ),
  NEU009: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Iron Sentinel - iron golem */}
      {golem(50, 40, '#888888', 1.1)}
      <rect x="38" y="34" width="24" height="20" rx="4" fill="#666666" opacity="0.5" />
      <circle cx="44" cy="24" r="3" fill="#aaeeff" />
      <circle cx="56" cy="24" r="3" fill="#aaeeff" />
    </>
  ),
  NEU010: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Woodland Defender - forest guard */}
      {humanoid(50, 48, '#558833', 1)}
      {shield(34, 42, '#447722', 0.8)}
      <rect x="62" y="30" width="3" height="20" rx="1" fill="#6B4226" />
      <polygon points="63.5,28 58,22 69,22" fill="#44aa22" />
    </>
  ),
  NEU011: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Harvest Golem - scarecrow-robot */}
      <circle cx="50" cy="24" r="8" fill="#cc9944" />
      <rect x="43" y="30" width="14" height="18" rx="2" fill="#887744" />
      <line x1="43" y1="34" x2="28" y2="28" stroke="#6B4226" strokeWidth="3" />
      <line x1="57" y1="34" x2="72" y2="28" stroke="#6B4226" strokeWidth="3" />
      <rect x="44" y="48" width="5" height="12" rx="1" fill="#6B4226" />
      <rect x="51" y="48" width="5" height="12" rx="1" fill="#6B4226" />
      <circle cx="46" cy="22" r="3" fill="#ffaa00" />
      <circle cx="54" cy="22" r="3" fill="#ffaa00" />
      <path d="M45,28 Q50,32 55,28" fill="none" stroke="#6B4226" strokeWidth="1.5" />
      {gear(50, 40, '#888888', 0.3)}
    </>
  ),
  NEU012: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Jungle Panther - big cat */}
      <ellipse cx="45" cy="42" rx="18" ry="10" fill="#222222" />
      <circle cx="64" cy="35" r="7" fill="#222222" />
      <polygon points="60,28 57,22 63,28" fill="#222222" />
      <polygon points="66,28 63,22 69,28" fill="#222222" />
      <circle cx="62" cy="33" r="2" fill="#44ff44" />
      <circle cx="67" cy="33" r="2" fill="#44ff44" />
      <rect x="30" y="50" width="3" height="12" rx="1" fill="#222222" />
      <rect x="38" y="50" width="3" height="12" rx="1" fill="#222222" />
      <rect x="52" y="50" width="3" height="12" rx="1" fill="#222222" />
      <rect x="58" y="50" width="3" height="12" rx="1" fill="#222222" />
      <path d="M28,42 Q20,38 22,44" fill="#222222" />
    </>
  ),
  NEU013: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Scarlet Crusader - red knight */}
      {knight(50, 48, '#cc3333', 1)}
      {sword(66, 42, '#cccccc', '#cc3333', 0.7, -25)}
      <rect x="44" y="36" width="12" height="3" fill="#ffcc33" />
    </>
  ),
  NEU014: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Razorfen Hunter - boar rider */}
      {mountedFigure(50, 40, '#887744', '#665533', 1)}
      <polygon points="64,0 58,-4 58,4" fill="#665533" />
      <polygon points="64,2 58,-2 58,6" fill="#665533" />
      <rect x="55" y="28" width="3" height="16" rx="1" fill="#6B4226" />
      <polygon points="56.5,26 53,20 60,20" fill="#888888" />
    </>
  ),
  NEU015: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Chillwind Yeti - large yeti */}
      <circle cx="50" cy="24" r="12" fill="#bbbbcc" />
      <rect x="36" y="32" width="28" height="24" rx="5" fill="#aaaabb" />
      <rect x="26" y="34" width="10" height="8" rx="4" fill="#aaaabb" />
      <rect x="64" y="34" width="10" height="8" rx="4" fill="#aaaabb" />
      <rect x="38" y="56" width="8" height="12" rx="3" fill="#aaaabb" />
      <rect x="54" y="56" width="8" height="12" rx="3" fill="#aaaabb" />
      <circle cx="44" cy="22" r="3" fill="#ffffff" />
      <circle cx="56" cy="22" r="3" fill="#ffffff" />
      <circle cx="44" cy="22" r="1.5" fill="#222222" />
      <circle cx="56" cy="22" r="1.5" fill="#222222" />
      <path d="M45,28 Q50,32 55,28" fill="none" stroke="#888899" strokeWidth="1.5" />
    </>
  ),
  NEU016: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Oasis Snapjaw - turtle */}
      <ellipse cx="50" cy="45" rx="22" ry="14" fill="#447744" />
      <ellipse cx="50" cy="42" rx="18" ry="12" fill="#558855" />
      <polygon points="40,42 50,35 60,42 50,48" fill="#446644" />
      <circle cx="70" cy="42" r="6" fill="#447744" />
      <circle cx="73" cy="40" r="2" fill="#222222" />
      <rect x="32" y="55" width="5" height="6" rx="2" fill="#447744" />
      <rect x="42" y="56" width="5" height="6" rx="2" fill="#447744" />
      <rect x="55" y="56" width="5" height="6" rx="2" fill="#447744" />
      <rect x="64" y="55" width="5" height="6" rx="2" fill="#447744" />
    </>
  ),
  NEU017: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Stormwind Knight - mounted knight */}
      {mountedFigure(50, 40, '#4466aa', '#886633', 1)}
      {sword(62, 28, '#cccccc', '#4466aa', 0.7, -30)}
      <rect x="44" y="24" width="12" height="2" fill="#ffcc33" />
    </>
  ),
  NEU018: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Dark Iron Dwarf - dwarven warrior */}
      <circle cx="50" cy="30" r="10" fill="#885533" />
      <rect x="38" y="38" width="24" height="14" rx="3" fill="#555555" />
      <rect x="40" y="52" width="8" height="10" rx="3" fill="#885533" />
      <rect x="52" y="52" width="8" height="10" rx="3" fill="#885533" />
      <path d="M40,34 Q35,40 30,38" fill="#885533" />
      <path d="M60,34 Q65,40 70,38" fill="#885533" />
      <circle cx="46" cy="28" r="2" fill="#ff6600" />
      <circle cx="54" cy="28" r="2" fill="#ff6600" />
      <rect x="62" y="36" width="14" height="4" rx="1" fill="#888888" />
      <polygon points="76,36 80,38 76,40" fill="#888888" />
    </>
  ),
  NEU019: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Twilight Drake - purple dragon */}
      {dragon(46, 42, '#663399', '#9966cc', 1.3)}
      <ellipse cx="50" cy="65" rx="16" ry="4" fill="#663399" opacity="0.3" />
    </>
  ),
  NEU020: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Spellbreaker - mage with broken spell */}
      {humanoid(50, 48, '#aa7733', 1)}
      <circle cx="35" cy="30" r="8" fill="#9966cc" opacity="0.4" />
      <line x1="28" y1="24" x2="42" y2="36" stroke="#ff4444" strokeWidth="2" />
      <line x1="42" y1="24" x2="28" y2="36" stroke="#ff4444" strokeWidth="2" />
      {sword(66, 42, '#cccccc', '#aa7733', 0.6, -25)}
    </>
  ),
  NEU021: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Fen Creeper - swamp creature */}
      <ellipse cx="50" cy="65" rx="30" ry="8" fill="#334422" opacity="0.6" />
      <ellipse cx="50" cy="45" rx="16" ry="20" fill="#445533" />
      <circle cx="50" cy="28" r="10" fill="#445533" />
      <circle cx="45" cy="26" r="3" fill="#88ff00" />
      <circle cx="55" cy="26" r="3" fill="#88ff00" />
      <path d="M30,42 Q22,35 26,30" fill="#445533" />
      <path d="M70,42 Q78,35 74,30" fill="#445533" />
      <ellipse cx="40" cy="55" rx="3" ry="5" fill="#556644" opacity="0.6" />
      <ellipse cx="60" cy="58" rx="3" ry="4" fill="#556644" opacity="0.6" />
    </>
  ),
  NEU022: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Stranglethorn Tiger - striped tiger */}
      <ellipse cx="45" cy="42" rx="18" ry="10" fill="#cc8833" />
      <circle cx="64" cy="35" r="7" fill="#cc8833" />
      <polygon points="60,28 57,22 63,28" fill="#cc8833" />
      <polygon points="66,28 63,22 69,28" fill="#cc8833" />
      <circle cx="62" cy="33" r="2" fill="#ffff00" />
      <circle cx="67" cy="33" r="2" fill="#ffff00" />
      <rect x="34" y="36" width="3" height="5" rx="0.5" fill="#222222" />
      <rect x="40" y="38" width="3" height="4" rx="0.5" fill="#222222" />
      <rect x="46" y="36" width="3" height="5" rx="0.5" fill="#222222" />
      <rect x="52" y="38" width="3" height="4" rx="0.5" fill="#222222" />
      <rect x="30" y="50" width="3" height="12" rx="1" fill="#cc8833" />
      <rect x="38" y="50" width="3" height="12" rx="1" fill="#cc8833" />
      <rect x="52" y="50" width="3" height="12" rx="1" fill="#cc8833" />
      <rect x="58" y="50" width="3" height="12" rx="1" fill="#cc8833" />
      <path d="M28,42 Q20,40 22,44" fill="#cc8833" />
    </>
  ),
  NEU023: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Nightblade - assassin */}
      {humanoid(50, 48, '#333344', 1)}
      <rect x="44" y="24" width="12" height="3" rx="1" fill="#333344" />
      <circle cx="47" cy="28" r="2" fill="#ff4444" />
      <circle cx="53" cy="28" r="2" fill="#ff4444" />
      {sword(68, 42, '#888899', '#333344', 0.7, -20)}
      {sword(32, 42, '#888899', '#333344', 0.7, 20)}
    </>
  ),
  NEU024: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Azure Drake - blue dragon */}
      {dragon(46, 42, '#3366aa', '#5588cc', 1.3)}
      <circle cx="62" cy="36" r="2" fill="#88ccff" />
      <ellipse cx="50" cy="65" rx="16" ry="4" fill="#3366aa" opacity="0.3" />
    </>
  ),
  NEU025: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Stampeding Kodo - large beast */}
      <ellipse cx="45" cy="42" rx="22" ry="14" fill="#887755" />
      <circle cx="68" cy="32" r="10" fill="#887755" />
      <polygon points="72,26 78,18 76,28" fill="#887755" />
      <polygon points="66,26 60,18 64,28" fill="#887755" />
      <circle cx="72" cy="30" r="2" fill="#222222" />
      <rect x="28" y="54" width="6" height="14" rx="2" fill="#887755" />
      <rect x="38" y="54" width="6" height="14" rx="2" fill="#887755" />
      <rect x="50" y="54" width="6" height="14" rx="2" fill="#887755" />
      <rect x="60" y="54" width="6" height="14" rx="2" fill="#887755" />
    </>
  ),
  NEU026: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Boulderfist Ogre - large ogre */}
      <circle cx="50" cy="22" r="14" fill="#88774d" />
      <rect x="34" y="32" width="32" height="24" rx="5" fill="#88774d" />
      <rect x="22" y="34" width="12" height="10" rx="4" fill="#88774d" />
      <rect x="66" y="34" width="12" height="10" rx="4" fill="#88774d" />
      <rect x="36" y="56" width="10" height="14" rx="4" fill="#88774d" />
      <rect x="54" y="56" width="10" height="14" rx="4" fill="#88774d" />
      <circle cx="44" cy="20" r="3" fill="#ffffff" />
      <circle cx="56" cy="20" r="3" fill="#ffffff" />
      <circle cx="44" cy="20" r="1.5" fill="#222222" />
      <circle cx="56" cy="20" r="1.5" fill="#222222" />
      <path d="M44,28 Q50,33 56,28" fill="none" stroke="#665533" strokeWidth="2" />
    </>
  ),
  NEU027: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Sunwalker - holy knight */}
      {knight(50, 48, '#cc9933', 1.05)}
      {shield(34, 42, '#ffcc33', 0.8)}
      <circle cx="50" cy="10" r="8" fill="#ffdd44" opacity="0.25" />
      <circle cx="50" cy="10" r="4" fill="#ffdd44" opacity="0.4" />
    </>
  ),
  NEU028: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Argent Commander - charging knight */}
      {knight(46, 46, '#aa8833', 1.05)}
      {sword(66, 36, '#cccccc', '#aa8833', 0.8, -40)}
      <line x1="46" y1="60" x2="30" y2="60" stroke="#aa8833" strokeWidth="2" opacity="0.4" />
      <line x1="46" y1="56" x2="26" y2="56" stroke="#aa8833" strokeWidth="1.5" opacity="0.3" />
      <line x1="46" y1="64" x2="28" y2="64" stroke="#aa8833" strokeWidth="1.5" opacity="0.3" />
    </>
  ),
  NEU029: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Reckless Rocketeer - rocket rider */}
      {humanoid(50, 44, '#aa5533', 0.9)}
      <rect x="38" y="40" width="6" height="20" rx="2" fill="#888888" />
      <rect x="56" y="40" width="6" height="20" rx="2" fill="#888888" />
      <ellipse cx="41" cy="62" rx="4" ry="6" fill="#ff6600" opacity="0.7" />
      <ellipse cx="59" cy="62" rx="4" ry="6" fill="#ff6600" opacity="0.7" />
      <ellipse cx="41" cy="66" rx="3" ry="4" fill="#ffaa00" opacity="0.5" />
      <ellipse cx="59" cy="66" rx="3" ry="4" fill="#ffaa00" opacity="0.5" />
    </>
  ),
  NEU030: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Priestess of Elune - elf priestess */}
      <circle cx="50" cy="22" r="7" fill="#aabbcc" />
      <polygon points="48,16 46,10 50,14" fill="#aabbcc" />
      <polygon points="52,16 54,10 50,14" fill="#aabbcc" />
      <rect x="43" y="28" width="14" height="22" rx="3" fill="#6644aa" />
      <rect x="44" y="50" width="5" height="12" rx="2" fill="#6644aa" />
      <rect x="51" y="50" width="5" height="12" rx="2" fill="#6644aa" />
      <circle cx="50" cy="10" r="5" fill="#aaaaee" opacity="0.2" />
      <circle cx="50" cy="10" r="3" fill="#ccccff" opacity="0.3" />
      <circle cx="35" cy="36" r="4" fill="#aaaaee" opacity="0.2" />
      <circle cx="65" cy="34" r="4" fill="#aaaaee" opacity="0.2" />
    </>
  ),
  NEU031: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* War Golem - large golem */}
      {golem(50, 38, '#777777', 1.3)}
      <rect x="36" y="28" width="28" height="24" rx="4" fill="#666666" opacity="0.5" />
      <circle cx="42" cy="20" r="4" fill="#ff4444" />
      <circle cx="58" cy="20" r="4" fill="#ff4444" />
    </>
  ),
  NEU032: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Guardian of Kings - armored angel */}
      {knight(50, 48, '#ccaa44', 1.05)}
      <path d="M35,26 Q25,8 38,22" fill="#ffffff" opacity="0.4" />
      <path d="M65,26 Q75,8 62,22" fill="#ffffff" opacity="0.4" />
      <path d="M32,30 Q18,12 36,26" fill="#ffffff" opacity="0.3" />
      <path d="M68,30 Q82,12 64,26" fill="#ffffff" opacity="0.3" />
      {shield(50, 42, '#ffcc33', 0.7)}
      <circle cx="50" cy="10" r="5" fill="url(#holyGrad)" opacity="0.3" />
    </>
  ),
  NEU033: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Stormwind Champion - banner knight */}
      {knight(50, 48, '#4466aa', 1.05)}
      <rect x="64" y="10" width="2" height="40" fill="#6B4226" />
      <rect x="66" y="10" width="14" height="10" rx="1" fill="#3355aa" />
      <polygon points="80,15 76,20 80,20" fill="#3355aa" />
      <rect x="68" y="12" width="6" height="2" fill="#ffcc33" />
    </>
  ),
  NEU034: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ravenholdt Assassin - shadowy rogue */}
      {humanoid(50, 48, '#2a2a3a', 1)}
      <rect x="42" y="22" width="16" height="5" rx="2" fill="#2a2a3a" />
      <circle cx="47" cy="28" r="2" fill="#882222" />
      <circle cx="53" cy="28" r="2" fill="#882222" />
      {sword(70, 42, '#555566', '#2a2a3a', 0.65, -15)}
      {sword(30, 42, '#555566', '#2a2a3a', 0.65, 15)}
      <ellipse cx="50" cy="68" rx="15" ry="4" fill="url(#shadowGrad)" opacity="0.4" />
    </>
  ),
  NEU035: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ironclad Behemoth - armored beast */}
      <ellipse cx="48" cy="42" rx="24" ry="14" fill="#666666" />
      <circle cx="70" cy="34" r="10" fill="#777777" />
      <polygon points="74,28 80,20 78,30" fill="#888888" />
      <circle cx="74" cy="32" r="2" fill="#ff4444" />
      <rect x="28" y="54" width="7" height="14" rx="3" fill="#666666" />
      <rect x="40" y="54" width="7" height="14" rx="3" fill="#666666" />
      <rect x="52" y="54" width="7" height="14" rx="3" fill="#666666" />
      <rect x="62" y="54" width="7" height="14" rx="3" fill="#666666" />
      <rect x="30" y="36" width="36" height="3" fill="#888888" opacity="0.6" />
      <rect x="32" y="46" width="32" height="3" fill="#888888" opacity="0.6" />
    </>
  ),
  NEU036: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Force of Nature - tree spirits */}
      {tree(25, 58, '#5a3e0a', '#33aa22', 0.8)}
      <circle cx="22" cy="42" r="2" fill="#88ff88" />
      <circle cx="28" cy="40" r="2" fill="#88ff88" />
      {tree(50, 55, '#5a3e0a', '#44bb33', 0.9)}
      <circle cx="47" cy="38" r="2" fill="#88ff88" />
      <circle cx="53" cy="36" r="2" fill="#88ff88" />
      {tree(75, 58, '#5a3e0a', '#33aa22', 0.8)}
      <circle cx="72" cy="42" r="2" fill="#88ff88" />
      <circle cx="78" cy="40" r="2" fill="#88ff88" />
    </>
  ),
  NEU037: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Alexstrasza's Champion - dragon knight */}
      {knight(50, 48, '#aa3333', 1)}
      <path d="M34,28 Q22,12 36,24" fill="#cc4444" opacity="0.6" />
      <path d="M66,28 Q78,12 64,24" fill="#cc4444" opacity="0.6" />
      {sword(68, 40, '#cccccc', '#aa3333', 0.7, -25)}
      <circle cx="50" cy="40" r="3" fill="#ff4444" opacity="0.4" />
    </>
  ),
  NEU038: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Mountain Giant - huge stone giant */}
      {golem(50, 36, '#887766', 1.5)}
      <rect x="28" y="20" width="44" height="30" rx="6" fill="#776655" opacity="0.5" />
      <circle cx="40" cy="16" r="4" fill="#aaaaaa" opacity="0.6" />
      <circle cx="60" cy="16" r="4" fill="#aaaaaa" opacity="0.6" />
      <ellipse cx="50" cy="72" rx="24" ry="5" fill="#555544" opacity="0.3" />
    </>
  ),
  NEU039: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Windfury Harpy - bird woman */}
      <circle cx="50" cy="28" r="7" fill="#aa88cc" />
      <ellipse cx="50" cy="42" rx="8" ry="12" fill="#9977bb" />
      <path d="M42,32 Q25,18 30,38 Q34,42 42,38" fill="#bb99dd" opacity="0.7" />
      <path d="M58,32 Q75,18 70,38 Q66,42 58,38" fill="#bb99dd" opacity="0.7" />
      <circle cx="47" cy="26" r="2" fill="#ffffff" />
      <circle cx="53" cy="26" r="2" fill="#ffffff" />
      <rect x="46" y="54" width="3" height="8" rx="1" fill="#887799" />
      <rect x="51" y="54" width="3" height="8" rx="1" fill="#887799" />
      <polygon points="50,32 48,35 52,35" fill="#ddaa44" />
    </>
  ),
  NEU040: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Young Dragonhawk - small hawk */}
      <ellipse cx="50" cy="40" rx="8" ry="5" fill="#cc5533" />
      <circle cx="58" cy="36" r="4" fill="#cc5533" />
      <polygon points="62,35 68,34 62,37" fill="#ddaa33" />
      <circle cx="60" cy="35" r="1.5" fill="#ffff00" />
      <path d="M46,36 Q32,22 40,38" fill="#dd6644" opacity="0.7" />
      <path d="M54,36 Q68,22 60,38" fill="#dd6644" opacity="0.7" />
      <path d="M44,42 Q36,28 42,40" fill="#cc5533" opacity="0.5" />
      <path d="M56,42 Q64,28 58,40" fill="#cc5533" opacity="0.5" />
      <path d="M46,44 Q44,52 48,48" fill="#cc5533" />
    </>
  ),
  NEU041: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Loot Hoarder - goblin with treasure */}
      <circle cx="50" cy="30" r="8" fill="#55aa44" />
      <circle cx="46" cy="28" r="2" fill="#ffff00" />
      <circle cx="54" cy="28" r="2" fill="#ffff00" />
      <polygon points="45,22 43,16 48,20" fill="#55aa44" />
      <polygon points="55,22 57,16 52,20" fill="#55aa44" />
      <rect x="44" y="36" width="12" height="12" rx="2" fill="#55aa44" />
      <rect x="46" y="48" width="4" height="8" rx="1" fill="#55aa44" />
      <rect x="50" y="48" width="4" height="8" rx="1" fill="#55aa44" />
      <rect x="58" y="38" width="14" height="10" rx="3" fill="#cc8800" />
      <rect x="58" y="36" width="14" height="3" rx="1" fill="#ddaa22" />
      <circle cx="62" cy="42" r="2" fill="#ffdd00" />
      <circle cx="68" cy="44" r="1.5" fill="#ffdd00" />
    </>
  ),
  NEU042: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Dire Wolf Alpha - wolf */}
      {wolf(48, 42, '#555555', 1.15)}
      <circle cx="66" cy="35" r="2.5" fill="#ff4444" />
    </>
  ),
  NEU043: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Unstable Ghoul - undead */}
      {humanoid(50, 48, '#668855', 1)}
      <circle cx="46" cy="28" r="2.5" fill="#aaffaa" />
      <circle cx="54" cy="28" r="2.5" fill="#aaffaa" />
      <path d="M44,34 Q50,38 56,34" fill="none" stroke="#445533" strokeWidth="1.5" />
      <rect x="42" y="36" width="3" height="4" fill="#668855" opacity="0.5" transform="rotate(10 43 38)" />
      <rect x="55" y="36" width="3" height="4" fill="#668855" opacity="0.5" transform="rotate(-10 56 38)" />
      <circle cx="50" cy="48" r="6" fill="#aaffaa" opacity="0.2" />
    </>
  ),
  NEU044: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Shattered Sun Cleric - glowing cleric */}
      {humanoid(50, 48, '#ccaa44', 0.95)}
      <circle cx="50" cy="20" r="8" fill="url(#holyGrad)" opacity="0.3" />
      <circle cx="50" cy="20" r="4" fill="#ffdd44" opacity="0.4" />
      <rect x="44" y="36" width="12" height="3" fill="#ffcc33" opacity="0.5" />
    </>
  ),
  NEU045: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ironfur Grizzly - bear */}
      {bear(48, 42, '#885533', 1.1)}
    </>
  ),
  NEU046: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Earthen Ring Farseer - shaman */}
      {humanoid(50, 48, '#886644', 1)}
      <circle cx="36" cy="32" r="5" fill="#44aacc" opacity="0.4" />
      <circle cx="64" cy="30" r="5" fill="#44aacc" opacity="0.4" />
      <circle cx="50" cy="16" r="6" fill="#44ddff" opacity="0.25" />
      <polygon points="44,22 42,16 48,20" fill="#886644" />
      <polygon points="56,22 58,16 52,20" fill="#886644" />
      <rect x="60" y="30" width="3" height="18" rx="1" fill="#6B4226" />
      <circle cx="61.5" cy="28" r="3" fill="#44ddff" opacity="0.5" />
    </>
  ),
  NEU047: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Silver Hand Knight - knight with squire */}
      {knight(40, 48, '#aaaaaa', 1)}
      {sword(56, 40, '#cccccc', '#888888', 0.7, -25)}
      {knight(72, 52, '#999999', 0.55)}
    </>
  ),
  NEU048: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Defender of Argus - defender with shield */}
      {humanoid(50, 48, '#5566aa', 1.05)}
      {shield(32, 42, '#ffcc33', 0.9)}
      {shield(68, 42, '#ffcc33', 0.9)}
      <circle cx="50" cy="16" r="5" fill="#ffdd44" opacity="0.2" />
    </>
  ),
  NEU049: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Faceless Butcher - horror creature */}
      <ellipse cx="50" cy="38" rx="14" ry="18" fill="#443355" />
      <circle cx="50" cy="24" r="10" fill="#443355" />
      <path d="M42,38 Q36,28 30,35" fill="#443355" />
      <path d="M58,38 Q64,28 70,35" fill="#443355" />
      <ellipse cx="44" cy="22" rx="2" ry="3" fill="#88ff88" />
      <ellipse cx="56" cy="22" rx="2" ry="3" fill="#88ff88" />
      <path d="M46,30 Q50,34 54,30" fill="#222233" />
      <rect x="44" y="56" width="5" height="12" rx="2" fill="#443355" />
      <rect x="51" y="56" width="5" height="12" rx="2" fill="#443355" />
    </>
  ),
  NEU050: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Abomination - stitched monster */}
      <circle cx="50" cy="22" r="10" fill="#668844" />
      <ellipse cx="50" cy="44" rx="18" ry="16" fill="#557733" />
      <rect x="26" y="32" width="12" height="8" rx="3" fill="#668844" />
      <rect x="62" y="32" width="12" height="8" rx="3" fill="#668844" />
      <rect x="40" y="58" width="8" height="12" rx="3" fill="#557733" />
      <rect x="52" y="58" width="8" height="12" rx="3" fill="#557733" />
      <circle cx="45" cy="20" r="3" fill="#ffff00" />
      <circle cx="55" cy="20" r="3" fill="#ffff00" />
      <path d="M44,28 Q50,32 56,28" fill="none" stroke="#444422" strokeWidth="1.5" />
      <line x1="38" y1="38" x2="62" y2="38" stroke="#886644" strokeWidth="1" strokeDasharray="3,2" />
      <line x1="50" y1="30" x2="50" y2="58" stroke="#886644" strokeWidth="1" strokeDasharray="3,2" />
    </>
  ),
  NEU051: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Spiteful Smith - blacksmith */}
      {humanoid(45, 48, '#884422', 1)}
      <rect x="60" y="25" width="16" height="10" rx="2" fill="#555555" />
      <rect x="68" y="20" width="4" height="15" rx="1" fill="#888888" />
      <rect x="62" y="38" width="4" height="16" rx="1" fill="#6B4226" />
      <ellipse cx="64" cy="56" rx="6" ry="3" fill="#555555" />
      {flames(68, 22, 0.4)}
    </>
  ),
  NEU052: () => (
    <>
      <defs>{neutralGradients}</defs>
      <defs>{andersGradients}</defs>
      {neutralBg}
      {/* Frost Elemental - ice being */}
      <ellipse cx="50" cy="50" rx="14" ry="10" fill="url(#iceGrad)" opacity="0.8" />
      <ellipse cx="50" cy="36" rx="10" ry="14" fill="url(#frostGrad)" opacity="0.7" />
      {iceCrystal(50, 18, '#aaeeff', 0.7)}
      <circle cx="45" cy="34" r="3" fill="#ffffff" opacity="0.7" />
      <circle cx="55" cy="34" r="3" fill="#ffffff" opacity="0.7" />
      {iceCrystal(35, 42, '#88ccff', 0.4)}
      {iceCrystal(65, 42, '#88ccff', 0.4)}
    </>
  ),
  NEU053: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Baron Rivendare - undead lord */}
      {knight(50, 46, '#445544', 1.05)}
      <circle cx="46" cy="26" r="2" fill="#44ff44" />
      <circle cx="54" cy="26" r="2" fill="#44ff44" />
      {sword(70, 40, '#668866', '#445544', 0.8, -20)}
      <circle cx="50" cy="10" r="5" fill="#44ff44" opacity="0.15" />
      <ellipse cx="50" cy="68" rx="14" ry="4" fill="#334433" opacity="0.4" />
    </>
  ),
  NEU054: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Sylvanas Windrunner - dark elf archer */}
      {archer(48, 48, '#5544aa', '#663388', 1)}
      <polygon points="46,24 44,18 48,22" fill="#5544aa" />
      <polygon points="52,24 54,18 50,22" fill="#5544aa" />
      <circle cx="46" cy="28" r="2" fill="#ff4444" />
      <circle cx="54" cy="28" r="2" fill="#ff4444" />
      <ellipse cx="50" cy="68" rx="12" ry="4" fill="url(#shadowGrad)" opacity="0.4" />
    </>
  ),
  NEU055: () => (
    <>
      <defs>{neutralGradients}</defs>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Ragnaros the Firelord - fire lord */}
      <ellipse cx="50" cy="62" rx="30" ry="10" fill="#882200" />
      <ellipse cx="50" cy="42" rx="18" ry="22" fill="url(#fireGrad)" opacity="0.9" />
      <circle cx="50" cy="24" r="12" fill="#cc3300" />
      {flames(50, 8, 1.5)}
      {flames(38, 14, 1)}
      {flames(62, 14, 1)}
      <circle cx="44" cy="22" r="3" fill="#ffff00" />
      <circle cx="56" cy="22" r="3" fill="#ffff00" />
      <rect x="68" y="28" width="20" height="5" rx="2" fill="#ff6600" />
      {flames(90, 28, 0.8)}
    </>
  ),
  NEU056: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Cairne Bloodhoof - tauren chief */}
      <circle cx="50" cy="22" r="12" fill="#886644" />
      <polygon points="36,18 28,8 38,16" fill="#cccccc" />
      <polygon points="64,18 72,8 62,16" fill="#cccccc" />
      <rect x="36" y="32" width="28" height="24" rx="5" fill="#886644" />
      <rect x="26" y="34" width="10" height="10" rx="4" fill="#886644" />
      <rect x="64" y="34" width="10" height="10" rx="4" fill="#886644" />
      <rect x="38" y="56" width="8" height="14" rx="3" fill="#886644" />
      <rect x="54" y="56" width="8" height="14" rx="3" fill="#886644" />
      <circle cx="44" cy="22" r="3" fill="#ffffff" />
      <circle cx="56" cy="22" r="3" fill="#ffffff" />
      <circle cx="50" cy="26" r="4" fill="#775533" />
      <rect x="72" y="26" width="4" height="28" rx="1" fill="#6B4226" />
      <polygon points="74,24 70,16 78,16" fill="#888888" />
    </>
  ),
  NEU057: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ysera - dream dragon */}
      {dragon(46, 40, '#44aa66', '#66cc88', 1.6)}
      <circle cx="66" cy="32" r="3" fill="#88ff88" />
      <ellipse cx="50" cy="68" rx="20" ry="5" fill="#44aa66" opacity="0.2" />
      <circle cx="30" cy="20" r="3" fill="#88ffaa" opacity="0.3" />
      <circle cx="70" cy="18" r="2" fill="#88ffaa" opacity="0.3" />
      <circle cx="50" cy="15" r="2" fill="#aaffcc" opacity="0.25" />
    </>
  ),
  NEU058: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Acolyte of Pain - robed figure */}
      <circle cx="50" cy="26" r="7" fill="#887766" />
      <polygon points="50,20 38,60 62,60" fill="#554433" />
      <rect x="36" y="32" width="8" height="4" rx="2" fill="#554433" />
      <rect x="56" y="32" width="8" height="4" rx="2" fill="#554433" />
      <circle cx="47" cy="24" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="53" cy="24" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="50" cy="42" r="4" fill="#882222" opacity="0.3" />
    </>
  ),
  NEU059: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Acidic Swamp Ooze - green ooze */}
      <ellipse cx="50" cy="55" rx="28" ry="12" fill="#44aa22" opacity="0.7" />
      <ellipse cx="50" cy="45" rx="20" ry="15" fill="#55cc33" opacity="0.8" />
      <ellipse cx="42" cy="38" rx="8" ry="10" fill="#66dd44" opacity="0.7" />
      <ellipse cx="58" cy="40" rx="8" ry="8" fill="#66dd44" opacity="0.7" />
      <circle cx="44" cy="36" r="3" fill="#ffffff" opacity="0.5" />
      <circle cx="56" cy="38" r="3" fill="#ffffff" opacity="0.5" />
      <circle cx="44" cy="36" r="1.5" fill="#222222" />
      <circle cx="56" cy="38" r="1.5" fill="#222222" />
      <ellipse cx="35" cy="58" rx="5" ry="3" fill="#44aa22" opacity="0.4" />
      <ellipse cx="65" cy="56" rx="4" ry="3" fill="#44aa22" opacity="0.4" />
    </>
  ),
  NEU060: () => (
    <>
      <defs>{neutralGradients}</defs>
      <defs>{jimmyGradients}</defs>
      <rect x="0" y="0" width="100" height="80" fill="#0a0508" />
      {/* Deathwing - massive dragon */}
      <ellipse cx="50" cy="42" rx="24" ry="14" fill="#333333" />
      <circle cx="50" cy="26" r="12" fill="#333333" />
      <polygon points="55,22 62,18 55,26" fill="#333333" />
      <path d="M30,34 Q10,8 26,30" fill="#444444" opacity="0.8" />
      <path d="M70,34 Q90,8 74,30" fill="#444444" opacity="0.8" />
      <path d="M26,38 Q5,14 24,34" fill="#333333" opacity="0.6" />
      <path d="M74,38 Q95,14 76,34" fill="#333333" opacity="0.6" />
      <circle cx="44" cy="24" r="3" fill="#ff4400" />
      <circle cx="56" cy="24" r="3" fill="#ff4400" />
      <path d="M44,32 Q50,36 56,32" fill="#ff4400" opacity="0.6" />
      {flames(50, 58, 0.6)}
      {flames(40, 60, 0.4)}
      {flames(60, 60, 0.4)}
      <ellipse cx="50" cy="70" rx="30" ry="6" fill="#ff4400" opacity="0.15" />
    </>
  ),

  // ==================== TOKENS ====================
  NEU_TOKEN_01: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Damaged Golem - broken golem */}
      {golem(50, 42, '#777766', 0.9)}
      <line x1="40" y1="28" x2="48" y2="40" stroke="#333322" strokeWidth="1.5" />
      <line x1="52" y1="24" x2="58" y2="36" stroke="#333322" strokeWidth="1.5" />
      <circle cx="44" cy="26" r="2" fill="#ffaa00" opacity="0.5" />
      <circle cx="56" cy="26" r="2" fill="#555544" />
      <rect x="48" y="38" width="8" height="4" fill="#333322" opacity="0.3" />
    </>
  ),
  NEU_TOKEN_02: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Boar - charging boar */}
      <ellipse cx="45" cy="42" rx="16" ry="10" fill="#885544" />
      <circle cx="62" cy="38" r="7" fill="#885544" />
      <polygon points="66,34 72,28 68,36" fill="#cccccc" />
      <polygon points="64,34 70,28 66,36" fill="#cccccc" />
      <circle cx="64" cy="36" r="1.5" fill="#222222" />
      <rect x="32" y="50" width="4" height="10" rx="1" fill="#885544" />
      <rect x="40" y="50" width="4" height="10" rx="1" fill="#885544" />
      <rect x="50" y="50" width="4" height="10" rx="1" fill="#885544" />
      <rect x="56" y="50" width="4" height="10" rx="1" fill="#885544" />
      <path d="M30,42 Q24,40 26,44" fill="#885544" />
    </>
  ),
  NEU_TOKEN_04: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Baine Bloodhoof - young tauren */}
      <circle cx="50" cy="26" r="10" fill="#886644" />
      <polygon points="38,22 32,14 40,20" fill="#bbbbbb" />
      <polygon points="62,22 68,14 60,20" fill="#bbbbbb" />
      <rect x="38" y="34" width="24" height="20" rx="4" fill="#886644" />
      <rect x="30" y="36" width="8" height="8" rx="3" fill="#886644" />
      <rect x="62" y="36" width="8" height="8" rx="3" fill="#886644" />
      <rect x="40" y="54" width="7" height="12" rx="3" fill="#886644" />
      <rect x="53" y="54" width="7" height="12" rx="3" fill="#886644" />
      <circle cx="45" cy="24" r="2.5" fill="#ffffff" />
      <circle cx="55" cy="24" r="2.5" fill="#ffffff" />
      <circle cx="50" cy="28" r="3" fill="#775533" />
    </>
  ),

  // ==================== JIMMY LORE EXPANSION ====================
  JIM_BOND_01: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Otto, Loyal Otter - otter companion */}
      <ellipse cx="50" cy="42" rx="14" ry="8" fill="#8B5E3C" />
      <circle cx="62" cy="36" r="6" fill="#8B5E3C" />
      <circle cx="65" cy="34" r="2" fill="#ffffff" />
      <circle cx="65" cy="34" r="1" fill="#331100" />
      <ellipse cx="64" cy="38" rx="2" ry="1" fill="#553322" />
      <path d="M36,44 Q28,50 32,46" fill="#8B5E3C" />
      <rect x="40" y="48" width="4" height="6" rx="1" fill="#8B5E3C" />
      <rect x="52" y="48" width="4" height="6" rx="1" fill="#8B5E3C" />
      {flames(50, 20, 0.4)}
    </>
  ),
  JIM_BOND_02: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Bella, Snow Guardian - large guardian companion */}
      {bear(48, 42, '#ddeeff', 0.9)}
      <circle cx="62" cy="34" r="2" fill="#88ccff" />
      {flames(28, 22, 0.5)}
      {flames(70, 24, 0.5)}
      <ellipse cx="48" cy="60" rx="16" ry="4" fill="#ff4400" opacity="0.2" />
    </>
  ),
  JIM_LOC01: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Gavalon Forge - fiery forge building */}
      <rect x="25" y="35" width="50" height="35" rx="3" fill="#553311" />
      <polygon points="25,35 50,12 75,35" fill="#773322" />
      <rect x="40" y="50" width="20" height="20" rx="2" fill="#331100" />
      <rect x="42" y="52" width="16" height="16" fill="url(#lavaGrad)" opacity="0.7" />
      {flames(50, 30, 0.8)}
      {flames(42, 35, 0.5)}
      {flames(58, 35, 0.5)}
      <rect x="48" y="8" width="4" height="14" fill="#553311" />
      <ellipse cx="50" cy="6" rx="6" ry="3" fill="#ff4400" opacity="0.5" />
    </>
  ),

  // ==================== TALA LORE EXPANSION ====================
  TAL_BOND_01: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Snowball, Arctic Scout - small white arctic animal */}
      <ellipse cx="50" cy="44" rx="12" ry="8" fill="#eef8ff" />
      <circle cx="60" cy="38" r="6" fill="#eef8ff" />
      <circle cx="63" cy="36" r="2" fill="#224466" />
      <ellipse cx="62" cy="40" rx="2" ry="1" fill="#335566" />
      <polygon points="57,34 55,28 60,34" fill="#eef8ff" />
      <polygon points="63,34 65,28 66,34" fill="#eef8ff" />
      <rect x="42" y="50" width="4" height="5" rx="1" fill="#dde8ee" />
      <rect x="54" y="50" width="4" height="5" rx="1" fill="#dde8ee" />
      <circle cx="35" cy="40" r="2" fill="#88ff88" opacity="0.3" />
    </>
  ),
  TAL_BOND_02: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Tala's Ice Orb - glowing ice/nature orb artifact */}
      <circle cx="50" cy="38" r="18" fill="url(#healGrad)" opacity="0.15" />
      <circle cx="50" cy="38" r="14" fill="#88ccff" opacity="0.3" />
      <circle cx="50" cy="38" r="10" fill="#aaeeff" opacity="0.5" />
      <circle cx="50" cy="38" r="5" fill="#ffffff" opacity="0.7" />
      {iceCrystal(34, 28, '#88ddff', 0.4)}
      {iceCrystal(66, 28, '#88ddff', 0.4)}
      <circle cx="44" cy="32" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="56" cy="44" r="1.5" fill="#ffffff" opacity="0.5" />
    </>
  ),
  TAL_LOC01: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Everbloom Sanctuary - lush nature sanctuary */}
      {tree(30, 60, '#6B4226', '#44aa22', 0.9)}
      {tree(70, 60, '#6B4226', '#55bb33', 0.9)}
      <rect x="35" y="40" width="30" height="30" rx="4" fill="#337711" opacity="0.5" />
      <path d="M35,40 Q50,22 65,40" fill="#44aa22" />
      <circle cx="50" cy="32" r="4" fill="#88ff88" opacity="0.5" />
      <circle cx="42" cy="55" r="3" fill="#ff88aa" opacity="0.4" />
      <circle cx="58" cy="52" r="2" fill="#ffdd44" opacity="0.4" />
      <circle cx="50" cy="60" r="2.5" fill="#ff88aa" opacity="0.4" />
    </>
  ),
  TAL_ORRA_01: () => (
    <>
      <defs>{talaGradients}</defs>
      {natureBg}
      {/* Tala's Healing Bloom - glowing healing flower */}
      <path d="M50,68 Q50,40 50,35" stroke="#337711" strokeWidth="3" fill="none" />
      <ellipse cx="40" cy="50" rx="6" ry="3" fill="#44aa22" transform="rotate(-30 40 50)" />
      <ellipse cx="60" cy="48" rx="6" ry="3" fill="#44aa22" transform="rotate(20 60 48)" />
      <circle cx="50" cy="28" r="10" fill="#ff88aa" opacity="0.6" />
      <circle cx="50" cy="28" r="6" fill="url(#healGrad)" opacity="0.7" />
      <circle cx="50" cy="28" r="3" fill="#ffffff" opacity="0.8" />
      <ellipse cx="42" cy="24" rx="5" ry="7" fill="#ff88aa" opacity="0.4" />
      <ellipse cx="58" cy="24" rx="5" ry="7" fill="#ff88aa" opacity="0.4" />
      <ellipse cx="50" cy="18" rx="7" ry="5" fill="#ff88aa" opacity="0.4" />
    </>
  ),

  // ==================== DEREK LORE EXPANSION ====================
  DRK_BOND_01: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Sengo, Shadow Leopard - sleek dark cat */}
      <ellipse cx="48" cy="42" rx="16" ry="8" fill="#443366" />
      <circle cx="64" cy="36" r="6" fill="#443366" />
      <polygon points="60,30 58,22 63,30" fill="#443366" />
      <polygon points="66,30 68,22 70,30" fill="#443366" />
      <circle cx="62" cy="34" r="2" fill="#ffdd44" />
      <circle cx="67" cy="34" r="2" fill="#ffdd44" />
      <path d="M32,44 Q22,40 26,46" fill="#443366" />
      <rect x="40" y="48" width="3" height="8" rx="1" fill="#443366" />
      <rect x="48" y="48" width="3" height="8" rx="1" fill="#443366" />
      <rect x="56" y="48" width="3" height="8" rx="1" fill="#443366" />
      <rect x="62" y="48" width="3" height="8" rx="1" fill="#443366" />
      <circle cx="40" cy="40" r="1" fill="#ccaaff" opacity="0.3" />
      <circle cx="52" cy="38" r="1" fill="#ccaaff" opacity="0.3" />
    </>
  ),
  DRK_BOND_02: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Rosie, Bottlenose Scout - dolphin companion */}
      <ellipse cx="50" cy="40" rx="18" ry="8" fill="#6688aa" />
      <polygon points="68,38 80,40 68,44" fill="#5577aa" />
      <circle cx="35" cy="36" r="6" fill="#6688aa" />
      <polygon points="32,34 28,30 35,34" fill="#6688aa" />
      <circle cx="32" cy="35" r="2" fill="#ffffff" />
      <circle cx="32" cy="35" r="1" fill="#113355" />
      <path d="M45,34 Q50,26 55,34" fill="#5577aa" />
      <ellipse cx="50" cy="55" rx="20" ry="5" fill="#334466" opacity="0.3" />
    </>
  ),
  DRK_LOC01: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Riptide Reef Workshop - underwater workshop */}
      <rect x="0" y="50" width="100" height="30" fill="#1a2a3a" />
      <ellipse cx="50" cy="50" rx="45" ry="8" fill="#223344" opacity="0.6" />
      <rect x="30" y="30" width="40" height="30" rx="3" fill="#445566" />
      <rect x="25" y="28" width="50" height="4" rx="1" fill="#556677" />
      <rect x="38" y="40" width="10" height="18" rx="2" fill="#334455" />
      <rect x="54" y="36" width="8" height="8" rx="1" fill="#ffdd44" opacity="0.3" />
      {gear(72, 42, '#cc9900', 0.4)}
      <circle cx="20" cy="60" r="2" fill="#88ccff" opacity="0.3" />
      <circle cx="80" cy="55" r="3" fill="#88ccff" opacity="0.2" />
    </>
  ),
  DRK_ORRA_01: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Orra Overloader - overcharged energy device */}
      <rect x="38" y="28" width="24" height="28" rx="4" fill="url(#metalGrad)" />
      <circle cx="50" cy="42" r="8" fill="url(#sparkGrad)" opacity="0.7" />
      <circle cx="50" cy="42" r="4" fill="#ffffff" opacity="0.5" />
      <line x1="50" y1="28" x2="50" y2="18" stroke="#ffdd44" strokeWidth="2" />
      <line x1="38" y1="42" x2="28" y2="42" stroke="#ffdd44" strokeWidth="2" />
      <line x1="62" y1="42" x2="72" y2="42" stroke="#ffdd44" strokeWidth="2" />
      <circle cx="50" cy="16" r="3" fill="#ffee66" opacity="0.6" />
      <circle cx="26" cy="42" r="3" fill="#ffee66" opacity="0.6" />
      <circle cx="74" cy="42" r="3" fill="#ffee66" opacity="0.6" />
    </>
  ),
  DRK_ORRA_02: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Reef Tidecaller - water creature */}
      <ellipse cx="50" cy="45" rx="16" ry="12" fill="#3366aa" />
      <circle cx="50" cy="30" r="8" fill="#4477bb" />
      <circle cx="46" cy="28" r="2" fill="#aaddff" />
      <circle cx="54" cy="28" r="2" fill="#aaddff" />
      <path d="M42,35 Q50,40 58,35" fill="none" stroke="#88ccff" strokeWidth="1.5" />
      <path d="M34,50 Q28,42 32,38" fill="#3366aa" opacity="0.6" />
      <path d="M66,50 Q72,42 68,38" fill="#3366aa" opacity="0.6" />
      <ellipse cx="50" cy="62" rx="20" ry="4" fill="#223355" opacity="0.3" />
    </>
  ),
  DRK_LORE_01: () => (
    <>
      <defs>{derekGradients}</defs>
      {techBg}
      {/* Riptide Reef Guardian - reef guardian creature */}
      <ellipse cx="50" cy="48" rx="20" ry="12" fill="#2255aa" />
      <circle cx="50" cy="30" r="10" fill="#3366bb" />
      <circle cx="45" cy="28" r="3" fill="#aaddff" />
      <circle cx="55" cy="28" r="3" fill="#aaddff" />
      <path d="M30,42 Q22,34 26,28" fill="#2255aa" />
      <path d="M70,42 Q78,34 74,28" fill="#2255aa" />
      {shield(50, 50, '#4488cc', 0.7)}
      <ellipse cx="50" cy="65" rx="22" ry="5" fill="#112244" opacity="0.4" />
    </>
  ),

  // ==================== ANDERS LORE EXPANSION ====================
  AND_BOND_01: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frostfang - ice wolf companion */}
      {wolf(48, 42, '#aaddff', 1)}
      {iceCrystal(30, 25, '#88ccff', 0.4)}
      {iceCrystal(70, 30, '#aaeeff', 0.35)}
      <circle cx="62" cy="36" r="2" fill="#88eeff" />
      <ellipse cx="48" cy="58" rx="16" ry="4" fill="#224466" opacity="0.3" />
    </>
  ),
  AND_BOND_02: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Icelash - ice whip weapon */}
      <path d="M30,60 Q40,40 50,35 Q60,28 70,15" fill="none" stroke="url(#frostGrad)" strokeWidth="3" strokeLinecap="round" />
      <path d="M30,60 Q42,42 52,38 Q62,30 72,18" fill="none" stroke="#aaeeff" strokeWidth="1" opacity="0.5" />
      {iceCrystal(70, 14, '#88ccff', 0.5)}
      <circle cx="30" cy="60" r="4" fill="url(#iceGrad)" />
      <circle cx="50" cy="35" r="2" fill="#ffffff" opacity="0.6" />
      <circle cx="60" cy="24" r="1.5" fill="#ffffff" opacity="0.5" />
    </>
  ),
  AND_LOC01: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Aster Peak Rink - ice rink location */}
      <ellipse cx="50" cy="55" rx="38" ry="14" fill="url(#frostGrad)" opacity="0.3" />
      <ellipse cx="50" cy="55" rx="32" ry="10" fill="#aaeeff" opacity="0.2" />
      <polygon points="20,40 35,15 40,40" fill="#88aacc" />
      <polygon points="60,40 75,10 80,40" fill="#7799bb" />
      <rect x="35" y="42" width="30" height="3" rx="1" fill="#556688" opacity="0.5" />
      {iceCrystal(50, 30, '#aaeeff', 0.5)}
      <circle cx="40" cy="55" r="2" fill="#ffffff" opacity="0.3" />
      <circle cx="60" cy="54" r="2" fill="#ffffff" opacity="0.3" />
    </>
  ),
  AND_ORRA_01: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Frostcore Sentinel - ice construct */}
      {golem(50, 40, '#6699cc', 0.9)}
      {iceCrystal(50, 10, '#aaeeff', 0.6)}
      <rect x="38" y="34" width="24" height="16" rx="3" fill="url(#frostGrad)" opacity="0.3" />
      <circle cx="44" cy="24" r="3" fill="#aaeeff" />
      <circle cx="56" cy="24" r="3" fill="#aaeeff" />
      <ellipse cx="50" cy="62" rx="14" ry="4" fill="#224466" opacity="0.3" />
    </>
  ),

  // ==================== DES LORE EXPANSION ====================
  DES_COLLAR_01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dominion Handler - sinister figure with collar device */}
      {humanoid(50, 48, '#551188', 1)}
      <ellipse cx="50" cy="30" rx="12" ry="3" fill="#9933ff" opacity="0.4" />
      <circle cx="66" cy="38" r="5" fill="url(#darkOrraGrad)" opacity="0.5" />
      <circle cx="66" cy="38" r="2" fill="#ff3366" opacity="0.6" />
    </>
  ),
  DES_COLLAR_02: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Collar Drone - mechanical minion */}
      <circle cx="50" cy="35" r="10" fill="url(#shadowGrad2)" />
      <circle cx="50" cy="35" r="6" fill="#9933ff" opacity="0.3" />
      <circle cx="50" cy="35" r="3" fill="#ff3366" opacity="0.5" />
      <rect x="36" y="32" width="6" height="6" rx="1" fill="#7733cc" opacity="0.6" />
      <rect x="58" y="32" width="6" height="6" rx="1" fill="#7733cc" opacity="0.6" />
      <rect x="47" y="46" width="3" height="8" rx="1" fill="#551188" />
      <rect x="50" y="46" width="3" height="8" rx="1" fill="#551188" />
    </>
  ),
  DES_COLLAR_03: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Des Aster, Puppetmaster - villain boss with strings */}
      {humanoid(50, 48, '#7733cc', 1.1)}
      <line x1="40" y1="34" x2="20" y2="60" stroke="#9933ff" strokeWidth="0.8" opacity="0.6" />
      <line x1="60" y1="34" x2="80" y2="60" stroke="#9933ff" strokeWidth="0.8" opacity="0.6" />
      <line x1="45" y1="34" x2="30" y2="65" stroke="#cc66ff" strokeWidth="0.5" opacity="0.4" />
      <line x1="55" y1="34" x2="70" y2="65" stroke="#cc66ff" strokeWidth="0.5" opacity="0.4" />
      <circle cx="50" cy="18" r="8" fill="url(#voidGrad)" opacity="0.4" />
      <circle cx="46" cy="28" r="2.5" fill="#ff3366" />
      <circle cx="54" cy="28" r="2.5" fill="#ff3366" />
    </>
  ),
  DES_COLLAR_04: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dominion Recruiter - dark soldier */}
      {knight(50, 48, '#551188', 0.9)}
      <rect x="62" y="32" width="14" height="3" rx="1" fill="#9933ff" opacity="0.6" />
      <circle cx="78" cy="34" r="4" fill="url(#darkOrraGrad)" opacity="0.4" />
    </>
  ),
  DES_COLLAR_05: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Collar of Submission - dark collar artifact */}
      <ellipse cx="50" cy="38" rx="18" ry="10" fill="none" stroke="url(#darkOrraGrad)" strokeWidth="4" />
      <ellipse cx="50" cy="38" rx="14" ry="7" fill="none" stroke="#9933ff" strokeWidth="1.5" opacity="0.5" />
      <circle cx="50" cy="28" r="4" fill="#ff3366" opacity="0.7" />
      <circle cx="50" cy="28" r="2" fill="#ffffff" opacity="0.3" />
      <circle cx="34" cy="42" r="2" fill="#9933ff" opacity="0.4" />
      <circle cx="66" cy="42" r="2" fill="#9933ff" opacity="0.4" />
    </>
  ),
  DES_LOC01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dominion Outpost - dark fortress */}
      <rect x="30" y="35" width="40" height="35" rx="2" fill="#2a0044" />
      <polygon points="30,35 50,15 70,35" fill="#3a0066" />
      <rect x="22" y="30" width="10" height="40" rx="1" fill="#2a0044" />
      <rect x="68" y="30" width="10" height="40" rx="1" fill="#2a0044" />
      <polygon points="22,30 27,18 32,30" fill="#3a0066" />
      <polygon points="68,30 73,18 78,30" fill="#3a0066" />
      <rect x="44" y="50" width="12" height="20" rx="2" fill="#220033" />
      <circle cx="50" cy="42" r="4" fill="#9933ff" opacity="0.5" />
      <circle cx="27" cy="26" r="2" fill="#ff3366" opacity="0.4" />
      <circle cx="73" cy="26" r="2" fill="#ff3366" opacity="0.4" />
    </>
  ),
  DES_ORRA_01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Polara Core - void energy source */}
      <circle cx="50" cy="38" r="20" fill="url(#voidGrad)" opacity="0.3" />
      <circle cx="50" cy="38" r="14" fill="url(#darkOrraGrad)" opacity="0.5" />
      <circle cx="50" cy="38" r="8" fill="#9933ff" opacity="0.6" />
      <circle cx="50" cy="38" r="4" fill="#ffffff" opacity="0.3" />
      <line x1="50" y1="18" x2="50" y2="10" stroke="#cc66ff" strokeWidth="1" opacity="0.5" />
      <line x1="30" y1="38" x2="22" y2="38" stroke="#cc66ff" strokeWidth="1" opacity="0.5" />
      <line x1="70" y1="38" x2="78" y2="38" stroke="#cc66ff" strokeWidth="1" opacity="0.5" />
      <line x1="36" y1="24" x2="30" y2="18" stroke="#cc66ff" strokeWidth="1" opacity="0.4" />
      <line x1="64" y1="24" x2="70" y2="18" stroke="#cc66ff" strokeWidth="1" opacity="0.4" />
    </>
  ),
  DES_NEW_01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dark Pact - swirling dark energy spell */}
      <circle cx="50" cy="38" r="18" fill="url(#shadowGrad2)" opacity="0.4" />
      <path d="M35,38 Q42,20 50,38 Q58,56 65,38" fill="none" stroke="#9933ff" strokeWidth="2" opacity="0.7" />
      <path d="M30,38 Q40,15 50,38 Q60,61 70,38" fill="none" stroke="#cc66ff" strokeWidth="1" opacity="0.4" />
      <circle cx="50" cy="38" r="5" fill="#ff3366" opacity="0.5" />
      <circle cx="50" cy="38" r="2" fill="#ffffff" opacity="0.3" />
    </>
  ),
  DES_NEW_02: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Void Siphon - energy draining vortex */}
      <ellipse cx="50" cy="38" rx="22" ry="22" fill="url(#voidGrad)" opacity="0.2" />
      <ellipse cx="50" cy="38" rx="16" ry="16" fill="#330066" opacity="0.4" />
      <ellipse cx="50" cy="38" rx="10" ry="10" fill="#4a0080" opacity="0.5" />
      <ellipse cx="50" cy="38" rx="5" ry="5" fill="#220044" opacity="0.8" />
      <path d="M30,20 Q50,38 70,56" fill="none" stroke="#9933ff" strokeWidth="1.5" opacity="0.5" />
      <path d="M70,20 Q50,38 30,56" fill="none" stroke="#9933ff" strokeWidth="1.5" opacity="0.5" />
      <circle cx="50" cy="38" r="2" fill="#ffffff" opacity="0.4" />
    </>
  ),

  // ==================== ASTRID LORE EXPANSION ====================
  AST_BOND_01: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Mighty, Loyal Mink - small golden mink companion */}
      <ellipse cx="50" cy="44" rx="12" ry="6" fill="#cc9900" />
      <circle cx="60" cy="40" r="5" fill="#cc9900" />
      <circle cx="63" cy="38" r="2" fill="#ffffff" />
      <circle cx="63" cy="38" r="1" fill="#553300" />
      <polygon points="58,36 56,30 61,36" fill="#cc9900" />
      <polygon points="63,36 65,30 66,36" fill="#cc9900" />
      <path d="M38,46 Q30,50 34,48" fill="#b8860b" />
      <rect x="44" y="48" width="3" height="5" rx="1" fill="#b8860b" />
      <rect x="54" y="48" width="3" height="5" rx="1" fill="#b8860b" />
      <circle cx="50" cy="36" r="2" fill="#ffe066" opacity="0.3" />
    </>
  ),
  AST_BOND_02: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Astrid's Shield - ornate golden shield */}
      {shield(50, 38, 'url(#shieldGrad)', 1.6)}
      <circle cx="50" cy="38" r="6" fill="url(#guardGrad)" opacity="0.6" />
      <circle cx="50" cy="38" r="3" fill="#ffffff" opacity="0.4" />
      <path d="M40,28 L50,22 L60,28" fill="none" stroke="#ffd700" strokeWidth="1.5" opacity="0.6" />
      <path d="M40,48 L50,54 L60,48" fill="none" stroke="#ffd700" strokeWidth="1.5" opacity="0.6" />
    </>
  ),
  AST_LOC01: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Rumbler Barracks - military building */}
      <rect x="20" y="38" width="60" height="32" rx="3" fill="#665522" />
      <rect x="18" y="36" width="64" height="4" rx="1" fill="#887744" />
      <rect x="30" y="44" width="10" height="14" rx="1" fill="#443311" />
      <rect x="45" y="44" width="10" height="14" rx="1" fill="#443311" />
      <rect x="60" y="44" width="10" height="14" rx="1" fill="#443311" />
      <rect x="30" y="44" width="10" height="2" fill="#ffe066" opacity="0.3" />
      <rect x="45" y="44" width="10" height="2" fill="#ffe066" opacity="0.3" />
      <rect x="60" y="44" width="10" height="2" fill="#ffe066" opacity="0.3" />
      {shield(50, 26, 'url(#guardGrad)', 0.6)}
    </>
  ),
  AST_NEW_01: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Shield Maiden's Insight - radiant wisdom spell */}
      <ellipse cx="50" cy="38" rx="20" ry="20" fill="url(#holyLightGrad)" opacity="0.15" />
      {shield(50, 34, 'url(#shieldGrad)', 1)}
      <circle cx="50" cy="34" r="5" fill="#ffffff" opacity="0.5" />
      <line x1="50" y1="14" x2="50" y2="8" stroke="#ffe066" strokeWidth="1.5" opacity="0.6" />
      <line x1="35" y1="20" x2="30" y2="15" stroke="#ffe066" strokeWidth="1.5" opacity="0.5" />
      <line x1="65" y1="20" x2="70" y2="15" stroke="#ffe066" strokeWidth="1.5" opacity="0.5" />
    </>
  ),
  AST_NEW_02: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Radiant Protector - glowing warrior */}
      {knight(50, 48, '#cc9900', 0.95)}
      {shield(36, 42, 'url(#guardGrad)', 0.5)}
      <ellipse cx="50" cy="40" rx="18" ry="20" fill="url(#holyLightGrad)" opacity="0.15" />
      <circle cx="50" cy="18" r="3" fill="#ffe066" opacity="0.5" />
    </>
  ),

  // ==================== AVA LORE EXPANSION ====================
  AVA_BOND_01: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {/* Fiona, Sky Glider - flying bird/glider companion */}
      <ellipse cx="50" cy="38" rx="10" ry="5" fill="#ff69b4" />
      <circle cx="40" cy="35" r="5" fill="#ff69b4" />
      <circle cx="38" cy="34" r="2" fill="#ffffff" />
      <circle cx="38" cy="34" r="1" fill="#330022" />
      <polygon points="35,36 30,38 35,38" fill="#ff99cc" />
      <path d="M48,34 Q60,18 72,30" fill="#ff99cc" opacity="0.7" />
      <path d="M48,42 Q60,56 72,44" fill="#ff99cc" opacity="0.7" />
      <polygon points="58,38 66,36 60,40" fill="#ff69b4" />
    </>
  ),
  AVA_BOND_02: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {/* Luna Device - tech artifact, crescent + gears */}
      <path d="M40,20 Q55,20 60,35 Q55,50 40,50 Q48,35 40,20" fill="url(#gadgetGrad)" opacity="0.7" />
      <circle cx="50" cy="35" r="5" fill="#ff99cc" opacity="0.5" />
      {gear(50, 35, '#cc3388', 0.4)}
      <circle cx="58" cy="28" r="2" fill="#ffffff" opacity="0.5" />
      <circle cx="56" cy="42" r="1.5" fill="#ffffff" opacity="0.4" />
      <circle cx="50" cy="35" r="2" fill="#ffffff" opacity="0.3" />
    </>
  ),
  AVA_LOC01: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {/* Ava's Workshop - tech workshop location */}
      <rect x="22" y="35" width="56" height="35" rx="3" fill="#442233" />
      <rect x="20" y="32" width="60" height="5" rx="1" fill="#553344" />
      <rect x="38" y="48" width="14" height="20" rx="2" fill="#331122" />
      {gear(30, 42, '#ff69b4', 0.35)}
      {gear(70, 44, '#cc3388', 0.4)}
      <rect x="58" y="40" width="8" height="6" rx="1" fill="#ff99cc" opacity="0.3" />
      <rect x="28" y="50" width="6" height="6" rx="1" fill="#ff69b4" opacity="0.3" />
      <circle cx="45" cy="56" r="2" fill="#ff3399" opacity="0.4" />
    </>
  ),
  AVA_ORRA_01: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {/* Orra Turret - energy turret device */}
      <rect x="42" y="45" width="16" height="20" rx="2" fill="url(#gadgetGrad)" />
      <rect x="38" y="42" width="24" height="5" rx="2" fill="#cc3388" />
      <circle cx="50" cy="35" r="8" fill="#ff69b4" opacity="0.5" />
      <rect x="47" y="22" width="6" height="15" rx="2" fill="#ff3399" />
      <circle cx="50" cy="20" r="4" fill="#ff99cc" opacity="0.6" />
      <circle cx="50" cy="20" r="2" fill="#ffffff" opacity="0.4" />
      <line x1="50" y1="16" x2="50" y2="8" stroke="#ff3399" strokeWidth="1.5" opacity="0.5" />
    </>
  ),

  // ==================== LUCAS LORE EXPANSION ====================
  LUC_BOND_01: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Jax, Desert Coyote - lean desert canine */}
      {wolf(48, 42, '#b8860b', 0.85)}
      <circle cx="62" cy="36" r="2" fill="#2dd4bf" />
      <ellipse cx="48" cy="56" rx="14" ry="4" fill="#8b6914" opacity="0.2" />
      <circle cx="30" cy="48" r="2" fill="#d4a843" opacity="0.3" />
      <circle cx="72" cy="50" r="1.5" fill="#d4a843" opacity="0.3" />
    </>
  ),
  LUC_BOND_02: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Owl Sketch - artistic owl drawing */}
      <rect x="30" y="18" width="40" height="50" rx="2" fill="#f5f0e0" opacity="0.8" />
      <rect x="32" y="20" width="36" height="46" rx="1" fill="none" stroke="#b8860b" strokeWidth="0.5" />
      <circle cx="50" cy="36" r="10" fill="none" stroke="#8b6914" strokeWidth="1.5" />
      <circle cx="46" cy="34" r="3" fill="none" stroke="#8b6914" strokeWidth="1" />
      <circle cx="54" cy="34" r="3" fill="none" stroke="#8b6914" strokeWidth="1" />
      <polygon points="50,38 48,42 52,42" fill="none" stroke="#8b6914" strokeWidth="1" />
      <path d="M40,28 Q46,22 50,26" fill="none" stroke="#8b6914" strokeWidth="1" />
      <path d="M60,28 Q54,22 50,26" fill="none" stroke="#8b6914" strokeWidth="1" />
    </>
  ),
  LUC_LOC01: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Polara Hideout - hidden desert base */}
      <ellipse cx="50" cy="65" rx="40" ry="10" fill="#8b6914" opacity="0.4" />
      <polygon points="20,55 40,30 50,55" fill="#705520" />
      <polygon points="50,55 65,25 80,55" fill="#604818" />
      <rect x="42" y="42" width="16" height="18" rx="2" fill="#3a2a08" />
      <path d="M42,42 Q50,34 58,42" fill="#4a3810" />
      <circle cx="50" cy="50" r="3" fill="#2dd4bf" opacity="0.4" />
      <circle cx="50" cy="50" r="1.5" fill="#14b8a6" opacity="0.6" />
    </>
  ),
  LUC_ORRA_01: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Sandtrap Orraglyph - desert trap with energy glyph */}
      <ellipse cx="50" cy="55" rx="25" ry="8" fill="#8b6914" opacity="0.4" />
      <ellipse cx="50" cy="52" rx="18" ry="5" fill="#705520" opacity="0.5" />
      <polygon points="50,20 40,45 60,45" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
      <polygon points="50,50 40,30 60,30" fill="none" stroke="#2dd4bf" strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="37" r="5" fill="url(#tealGrad)" opacity="0.4" />
      <circle cx="50" cy="37" r="2" fill="#5eead4" opacity="0.6" />
    </>
  ),

  // ==================== IZZY LORE EXPANSION ====================
  IZZ_BOND_01: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {/* Bling, Puffin Navigator - puffin bird */}
      <ellipse cx="50" cy="44" rx="8" ry="10" fill="#222222" />
      <circle cx="50" cy="32" r="7" fill="#222222" />
      <rect x="48" y="52" width="3" height="5" rx="1" fill="#ff6600" />
      <rect x="52" y="52" width="3" height="5" rx="1" fill="#ff6600" />
      <circle cx="47" cy="30" r="2.5" fill="#ffffff" />
      <circle cx="53" cy="30" r="2.5" fill="#ffffff" />
      <circle cx="47" cy="30" r="1.2" fill="#111111" />
      <circle cx="53" cy="30" r="1.2" fill="#111111" />
      <polygon points="50,34 46,38 54,38" fill="#ff8800" />
      <ellipse cx="50" cy="38" rx="5" ry="3" fill="#ffffff" opacity="0.6" />
    </>
  ),
  IZZ_BOND_02: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {/* Sparkle Compass - glowing navigation compass */}
      <circle cx="50" cy="38" r="16" fill="#553311" />
      <circle cx="50" cy="38" r="14" fill="#664422" />
      <circle cx="50" cy="38" r="12" fill="none" stroke="#ff9933" strokeWidth="1" />
      <polygon points="50,24 53,38 50,42 47,38" fill="#ff6600" />
      <polygon points="50,52 53,38 50,34 47,38" fill="#dddddd" opacity="0.6" />
      <circle cx="50" cy="38" r="2" fill="#ffaa44" />
      <circle cx="50" cy="24" r="1.5" fill="#ff9933" opacity="0.6" />
      <circle cx="64" cy="38" r="1.5" fill="#ff9933" opacity="0.4" />
      <circle cx="36" cy="38" r="1.5" fill="#ff9933" opacity="0.4" />
      <circle cx="50" cy="52" r="1.5" fill="#ff9933" opacity="0.4" />
    </>
  ),
  IZZ_LOC01: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {/* Navigator's Chart Room - room with maps */}
      <rect x="20" y="30" width="60" height="40" rx="3" fill="#553311" />
      <rect x="18" y="28" width="64" height="4" rx="1" fill="#664422" />
      <rect x="25" y="35" width="20" height="16" rx="1" fill="#f5f0d8" opacity="0.6" />
      <line x1="30" y1="38" x2="40" y2="45" stroke="#cc6600" strokeWidth="1" opacity="0.6" />
      <line x1="35" y1="36" x2="28" y2="48" stroke="#cc6600" strokeWidth="0.8" opacity="0.5" />
      <circle cx="35" cy="42" r="2" fill="#ff9933" opacity="0.4" />
      <rect x="55" y="35" width="16" height="16" rx="1" fill="#f5f0d8" opacity="0.5" />
      <line x1="58" y1="38" x2="66" y2="46" stroke="#cc6600" strokeWidth="0.8" opacity="0.5" />
      <rect x="40" y="55" width="12" height="14" rx="2" fill="#3a2208" />
    </>
  ),
  IZZ_ORRA_01: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {/* Orra Battery - glowing energy battery */}
      <rect x="38" y="24" width="24" height="36" rx="4" fill="#664422" />
      <rect x="44" y="18" width="12" height="8" rx="2" fill="#885533" />
      <rect x="42" y="30" width="16" height="24" rx="2" fill="url(#sparkleGrad)" opacity="0.4" />
      <circle cx="50" cy="42" r="6" fill="#ff9933" opacity="0.5" />
      <circle cx="50" cy="42" r="3" fill="#ffaa44" opacity="0.7" />
      <line x1="46" y1="34" x2="54" y2="34" stroke="#ffcc66" strokeWidth="1" opacity="0.5" />
      <line x1="46" y1="50" x2="54" y2="50" stroke="#ffcc66" strokeWidth="1" opacity="0.5" />
    </>
  ),
  IZZ_NEW_01: () => (
    <>
      <defs>{izzyGradients}</defs>
      {izzyBg}
      {/* Sparkle Avalanche - cascading sparkle spell */}
      <polygon points="30,15 50,5 70,15 80,35 65,55 35,55 20,35" fill="url(#sparkleGrad)" opacity="0.15" />
      <circle cx="40" cy="18" r="3" fill="#ffaa44" opacity="0.7" />
      <circle cx="60" cy="15" r="2.5" fill="#ff9933" opacity="0.6" />
      <circle cx="50" cy="25" r="4" fill="#ff8800" opacity="0.5" />
      <circle cx="35" cy="35" r="3" fill="#ffaa44" opacity="0.6" />
      <circle cx="65" cy="32" r="3.5" fill="#ff9933" opacity="0.5" />
      <circle cx="45" cy="45" r="3" fill="#ff6600" opacity="0.5" />
      <circle cx="58" cy="48" r="2.5" fill="#ffaa44" opacity="0.4" />
      <circle cx="50" cy="58" r="2" fill="#ff8800" opacity="0.3" />
      <ellipse cx="50" cy="65" rx="25" ry="6" fill="#cc5500" opacity="0.2" />
    </>
  ),

  // ==================== NEUTRAL LORE EXPANSION ====================
  NEU_LOC01: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Miro Trading Post - neutral market building */}
      <rect x="22" y="35" width="56" height="35" rx="3" fill="#555544" />
      <polygon points="22,35 50,15 78,35" fill="#666655" />
      <rect x="38" y="48" width="14" height="22" rx="2" fill="#333322" />
      <rect x="26" y="40" width="10" height="8" rx="1" fill="#ffffaa" opacity="0.3" />
      <rect x="64" y="40" width="10" height="8" rx="1" fill="#ffffaa" opacity="0.3" />
      <circle cx="50" cy="28" r="4" fill="url(#coinGrad)" opacity="0.6" />
      <rect x="46" y="18" width="8" height="3" rx="1" fill="#887744" />
    </>
  ),
  NEU_LOC02: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Aster Academy Grounds - school/academy */}
      <rect x="25" y="38" width="50" height="32" rx="3" fill="#556666" />
      <polygon points="25,38 50,18 75,38" fill="#667777" />
      <rect x="30" y="42" width="8" height="10" rx="1" fill="#88ccff" opacity="0.3" />
      <rect x="42" y="42" width="8" height="10" rx="1" fill="#88ccff" opacity="0.3" />
      <rect x="54" y="42" width="8" height="10" rx="1" fill="#88ccff" opacity="0.3" />
      <rect x="44" y="54" width="12" height="16" rx="2" fill="#334444" />
      <circle cx="50" cy="30" r="5" fill="#ffffaa" opacity="0.3" />
      <rect x="15" y="38" width="6" height="32" rx="1" fill="#556666" />
      <rect x="79" y="38" width="6" height="32" rx="1" fill="#556666" />
    </>
  ),
  NEU_ORRA_01: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Orra Capacitor - neutral energy storage */}
      <rect x="35" y="22" width="30" height="40" rx="5" fill="url(#grayGrad)" />
      <rect x="40" y="28" width="20" height="28" rx="3" fill="url(#goldGrad)" opacity="0.3" />
      <circle cx="50" cy="42" r="8" fill="#ffcc33" opacity="0.4" />
      <circle cx="50" cy="42" r="4" fill="#ffffff" opacity="0.3" />
      <rect x="44" y="16" width="12" height="8" rx="2" fill="#888888" />
      <line x1="48" y1="18" x2="48" y2="22" stroke="#ffcc33" strokeWidth="1.5" opacity="0.6" />
      <line x1="52" y1="18" x2="52" y2="22" stroke="#ffcc33" strokeWidth="1.5" opacity="0.6" />
    </>
  ),
  NEU_ORRA_02: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Orra Crucible Fragment - glowing energy shard */}
      <polygon points="50,15 58,35 54,38 56,60 50,65 44,60 46,38 42,35" fill="url(#goldGrad)" opacity="0.7" />
      <polygon points="50,20 55,35 52,37 54,55 50,58 46,55 48,37 45,35" fill="#ffcc33" opacity="0.4" />
      <circle cx="50" cy="38" r="4" fill="#ffffff" opacity="0.3" />
      <circle cx="44" cy="30" r="2" fill="#ffcc33" opacity="0.3" />
      <circle cx="56" cy="45" r="2" fill="#ffcc33" opacity="0.3" />
      <ellipse cx="50" cy="68" rx="10" ry="3" fill="#ccaa33" opacity="0.2" />
    </>
  ),

  // ==================== JIMMY SECRETS & EXTRAS ====================
  JIM_S01: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Secret - amber ? with fire mist */}
      <rect x="0" y="0" width="100" height="80" fill="#1a0800" opacity="0.5" />
      <circle cx="50" cy="40" r="22" fill="none" stroke="#ff6600" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="40" r="28" fill="none" stroke="#ff4400" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#ffaa00" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="35" cy="25" r="3" fill="#ff6600" opacity="0.3" />
      <circle cx="65" cy="55" r="2" fill="#ff4400" opacity="0.2" />
    </>
  ),
  JIM_S02: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Secret - fire trap variant */}
      <rect x="0" y="0" width="100" height="80" fill="#1a0800" opacity="0.5" />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#ff4400" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="40" r="30" fill="none" stroke="#cc3300" strokeWidth="1" opacity="0.15" />
      <text x="50" y="52" textAnchor="middle" fill="#ff8800" fontSize="36" fontWeight="bold" opacity="0.85">?</text>
      <circle cx="30" cy="30" r="2" fill="#ff6600" opacity="0.25" />
      <circle cx="70" cy="50" r="3" fill="#ff4400" opacity="0.2" />
      <circle cx="60" cy="20" r="2" fill="#ffaa00" opacity="0.15" />
    </>
  ),
  JIM_S03: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Secret - ember ward variant */}
      <rect x="0" y="0" width="100" height="80" fill="#1a0800" opacity="0.5" />
      <circle cx="50" cy="40" r="20" fill="none" stroke="#ffaa00" strokeWidth="2" opacity="0.3" />
      <circle cx="50" cy="40" r="26" fill="none" stroke="#ff6600" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#ffcc00" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="40" cy="60" r="2" fill="#ff4400" opacity="0.3" />
      <circle cx="25" cy="35" r="2" fill="#ff6600" opacity="0.2" />
      <circle cx="72" cy="28" r="3" fill="#ffaa00" opacity="0.15" />
    </>
  ),
  JIM016: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Fire Warrior - armored flame soldier */}
      {humanoid(50, 50, '#cc4400')}
      <polygon points="50,18 44,32 56,32" fill="url(#fireGrad)" opacity="0.7" />
      {flames(50, 16, 0.8)}
      {flames(42, 22, 0.5)}
      {flames(58, 22, 0.5)}
      <rect x="60" y="32" width="4" height="22" rx="1" fill="#ff6600" />
      <ellipse cx="50" cy="68" rx="12" ry="3" fill="#ff4400" opacity="0.2" />
    </>
  ),
  JIM_LORE_01: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Ancient Fire Tome - burning scroll */}
      <rect x="30" y="20" width="40" height="50" rx="4" fill="#663300" />
      <rect x="34" y="24" width="32" height="42" rx="2" fill="#884422" />
      <line x1="38" y1="32" x2="62" y2="32" stroke="#ffaa00" strokeWidth="1" opacity="0.5" />
      <line x1="38" y1="38" x2="58" y2="38" stroke="#ffaa00" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="44" x2="60" y2="44" stroke="#ffaa00" strokeWidth="1" opacity="0.3" />
      <circle cx="50" cy="55" r="5" fill="url(#fireGrad)" opacity="0.5" />
      {flames(50, 50, 0.5)}
      {flames(32, 18, 0.4)}
      {flames(68, 18, 0.4)}
    </>
  ),
  JIM_LORE_02: () => (
    <>
      <defs>{jimmyGradients}</defs>
      {fireBg}
      {/* Fire Legend Scene - volcano with ancient fire runes */}
      <polygon points="50,10 20,65 80,65" fill="#882200" />
      <polygon points="50,10 35,55 65,55" fill="url(#lavaGrad)" opacity="0.4" />
      <ellipse cx="50" cy="14" rx="8" ry="5" fill="#ff4400" opacity="0.6" />
      {flames(50, 8, 0.7)}
      {flames(44, 12, 0.5)}
      {flames(56, 12, 0.5)}
      <rect x="15" y="65" width="70" height="10" rx="2" fill="#331100" />
      <circle cx="30" cy="58" r="2" fill="#ffaa00" opacity="0.3" />
      <circle cx="70" cy="58" r="2" fill="#ffaa00" opacity="0.3" />
    </>
  ),

  // ==================== ANDERS SECRETS ====================
  AND_S01: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Secret - icy ? with frost mist */}
      <rect x="0" y="0" width="100" height="80" fill="#030818" opacity="0.5" />
      <circle cx="50" cy="40" r="22" fill="none" stroke="#66aaff" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="40" r="28" fill="none" stroke="#4488dd" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#88ccff" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="35" cy="25" r="3" fill="#66aaff" opacity="0.3" />
      <circle cx="65" cy="55" r="2" fill="#4488dd" opacity="0.2" />
    </>
  ),
  AND_S02: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Secret - ice trap variant */}
      <rect x="0" y="0" width="100" height="80" fill="#030818" opacity="0.5" />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#4488dd" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="40" r="30" fill="none" stroke="#3366bb" strokeWidth="1" opacity="0.15" />
      <text x="50" y="52" textAnchor="middle" fill="#aaddff" fontSize="36" fontWeight="bold" opacity="0.85">?</text>
      <circle cx="30" cy="30" r="2" fill="#66aaff" opacity="0.25" />
      <circle cx="70" cy="50" r="3" fill="#4488dd" opacity="0.2" />
      <circle cx="60" cy="20" r="2" fill="#88ccff" opacity="0.15" />
    </>
  ),
  AND_S03: () => (
    <>
      <defs>{andersGradients}</defs>
      {iceBg}
      {/* Secret - frost ward variant */}
      <rect x="0" y="0" width="100" height="80" fill="#030818" opacity="0.5" />
      <circle cx="50" cy="40" r="20" fill="none" stroke="#88ccff" strokeWidth="2" opacity="0.3" />
      <circle cx="50" cy="40" r="26" fill="none" stroke="#66aaff" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#bbddff" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="40" cy="60" r="2" fill="#4488dd" opacity="0.3" />
      <circle cx="25" cy="35" r="2" fill="#66aaff" opacity="0.2" />
      <circle cx="72" cy="28" r="3" fill="#88ccff" opacity="0.15" />
    </>
  ),

  // ==================== ASTRID SECRETS & TOKENS ====================
  AST_S01: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Secret - golden ? with divine glow */}
      <rect x="0" y="0" width="100" height="80" fill="#0d0a00" opacity="0.5" />
      <circle cx="50" cy="40" r="22" fill="none" stroke="#daa520" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="40" r="28" fill="none" stroke="#cc9900" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#ffd700" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="35" cy="25" r="3" fill="#daa520" opacity="0.3" />
      <circle cx="65" cy="55" r="2" fill="#cc9900" opacity="0.2" />
    </>
  ),
  AST_S02: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Secret - divine trap variant */}
      <rect x="0" y="0" width="100" height="80" fill="#0d0a00" opacity="0.5" />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#cc9900" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="40" r="30" fill="none" stroke="#aa7700" strokeWidth="1" opacity="0.15" />
      <text x="50" y="52" textAnchor="middle" fill="#ffcc33" fontSize="36" fontWeight="bold" opacity="0.85">?</text>
      <circle cx="30" cy="30" r="2" fill="#daa520" opacity="0.25" />
      <circle cx="70" cy="50" r="3" fill="#cc9900" opacity="0.2" />
      <circle cx="60" cy="20" r="2" fill="#ffd700" opacity="0.15" />
    </>
  ),
  AST_S03: () => (
    <>
      <defs>{astridGradients}</defs>
      {astridBg}
      {/* Secret - holy ward variant */}
      <rect x="0" y="0" width="100" height="80" fill="#0d0a00" opacity="0.5" />
      <circle cx="50" cy="40" r="20" fill="none" stroke="#ffd700" strokeWidth="2" opacity="0.3" />
      <circle cx="50" cy="40" r="26" fill="none" stroke="#daa520" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#ffe066" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="40" cy="60" r="2" fill="#cc9900" opacity="0.3" />
      <circle cx="25" cy="35" r="2" fill="#daa520" opacity="0.2" />
      <circle cx="72" cy="28" r="3" fill="#ffd700" opacity="0.15" />
    </>
  ),
  AST_TOKEN_01: () => (
    <>
      <defs>{astridGradients}</defs>
      <rect x="0" y="0" width="100" height="80" fill="#1a1408" />
      {/* Small golden guardian */}
      <circle cx="50" cy="30" r="8" fill="url(#shieldGrad)" />
      <rect x="44" y="36" width="12" height="16" rx="2" fill="#cc9900" />
      <rect x="40" y="38" width="6" height="10" rx="2" fill="#cc9900" />
      <rect x="54" y="38" width="6" height="10" rx="2" fill="#cc9900" />
      <circle cx="47" cy="28" r="1.5" fill="#fff" />
      <circle cx="53" cy="28" r="1.5" fill="#fff" />
      <ellipse cx="50" cy="60" rx="8" ry="2" fill="#daa520" opacity="0.2" />
    </>
  ),
  AST_TOKEN_02: () => (
    <>
      <defs>{astridGradients}</defs>
      <rect x="0" y="0" width="100" height="80" fill="#1a1408" />
      {/* Small shield bearer */}
      <circle cx="50" cy="28" r="7" fill="#cc9900" />
      <rect x="44" y="33" width="12" height="14" rx="2" fill="#aa8800" />
      <rect x="40" y="35" width="6" height="10" rx="2" fill="#aa8800" />
      <rect x="54" y="35" width="6" height="10" rx="2" fill="#aa8800" />
      <circle cx="47" cy="26" r="1.5" fill="#fff" />
      <circle cx="53" cy="26" r="1.5" fill="#fff" />
      <rect x="56" y="34" width="10" height="14" rx="3" fill="url(#shieldGrad)" opacity="0.8" />
      <ellipse cx="50" cy="56" rx="8" ry="2" fill="#daa520" opacity="0.2" />
    </>
  ),

  // ==================== DES SECRETS & EXTRAS ====================
  DES_S01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Secret - purple ? with shadow mist */}
      <rect x="0" y="0" width="100" height="80" fill="#0a0015" opacity="0.5" />
      <circle cx="50" cy="40" r="22" fill="none" stroke="#9933cc" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="40" r="28" fill="none" stroke="#7722aa" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#bb66ff" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="35" cy="25" r="3" fill="#9933cc" opacity="0.3" />
      <circle cx="65" cy="55" r="2" fill="#7722aa" opacity="0.2" />
    </>
  ),
  DES_S02: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Secret - dark trap variant */}
      <rect x="0" y="0" width="100" height="80" fill="#0a0015" opacity="0.5" />
      <circle cx="50" cy="40" r="24" fill="none" stroke="#7722aa" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="40" r="30" fill="none" stroke="#551188" strokeWidth="1" opacity="0.15" />
      <text x="50" y="52" textAnchor="middle" fill="#aa55ee" fontSize="36" fontWeight="bold" opacity="0.85">?</text>
      <circle cx="30" cy="30" r="2" fill="#9933cc" opacity="0.25" />
      <circle cx="70" cy="50" r="3" fill="#7722aa" opacity="0.2" />
      <circle cx="60" cy="20" r="2" fill="#bb66ff" opacity="0.15" />
    </>
  ),
  DES_S03: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Secret - void ward variant */}
      <rect x="0" y="0" width="100" height="80" fill="#0a0015" opacity="0.5" />
      <circle cx="50" cy="40" r="20" fill="none" stroke="#bb66ff" strokeWidth="2" opacity="0.3" />
      <circle cx="50" cy="40" r="26" fill="none" stroke="#9933cc" strokeWidth="1" opacity="0.2" />
      <text x="50" y="52" textAnchor="middle" fill="#cc88ff" fontSize="36" fontWeight="bold" opacity="0.9">?</text>
      <circle cx="40" cy="60" r="2" fill="#7722aa" opacity="0.3" />
      <circle cx="25" cy="35" r="2" fill="#9933cc" opacity="0.2" />
      <circle cx="72" cy="28" r="3" fill="#bb66ff" opacity="0.15" />
    </>
  ),
  DES_LORE_01: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dark Tome - shadow-bound grimoire */}
      <rect x="30" y="20" width="40" height="50" rx="4" fill="#220033" />
      <rect x="34" y="24" width="32" height="42" rx="2" fill="#331144" />
      <line x1="38" y1="32" x2="62" y2="32" stroke="#9933cc" strokeWidth="1" opacity="0.5" />
      <line x1="38" y1="38" x2="58" y2="38" stroke="#9933cc" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="44" x2="60" y2="44" stroke="#9933cc" strokeWidth="1" opacity="0.3" />
      <circle cx="50" cy="55" r="5" fill="url(#darkOrraGrad)" opacity="0.5" />
      <circle cx="50" cy="55" r="3" fill="#bb66ff" opacity="0.3" />
      <circle cx="32" cy="18" r="2" fill="#9933cc" opacity="0.2" />
      <circle cx="68" cy="18" r="2" fill="#9933cc" opacity="0.2" />
    </>
  ),
  EOT_003: () => (
    <>
      <defs>{desGradients}</defs>
      {desBg}
      {/* Dark Swirl Countdown - shadow timer */}
      <circle cx="50" cy="40" r="20" fill="none" stroke="#9933cc" strokeWidth="2" opacity="0.5" />
      <circle cx="50" cy="40" r="16" fill="url(#darkOrraGrad)" opacity="0.3" />
      <path d="M50,24 A16,16 0 0,1 66,40" fill="none" stroke="#bb66ff" strokeWidth="3" opacity="0.7" />
      <path d="M50,24 A16,16 0 0,0 34,40" fill="none" stroke="#7722aa" strokeWidth="2" opacity="0.4" />
      <circle cx="50" cy="40" r="4" fill="#bb66ff" opacity="0.5" />
      <line x1="50" y1="40" x2="50" y2="28" stroke="#cc88ff" strokeWidth="1.5" opacity="0.6" />
      <circle cx="38" cy="55" r="2" fill="#9933cc" opacity="0.2" />
      <circle cx="62" cy="55" r="2" fill="#9933cc" opacity="0.2" />
    </>
  ),

  // ==================== LUCAS COMBOS ====================
  COMBO_002: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Shadowy Dual-Strike - linked teal blades */}
      <line x1="25" y1="20" x2="50" y2="55" stroke="#33ccaa" strokeWidth="3" opacity="0.7" />
      <line x1="75" y1="20" x2="50" y2="55" stroke="#33ccaa" strokeWidth="3" opacity="0.7" />
      <circle cx="50" cy="55" r="6" fill="#22aa88" opacity="0.5" />
      <circle cx="25" cy="20" r="4" fill="#33ccaa" opacity="0.6" />
      <circle cx="75" cy="20" r="4" fill="#33ccaa" opacity="0.6" />
      <line x1="25" y1="20" x2="75" y2="20" stroke="#22aa88" strokeWidth="1" opacity="0.3" strokeDasharray="4,3" />
      <circle cx="50" cy="38" r="2" fill="#55eedd" opacity="0.3" />
    </>
  ),
  COMBO_003: () => (
    <>
      <defs>{lucasGradients}</defs>
      {lucasBg}
      {/* Teal Shadow Combo - connected energy streams */}
      <path d="M20,40 Q35,20 50,40 Q65,60 80,40" fill="none" stroke="#33ccaa" strokeWidth="3" opacity="0.6" />
      <path d="M20,40 Q35,60 50,40 Q65,20 80,40" fill="none" stroke="#22aa88" strokeWidth="2" opacity="0.4" />
      <circle cx="20" cy="40" r="5" fill="#33ccaa" opacity="0.5" />
      <circle cx="80" cy="40" r="5" fill="#33ccaa" opacity="0.5" />
      <circle cx="50" cy="40" r="6" fill="#55eedd" opacity="0.4" />
      <circle cx="50" cy="40" r="3" fill="#ffffff" opacity="0.2" />
    </>
  ),

  // ==================== AVA TOKEN ====================
  AVA_TOKEN_02: () => (
    <>
      <defs>{avaGradients}</defs>
      {avaBg}
      {/* Small mechanical drone */}
      <ellipse cx="50" cy="36" rx="12" ry="6" fill="#ff69b4" opacity="0.7" />
      <rect x="44" y="30" width="12" height="8" rx="3" fill="#ff99cc" />
      <circle cx="47" cy="33" r="1.5" fill="#fff" />
      <circle cx="53" cy="33" r="1.5" fill="#fff" />
      <line x1="38" y1="34" x2="30" y2="30" stroke="#ff69b4" strokeWidth="1.5" opacity="0.5" />
      <line x1="62" y1="34" x2="70" y2="30" stroke="#ff69b4" strokeWidth="1.5" opacity="0.5" />
      <circle cx="30" cy="30" r="2" fill="#ff99cc" opacity="0.4" />
      <circle cx="70" cy="30" r="2" fill="#ff99cc" opacity="0.4" />
      <ellipse cx="50" cy="48" rx="6" ry="2" fill="#ff69b4" opacity="0.2" />
    </>
  ),

  // ==================== NEUTRAL EOT & LORE ====================
  EOT_001: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Generic Hourglass Timer */}
      <rect x="36" y="15" width="28" height="4" rx="1" fill="#888888" />
      <rect x="36" y="61" width="28" height="4" rx="1" fill="#888888" />
      <polygon points="40,19 60,19 55,40 45,40" fill="url(#grayGrad)" opacity="0.5" />
      <polygon points="40,61 60,61 55,40 45,40" fill="url(#grayGrad)" opacity="0.5" />
      <circle cx="50" cy="40" r="3" fill="#ffcc33" opacity="0.5" />
      <line x1="50" y1="30" x2="50" y2="38" stroke="#ffcc33" strokeWidth="1" opacity="0.4" />
      <circle cx="48" cy="52" r="1" fill="#ccaa33" opacity="0.3" />
      <circle cx="52" cy="54" r="1" fill="#ccaa33" opacity="0.3" />
    </>
  ),
  EOT_002: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Countdown Gear */}
      <circle cx="50" cy="40" r="20" fill="url(#grayGrad)" opacity="0.4" />
      <circle cx="50" cy="40" r="16" fill="none" stroke="#888888" strokeWidth="2" opacity="0.6" />
      <circle cx="50" cy="40" r="12" fill="none" stroke="#aaaaaa" strokeWidth="1" opacity="0.4" />
      <line x1="50" y1="40" x2="50" y2="28" stroke="#ffcc33" strokeWidth="2" opacity="0.7" />
      <line x1="50" y1="40" x2="60" y2="40" stroke="#ccaa33" strokeWidth="1.5" opacity="0.5" />
      <circle cx="50" cy="40" r="3" fill="#ffcc33" opacity="0.5" />
      <rect x="48" y="18" width="4" height="4" rx="1" fill="#aaaaaa" opacity="0.5" />
      <rect x="48" y="58" width="4" height="4" rx="1" fill="#aaaaaa" opacity="0.5" />
      <rect x="28" y="38" width="4" height="4" rx="1" fill="#aaaaaa" opacity="0.5" />
      <rect x="68" y="38" width="4" height="4" rx="1" fill="#aaaaaa" opacity="0.5" />
    </>
  ),
  NEU_LORE_01: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ancient Neutral Scroll */}
      <rect x="30" y="18" width="40" height="48" rx="3" fill="#666655" />
      <rect x="34" y="22" width="32" height="40" rx="2" fill="#777766" />
      <ellipse cx="50" cy="18" rx="16" ry="4" fill="#888877" />
      <ellipse cx="50" cy="66" rx="16" ry="4" fill="#888877" />
      <line x1="38" y1="30" x2="62" y2="30" stroke="#ccccaa" strokeWidth="1" opacity="0.5" />
      <line x1="38" y1="36" x2="58" y2="36" stroke="#ccccaa" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="42" x2="60" y2="42" stroke="#ccccaa" strokeWidth="1" opacity="0.3" />
      <line x1="38" y1="48" x2="56" y2="48" stroke="#ccccaa" strokeWidth="1" opacity="0.25" />
    </>
  ),
  NEU_LORE_02: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* World Map / Atlas */}
      <rect x="18" y="18" width="64" height="48" rx="3" fill="#555544" />
      <rect x="22" y="22" width="56" height="40" rx="2" fill="#666655" />
      <ellipse cx="40" cy="38" rx="12" ry="10" fill="#557755" opacity="0.4" />
      <ellipse cx="62" cy="34" rx="8" ry="7" fill="#557755" opacity="0.35" />
      <ellipse cx="55" cy="50" rx="6" ry="4" fill="#557755" opacity="0.3" />
      <line x1="22" y1="42" x2="78" y2="42" stroke="#888877" strokeWidth="0.5" opacity="0.3" />
      <line x1="50" y1="22" x2="50" y2="62" stroke="#888877" strokeWidth="0.5" opacity="0.3" />
      <circle cx="40" cy="35" r="2" fill="#ffcc33" opacity="0.4" />
    </>
  ),
  NEU_LORE_03: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Crystal Shard */}
      <polygon points="50,12 60,35 55,42 58,65 50,70 42,65 45,42 40,35" fill="url(#grayGrad)" opacity="0.6" />
      <polygon points="50,18 56,35 53,40 55,58 50,62 45,58 47,40 44,35" fill="#aaaaaa" opacity="0.3" />
      <line x1="50" y1="20" x2="50" y2="60" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
      <circle cx="50" cy="38" r="3" fill="#ffffff" opacity="0.2" />
      <ellipse cx="50" cy="72" rx="10" ry="3" fill="#666666" opacity="0.2" />
    </>
  ),
  NEU_LORE_04: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Ancient Ruin - crumbled stone pillars */}
      <rect x="18" y="30" width="8" height="38" rx="1" fill="#666655" />
      <rect x="18" y="26" width="8" height="6" rx="1" fill="#777766" />
      <rect x="74" y="35" width="8" height="33" rx="1" fill="#666655" />
      <rect x="74" y="31" width="8" height="6" rx="1" fill="#777766" />
      <rect x="40" y="42" width="8" height="26" rx="1" fill="#555544" />
      <rect x="52" y="38" width="8" height="30" rx="1" fill="#555544" />
      <line x1="18" y1="28" x2="82" y2="33" stroke="#777766" strokeWidth="2" opacity="0.3" />
      <polygon points="46,25 54,25 50,15" fill="url(#goldGrad)" opacity="0.3" />
      <circle cx="50" cy="22" r="3" fill="#ffcc33" opacity="0.2" />
      <rect x="10" y="68" width="80" height="4" rx="1" fill="#444433" />
    </>
  ),
  NEU_LORE_05: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Star Chart - constellation map */}
      <rect x="15" y="12" width="70" height="56" rx="4" fill="#111122" />
      <circle cx="30" cy="28" r="2" fill="#ffffcc" opacity="0.7" />
      <circle cx="55" cy="22" r="2.5" fill="#ffffcc" opacity="0.8" />
      <circle cx="70" cy="35" r="1.5" fill="#ffffcc" opacity="0.6" />
      <circle cx="40" cy="45" r="2" fill="#ffffcc" opacity="0.7" />
      <circle cx="65" cy="55" r="1.5" fill="#ffffcc" opacity="0.5" />
      <circle cx="25" cy="52" r="2" fill="#ffffcc" opacity="0.6" />
      <line x1="30" y1="28" x2="55" y2="22" stroke="#ffffcc" strokeWidth="0.5" opacity="0.3" />
      <line x1="55" y1="22" x2="70" y2="35" stroke="#ffffcc" strokeWidth="0.5" opacity="0.3" />
      <line x1="70" y1="35" x2="65" y2="55" stroke="#ffffcc" strokeWidth="0.5" opacity="0.3" />
      <line x1="40" y1="45" x2="25" y2="52" stroke="#ffffcc" strokeWidth="0.5" opacity="0.3" />
      <line x1="30" y1="28" x2="40" y2="45" stroke="#ffffcc" strokeWidth="0.5" opacity="0.3" />
      <circle cx="50" cy="40" r="8" fill="none" stroke="#ccccaa" strokeWidth="0.5" opacity="0.2" />
    </>
  ),

  // ==================== COMBO (Neutral) ====================
  COMBO_001: () => (
    <>
      <defs>{neutralGradients}</defs>
      {neutralBg}
      {/* Neutral Combo - dual swords crossed */}
      <line x1="25" y1="15" x2="75" y2="65" stroke="#aaaaaa" strokeWidth="3" opacity="0.7" />
      <line x1="75" y1="15" x2="25" y2="65" stroke="#aaaaaa" strokeWidth="3" opacity="0.7" />
      <circle cx="50" cy="40" r="8" fill="url(#goldGrad)" opacity="0.4" />
      <circle cx="50" cy="40" r="4" fill="#ffcc33" opacity="0.3" />
      <rect x="22" y="12" width="6" height="8" rx="2" fill="#888888" />
      <rect x="72" y="12" width="6" height="8" rx="2" fill="#888888" />
      <rect x="22" y="60" width="6" height="8" rx="2" fill="#888888" />
      <rect x="72" y="60" width="6" height="8" rx="2" fill="#888888" />
    </>
  ),

  // ==================== SPECIAL ====================
  COIN: () => (
    <>
      <defs>{neutralGradients}</defs>
      <rect x="0" y="0" width="100" height="80" fill="#1a1408" />
      {/* The Coin - gold coin */}
      <circle cx="50" cy="40" r="24" fill="url(#coinGrad)" />
      <circle cx="50" cy="40" r="20" fill="none" stroke="#daa520" strokeWidth="2" />
      <circle cx="50" cy="40" r="16" fill="none" stroke="#b8860b" strokeWidth="1" />
      <circle cx="50" cy="40" r="6" fill="#ffd700" opacity="0.5" />
      <ellipse cx="50" cy="40" rx="10" ry="14" fill="none" stroke="#b8860b" strokeWidth="1.5" opacity="0.5" />
      <circle cx="42" cy="30" r="3" fill="#ffffff" opacity="0.2" />
    </>
  ),
};

function FallbackArt() {
  return (
    <>
      <defs>
        <linearGradient id="fallbackGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#555555" />
          <stop offset="100%" stopColor="#333333" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="80" fill="#111111" />
      <rect x="15" y="10" width="70" height="60" rx="5" fill="url(#fallbackGrad)" />
      <rect x="20" y="15" width="60" height="50" rx="3" fill="none" stroke="#666666" strokeWidth="1" />
      <circle cx="50" cy="35" r="10" fill="#444444" />
      <rect x="45" y="50" width="10" height="3" rx="1" fill="#444444" />
    </>
  );
}

export function CardArt({
  cardCode,
  className,
  square,
}: {
  cardCode: string;
  className?: string;
  // When true, the SVG fallback uses preserveAspectRatio="xMidYMid slice"
  // so the (100x80) viewBox content is centered and CROPPED into a square
  // instead of being stretched to fit. This prevents the squished-weapon
  // bug when CardArt is rendered into a round/square container like the
  // hero weapon slot. The PNG path uses objectFit: 'cover' which already
  // does the right thing — square only affects the SVG branch.
  square?: boolean;
}) {
  const [pngFailed, setPngFailed] = useState(false);
  const hasPng = CARD_ART_PNGS.has(cardCode) && !pngFailed;

  if (hasPng) {
    return (
      <img
        src={`/cards/${cardCode}.png`}
        alt=""
        className={className}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        loading="lazy"
        onError={() => setPngFailed(true)}
      />
    );
  }

  const renderArt = cardArtMap[cardCode];
  return (
    <svg
      viewBox="0 0 100 80"
      preserveAspectRatio={square ? 'xMidYMid slice' : 'xMidYMid meet'}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      {renderArt ? renderArt() : <FallbackArt />}
    </svg>
  );
}
