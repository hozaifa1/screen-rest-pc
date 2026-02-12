// Comprehensive icon generator for ScreenRest
// Generates all tray base PNGs, build/icon.ico, build/icon.icns, and appx assets
// from the new screenrest.svg and screenrest-dark.svg designs.
//
// Usage: node graphics/generate-all-icons.js
// Requires: sharp (npm install sharp --save-dev)

import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TRAY_DIR = path.join(__dirname, '../app/images/app-icons')
const BUILD_DIR = path.join(__dirname, '../build')
const APPX_DIR = path.join(BUILD_DIR, 'appx')
const IMAGES_DIR = path.join(__dirname, '../app/images')

// Source SVGs
const lightSvg = fs.readFileSync(path.join(IMAGES_DIR, 'screenrest.svg'))
const darkSvg = fs.readFileSync(path.join(IMAGES_DIR, 'screenrest-dark.svg'))

// ===================== SVG TEMPLATES =====================

function monochromeBlackSvg () {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="#000000"/>
    <rect x="14" y="12" width="36" height="26" rx="3" fill="#ffffff"/>
    <rect x="26" y="38" width="12" height="3" rx="1" fill="#ffffff" opacity="0.8"/>
    <rect x="22" y="41" width="20" height="2.5" rx="1.25" fill="#ffffff" opacity="0.6"/>
    <path d="M36 20 A7 7 0 1 0 36 32 A5 5 0 1 1 36 20Z" fill="#000000"/>
    <circle cx="39" cy="20.5" r="1.5" fill="#ffffff"/>
    <circle cx="37.5" cy="17.5" r="0.9" fill="#ffffff" opacity="0.7"/>
    <circle cx="41.5" cy="23" r="0.7" fill="#ffffff" opacity="0.5"/>
    <rect x="14" y="48" width="36" height="5" rx="2.5" fill="#000000" opacity="0.3"/>
    <circle cx="20" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
    <circle cx="24" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
    <circle cx="28" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
</svg>`)
}

function monochromeGraySvg () {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="#8c8c8c"/>
    <rect x="14" y="12" width="36" height="26" rx="3" fill="#ffffff"/>
    <rect x="26" y="38" width="12" height="3" rx="1" fill="#ffffff" opacity="0.8"/>
    <rect x="22" y="41" width="20" height="2.5" rx="1.25" fill="#ffffff" opacity="0.6"/>
    <path d="M36 20 A7 7 0 1 0 36 32 A5 5 0 1 1 36 20Z" fill="#8c8c8c"/>
    <circle cx="39" cy="20.5" r="1.5" fill="#ffffff"/>
    <circle cx="37.5" cy="17.5" r="0.9" fill="#ffffff" opacity="0.7"/>
    <circle cx="41.5" cy="23" r="0.7" fill="#ffffff" opacity="0.5"/>
    <rect x="14" y="48" width="36" height="5" rx="2.5" fill="#8c8c8c" opacity="0.3"/>
    <circle cx="20" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
    <circle cx="24" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
    <circle cx="28" cy="50.5" r="1" fill="#ffffff" opacity="0.4"/>
</svg>`)
}

function pauseBarsSvg (barColor) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="16" width="8" height="32" rx="2" fill="${barColor}"/>
    <rect x="36" y="16" width="8" height="32" rx="2" fill="${barColor}"/>
