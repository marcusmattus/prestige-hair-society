#!/usr/bin/env node
/**
 * Derive the site's logo assets from `public/logo.jpg`.
 *
 * The supplied logo is a screenshot: the mark sits on a baked-in cream card,
 * with a few pixels of white window chrome down the left and top edges. That
 * is workable in the header and footer, which happen to be cream too, but only
 * because the markup papers over it with `mix-blend-multiply`. That trick
 * fails everywhere the background is not light — a dark section, an email
 * client, a social card, a browser in forced-colours mode — where the mark
 * turns into a pale rectangle.
 *
 * So rather than carry the hack, this recovers a real alpha channel.
 *
 * The recovery is exact rather than a threshold key. `mix-blend-multiply` on a
 * light ground is a specific compositing equation, and the screenshot is its
 * output. Reading it backwards:
 *
 *     C = A·a + B·(1 − a)          C observed, B the cream, A and a unknown
 *
 * Two unknowns and one equation, so it needs one assumption: the mark is drawn
 * in a single ink, and every pixel is that ink at some coverage. That is true
 * of this logo, and it makes the alpha the coverage between cream and ink,
 * with the colour unpremultiplied back out. Antialiased edges survive intact —
 * a threshold key would have left them ragged.
 *
 * Outputs (all committed; this is not part of the build):
 *   public/logo.png             transparent, for the header and footer
 *   public/logo-light.png       transparent in cream, for dark backgrounds
 *   public/apple-touch-icon.png 180×180 on cream — iOS gives no transparency
 *   public/og.jpg               1200×630 social card
 *   src/app/icon.png            favicon
 *
 * Usage: node scripts/build-logo.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "logo.jpg");

/** The cream the mark was screenshotted onto. Measured, not guessed. */
const CARD = [246, 241, 231];
/** The darkest ink in the mark, likewise measured. */
const INK = [60, 71, 48];
/** Cream for the dark-background variant — the site's own --color-sand. */
const SAND = [245, 240, 229];

const luminance = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Find the cream card inside the screenshot, discarding the window chrome.
 *
 * Scanning for coverage rather than for the first non-white pixel: a stray
 * light pixel at the edge of a JPEG is common, and a whole row or column being
 * cream is not something compression noise produces.
 */
function cardBounds(data, { width: W, height: H, channels: C }) {
  const isCard = (x, y) => {
    const i = (y * W + x) * C;
    return data[i + 2] < 245 && data[i] > 200;
  };
  const colShare = (x) => {
    let n = 0;
    for (let y = 0; y < H; y++) if (isCard(x, y)) n++;
    return n / H;
  };
  const rowShare = (y) => {
    let n = 0;
    for (let x = 0; x < W; x++) if (isCard(x, y)) n++;
    return n / W;
  };

  let left = 0;
  let top = 0;
  let right = W - 1;
  let bottom = H - 1;
  while (left < right && colShare(left) < 0.5) left++;
  while (right > left && colShare(right) < 0.5) right--;
  while (top < bottom && rowShare(top) < 0.5) top++;
  while (bottom > top && rowShare(bottom) < 0.5) bottom--;

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Turn the cream ground into transparency.
 *
 * `ground` is the colour to unmix — the cream card. `ink` sets where alpha
 * reaches 1: the darkest pixel present. Pixels lighter than the card (the
 * highlights in the leaves) clamp to fully transparent rather than going
 * negative.
 */
function keyToAlpha(rgb, info, ground, ink) {
  const { width: W, height: H, channels: C } = info;
  const out = Buffer.alloc(W * H * 4);
  const groundLum = luminance(ground);
  const inkLum = luminance(ink);
  const span = groundLum - inkLum;

  for (let p = 0; p < W * H; p++) {
    const i = p * C;
    const c = [rgb[i], rgb[i + 1], rgb[i + 2]];
    const a = clamp((groundLum - luminance(c)) / span, 0, 1);
    const o = p * 4;

    if (a <= 0.004) {
      // Nothing here. Write the ink colour anyway so that any resampler
      // blending this pixel into a neighbour pulls toward the mark rather
      // than toward an arbitrary black, which is what causes dark fringing.
      out[o] = ink[0];
      out[o + 1] = ink[1];
      out[o + 2] = ink[2];
      out[o + 3] = 0;
      continue;
    }

    // Unpremultiply: A = (C − B·(1 − a)) / a.
    for (let ch = 0; ch < 3; ch++) {
      out[o + ch] = clamp(Math.round((c[ch] - ground[ch] * (1 - a)) / a), 0, 255);
    }
    out[o + 3] = Math.round(a * 255);
  }

  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({
    compressionLevel: 9,
  });
}

/** Flatten a transparent mark back onto a solid ground. */
const onGround = (png, size, ground, pad) =>
  sharp(png)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .flatten({ background: { r: ground[0], g: ground[1], b: ground[2] } });

async function main() {
  const source = sharp(SOURCE);
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });

  const bounds = cardBounds(data, info);
  process.stdout.write(
    `source ${info.width}×${info.height} → card ${bounds.width}×${bounds.height} ` +
      `at ${bounds.left},${bounds.top}\n`,
  );

  const { data: cropped, info: croppedInfo } = await sharp(SOURCE)
    .extract({
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // The mark, transparent, at the source's own resolution. Nothing is upscaled
  // anywhere in this file: there is no detail to invent, and a soft logo reads
  // as a mistake where a small sharp one does not.
  const transparent = await keyToAlpha(cropped, croppedInfo, CARD, INK).toBuffer();
  await writeFile(path.join(ROOT, "public", "logo.png"), transparent);

  // The same mark in cream, for the dark sections and dark-mode email.
  const light = await sharp(transparent)
    .composite([
      {
        input: {
          create: {
            width: croppedInfo.width,
            height: croppedInfo.height,
            channels: 4,
            background: { r: SAND[0], g: SAND[1], b: SAND[2], alpha: 1 },
          },
        },
        blend: "in",
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(ROOT, "public", "logo-light.png"), light);

  // iOS ignores transparency and composites onto black, so this one keeps its
  // cream ground deliberately.
  await onGround(transparent, 180, CARD, 10)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, "public", "apple-touch-icon.png"));

  // The favicon keeps transparency: browsers render it on their own chrome.
  await sharp(transparent)
    .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, "src", "app", "icon.png"));

  // Social card. Cream ground, the mark centred. Sized to most of the card's
  // height rather than politely small: a timeline renders this a few hundred
  // pixels wide, and a small mark in a large field of cream reads as an empty
  // card. Slight upscaling here is fine — it is the one output nobody views
  // at full size.
  const markForCard = await sharp(transparent)
    .resize(430, 430, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: { r: CARD[0], g: CARD[1], b: CARD[2] },
    },
  })
    .composite([{ input: markForCard, gravity: "centre" }])
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(ROOT, "public", "og.jpg"));

  process.stdout.write("wrote logo.png, logo-light.png, apple-touch-icon.png, icon.png, og.jpg\n");
}

await mkdir(path.join(ROOT, "public"), { recursive: true });
await main();
