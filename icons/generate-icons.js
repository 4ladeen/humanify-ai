#!/usr/bin/env node
/**
 * Icon generator for Humanify AI Chrome Extension
 * Generates PNG icons at required sizes using Canvas API (Node.js with canvas package)
 * Run: node icons/generate-icons.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6C5CE7');
  gradient.addColorStop(1, '#a855f7');

  // Draw rounded rectangle background
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw "H" letter
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', size * 0.47, size * 0.54);

  // Draw green dot indicator (AI)
  const dotRadius = size * 0.18;
  const dotX = size * 0.78;
  const dotY = size * 0.25;
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#00B894';
  ctx.fill();

  // "AI" text in green dot
  if (size >= 48) {
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.14}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', dotX, dotY);
  }

  return canvas.toBuffer('image/png');
}

sizes.forEach(size => {
  const buffer = generateIcon(size);
  const outputPath = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated icon${size}.png`);
});

console.log('All icons generated successfully!');
