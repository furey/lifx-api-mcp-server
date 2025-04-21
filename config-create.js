#!/usr/bin/env node

import { join, dirname, extname, resolve } from 'path'
import stripJsonComments from 'strip-json-comments'
import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// --- Helper Function to Extract Config from README ---
const extractConfigFromReadme = async () => {
  try {
    const possiblePaths = [
      join(__dirname, 'README.md'),
      join(__dirname, '..', 'README.md'),
      join(process.cwd(), 'README.md')
    ]

    let readmeContent = null
    let readmePath = null

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        readmeContent = await readFile(path, 'utf8')
        readmePath = path
        console.log(`Found README.md at: ${readmePath}`)
        break
      }
    }

    if (!readmeContent) {
      throw new Error(`README.md not found in expected locations: ${possiblePaths.join(', ')}`)
    }

    // Regex to find the example config block specifically for LIFX README
    const configRegex = /Example configuration file \(`~\/\.lifx-api-mcp-server\.jsonc`\)[\s\S]*?```jsonc\s*([\s\S]*?)```/
    const match = readmeContent.match(configRegex)

    if (!match || !match[1]) {
      throw new Error('Could not find example configuration block in README.md. Ensure the header and jsonc code block exist as expected.')
    }

    // Remove the caching parts from the extracted content before returning
    let configString = match[1].trim()
    configString = configString.replace(/^\s*\/\/ --- Optional: Caching ---[\s\S]*?\/\/ "cacheTTL":.*?\},?\s*/m, '')

    return configString
  } catch (error) {
    console.error('Error extracting configuration from README.md:', error.message)
    throw error
  }
}
// --- End Helper Function ---


const run = async () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE
  const defaultConfigFile = '.lifx-api-mcp-server.jsonc'
  let configPath = process.env.CONFIG_PATH || join(homeDir, defaultConfigFile)

  if (!extname(configPath)) {
      try {
        const stats = await stat(configPath)
        if (stats.isDirectory()) {
            configPath = join(configPath, defaultConfigFile)
        } else if (!extname(configPath)) {
           configPath = configPath + '.jsonc'
        }
      } catch (e) {
         if (!extname(configPath)) {
            configPath = configPath + '.jsonc'
         }
      }
  }

  if (!configPath.endsWith('.json') && !configPath.endsWith('.jsonc')) {
    console.error(`Error: Configuration file path must end with .json or .jsonc. Provided: ${configPath}`)
    process.exit(1)
  }

  configPath = resolve(configPath)
  const configDir = dirname(configPath)

  try {
    if (!existsSync(configDir)) {
        console.log(`Creating directory: ${configDir}`)
        await mkdir(configDir, { recursive: true })
    }

    const configContent = await extractConfigFromReadme()

    if (existsSync(configPath)) {
      const overwrite = process.argv.includes('--force')
      if (!overwrite) {
        console.log(`Configuration file already exists at: ${configPath}`)
        console.log('Use --force to overwrite it.')
        return
      }
      console.log(`Overwriting existing configuration file at: ${configPath}`)
    }

    let finalContent = configContent
    if (configPath.endsWith('.json')) {
        finalContent = stripJsonComments(finalContent)
    }

    finalContent = finalContent
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n') + '\n'

    await writeFile(configPath, finalContent, 'utf8')
    console.log(`Configuration file created successfully at: ${configPath}`)

  } catch (error) {
    console.error('Error creating configuration file:', error.message)
    process.exit(1)
  }
}

run()
