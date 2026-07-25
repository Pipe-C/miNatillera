import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

const svg192 = readFileSync(resolve(publicDir, 'icon-192.svg'))
const svg512 = readFileSync(resolve(publicDir, 'icon-512.svg'))

async function generate() {
  await sharp(svg192)
    .resize(192, 192)
    .png()
    .toFile(resolve(publicDir, 'icon-192.png'))

  console.log('Generated icon-192.png')

  await sharp(svg512)
    .resize(512, 512)
    .png()
    .toFile(resolve(publicDir, 'icon-512.png'))

  console.log('Generated icon-512.png')
}

generate().catch(err => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