</svg>`)
}

// ===================== RENDERING =====================

async function renderSvgToPng (svgBuffer, size) {
  return sharp(svgBuffer, { density: Math.round(72 * size / 64 * 4) })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function createPausedVersion (basePng, size, barColor) {
  // Dim the base by multiplying alpha by ~0.5
  const dimMask = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } }
  }).png().toBuffer()

  const dimmed = await sharp(basePng)
    .composite([{ input: dimMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  // Render pause bars
  const barsBuffer = await renderSvgToPng(pauseBarsSvg(barColor), size)

  // Composite pause bars on dimmed base
  return sharp(dimmed)
    .composite([{ input: barsBuffer, blend: 'over' }])
    .png()
    .toBuffer()
}

// ===================== TRAY ICONS =====================

async function generateTrayIcons () {
  console.log('Generating tray base icons...')

  const monoBlack = monochromeBlackSvg()
  const monoGray = monochromeGraySvg()

  // Render base icons at needed sizes
  const light32 = await renderSvgToPng(lightSvg, 32)
  const light16 = await renderSvgToPng(lightSvg, 16)
  const dark32 = await renderSvgToPng(darkSvg, 32)
  const dark16 = await renderSvgToPng(darkSvg, 16)
  const monoB32 = await renderSvgToPng(monoBlack, 32)
  const monoB16 = await renderSvgToPng(monoBlack, 16)
  const monoG32 = await renderSvgToPng(monoGray, 32)

  // Create paused versions
  const lightPaused32 = await createPausedVersion(light32, 32, '#000000')
  const lightPaused16 = await createPausedVersion(light16, 16, '#000000')
  const darkPaused32 = await createPausedVersion(dark32, 32, '#D6D6D6')
  const darkPaused16 = await createPausedVersion(dark16, 16, '#D6D6D6')
  const monoBPaused32 = await createPausedVersion(monoB32, 32, '#000000')
  const monoBPaused16 = await createPausedVersion(monoB16, 16, '#000000')
  const monoGPaused32 = await createPausedVersion(monoG32, 32, '#D6D6D6')

  // Write all tray base files
  const files = {
    // Colour - Windows
    'tray.png': light32,
    'trayDark.png': dark32,
    'trayPaused.png': lightPaused32,
    'trayPausedDark.png': darkPaused32,
    // Colour - Mac
    'trayMac.png': light16,
    'trayMac@2x.png': light32,
    'trayMacDark.png': dark16,
    'trayMacDark@2x.png': dark32,
    'trayMacPaused.png': lightPaused16,
    'trayMacPaused@2x.png': lightPaused32,
    'trayMacPausedDark.png': darkPaused16,
    'trayMacPausedDark@2x.png': darkPaused32,
    // Monochrome - Windows
    'trayMonochrome.png': monoB32,
    'trayMonochromeInverted.png': monoG32,
    'trayMonochromePaused.png': monoBPaused32,
    'trayMonochromeInvertedPaused.png': monoGPaused32,
    // Monochrome - Mac
    'trayMacMonochromeTemplate.png': monoB16,
    'trayMacMonochromeTemplate@2x.png': monoB32,
    'trayMacMonochromePausedTemplate.png': monoBPaused16,
    'trayMacMonochromePausedTemplate@2x.png': monoBPaused32
  }

  for (const [name, buffer] of Object.entries(files)) {
    fs.writeFileSync(path.join(TRAY_DIR, name), buffer)
    console.log(`  Created ${name}`)
  }

  console.log('Tray base icons generated!')
}

// ===================== ICO / ICNS =====================

function createIcoFile (pngBuffers) {
  const numImages = pngBuffers.length
  const headerSize = 6
  const entrySize = 16
  let dataOffset = headerSize + numImages * entrySize

  const entries = []
  for (const { size, buffer } of pngBuffers) {
    entries.push({
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      dataSize: buffer.length,
      dataOffset
    })
    dataOffset += buffer.length
  }

  const totalSize = dataOffset
  const ico = Buffer.alloc(totalSize)

  // Header
  ico.writeUInt16LE(0, 0) // Reserved
  ico.writeUInt16LE(1, 2) // Type: ICO
  ico.writeUInt16LE(numImages, 4)

  let offset = 6
  for (const entry of entries) {
    ico.writeUInt8(entry.width, offset)
    ico.writeUInt8(entry.height, offset + 1)
    ico.writeUInt8(0, offset + 2) // Color palette
    ico.writeUInt8(0, offset + 3) // Reserved
    ico.writeUInt16LE(1, offset + 4) // Color planes
    ico.writeUInt16LE(32, offset + 6) // Bits per pixel
    ico.writeUInt32LE(entry.dataSize, offset + 8)
    ico.writeUInt32LE(entry.dataOffset, offset + 12)
    offset += entrySize
  }

  for (const { buffer } of pngBuffers) {
    buffer.copy(ico, offset)
    offset += buffer.length
  }

  return ico
}

function createIcnsFile (pngEntries) {
  const magic = Buffer.from('icns')
  let totalDataSize = 8

  const entryBuffers = []
  for (const { type, buffer } of pngEntries) {
    const typeBuffer = Buffer.from(type)
    const sizeBuffer = Buffer.alloc(4)
    sizeBuffer.writeUInt32BE(8 + buffer.length)
    entryBuffers.push(Buffer.concat([typeBuffer, sizeBuffer, buffer]))
    totalDataSize += 8 + buffer.length
  }

  const fileSizeBuffer = Buffer.alloc(4)
  fileSizeBuffer.writeUInt32BE(totalDataSize)

  return Buffer.concat([magic, fileSizeBuffer, ...entryBuffers])
}

// ===================== BUILD ICONS =====================

async function generateBuildIcons () {
  console.log('Generating build icons...')

  // ICO with multiple sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoPngs = []
  for (const size of icoSizes) {
    const buffer = await renderSvgToPng(lightSvg, size)
    icoPngs.push({ size, buffer })
  }

  const icoBuffer = createIcoFile(icoPngs)
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer)
  console.log('  Created icon.ico')

  // ICNS with multiple sizes (PNG-embedded, supported since macOS 10.7)
  const icnsTypes = [
    { type: 'icp4', size: 16 },
    { type: 'icp5', size: 32 },
    { type: 'icp6', size: 64 },
    { type: 'ic07', size: 128 },
    { type: 'ic08', size: 256 },
    { type: 'ic09', size: 512 },
    { type: 'ic10', size: 1024 }
  ]

  const icnsEntries = []
  for (const { type, size } of icnsTypes) {
    const buffer = await renderSvgToPng(lightSvg, size)
    icnsEntries.push({ type, buffer })
  }

  const icnsBuffer = createIcnsFile(icnsEntries)
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.icns'), icnsBuffer)
  console.log('  Created icon.icns')

  // AppX assets
  const appxAssets = [
    { name: 'Square44x44Logo.png', size: 44 },
    { name: 'Square150x150Logo.png', size: 150 },
    { name: 'StoreLogo.png', size: 50 }
  ]

  for (const { name, size } of appxAssets) {
    const buffer = await renderSvgToPng(lightSvg, size)
    fs.writeFileSync(path.join(APPX_DIR, name), buffer)
    console.log(`  Created appx/${name}`)
  }

  // Wide310x150Logo - center the icon on teal background
  const wideWidth = 310
  const wideHeight = 150
  const iconSize = wideHeight - 20
  const iconPng = await renderSvgToPng(lightSvg, iconSize)

  const wideLogo = await sharp({
    create: {
      width: wideWidth,
      height: wideHeight,
      channels: 4,
      background: { r: 38, g: 166, b: 154, alpha: 1 }
    }
  })
    .composite([{ input: iconPng, gravity: 'centre' }])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(APPX_DIR, 'Wide310x150Logo.png'), wideLogo)
  console.log('  Created appx/Wide310x150Logo.png')

  // Installer sidebar BMP (164x314) - ScreenRest logo centered on teal background
  const sideW = 164
  const sideH = 314
  const sideIconSize = sideW - 30
  const sideIconPng = await renderSvgToPng(lightSvg, sideIconSize)

  const sidebarPng = await sharp({
    create: {
      width: sideW,
      height: sideH,
      channels: 3,
      background: { r: 38, g: 166, b: 154, alpha: 1 }
    }
  })
    .composite([{
      input: sideIconPng,
      left: Math.round((sideW - sideIconSize) / 2),
      top: Math.round((sideH - sideIconSize) / 2)
    }])
    .toFormat('png')
    .toBuffer()

  // Convert to 24-bit BMP manually
  const { data, info } = await sharp(sidebarPng)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const bmpBuffer = createBmp24(data, info.width, info.height)
  fs.writeFileSync(path.join(BUILD_DIR, 'installerSidebar.bmp'), bmpBuffer)
  console.log('  Created installerSidebar.bmp')

  console.log('Build icons generated!')
}

function createBmp24 (rawRgb, width, height) {
  const rowSize = Math.ceil(width * 3 / 4) * 4 // rows padded to 4-byte boundary
  const pixelDataSize = rowSize * height
  const fileSize = 54 + pixelDataSize // 14 (file header) + 40 (info header) + pixel data

  const buf = Buffer.alloc(fileSize)

  // BMP File Header (14 bytes)
  buf.write('BM', 0) // Signature
  buf.writeUInt32LE(fileSize, 2)
  buf.writeUInt32LE(0, 6) // Reserved
  buf.writeUInt32LE(54, 10) // Pixel data offset

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 14) // Header size
  buf.writeInt32LE(width, 18)
  buf.writeInt32LE(height, 22) // Positive = bottom-up
  buf.writeUInt16LE(1, 26) // Color planes
  buf.writeUInt16LE(24, 28) // Bits per pixel
  buf.writeUInt32LE(0, 30) // Compression (none)
  buf.writeUInt32LE(pixelDataSize, 34)
  buf.writeInt32LE(2835, 38) // H resolution (72 DPI)
  buf.writeInt32LE(2835, 42) // V resolution
  buf.writeUInt32LE(0, 46) // Colors in palette
  buf.writeUInt32LE(0, 50) // Important colors

  // Pixel data (bottom-up, BGR)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 3 // BMP is bottom-up
    const dstRow = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const srcIdx = srcRow + x * 3
      const dstIdx = dstRow + x * 3
      buf[dstIdx] = rawRgb[srcIdx + 2] // B
      buf[dstIdx + 1] = rawRgb[srcIdx + 1] // G
      buf[dstIdx + 2] = rawRgb[srcIdx] // R
    }
  }

  return buf
}

// ===================== MAIN =====================

async function main () {
  console.log('ScreenRest Icon Generator')
  console.log('=========================\n')

  await generateTrayIcons()
  console.log('')
  await generateBuildIcons()

  console.log('\n=========================')
  console.log('All icons generated successfully!')
  console.log('\nNext step: Regenerate tray overlay icons (number/progress):')
  console.log('  node graphics/time-intray-icon-generator.js')
}

main().catch(console.error)
