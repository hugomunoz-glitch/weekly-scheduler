import sharp from 'sharp'
import fs from 'fs'

const svg = fs.readFileSync('./public/icon.svg', 'utf8')
const svgBuffer = Buffer.from(svg)

await sharp(svgBuffer).resize(512, 512).png().toFile('./public/icon-512.png')
await sharp(svgBuffer).resize(192, 192).png().toFile('./public/icon-192.png')
await sharp(svgBuffer).resize(180, 180).png().toFile('./public/apple-touch-icon.png')

console.log('Icons generated')
