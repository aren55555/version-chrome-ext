import { execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync } from 'fs';

// Build the extension
console.log('Building extension...');
execSync('npm run build', { stdio: 'inherit' });

// Get version from manifest
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const version = manifest.version;
const zipName = `version-chrome-ext-v${version}.zip`;

// Remove existing zip if present
if (existsSync(zipName)) {
  unlinkSync(zipName);
}

// Create zip with required files
console.log(`\nPackaging ${zipName}...`);
execSync(`zip -r ${zipName} manifest.json popup.html options.html icons/ dist/`, {
  stdio: 'inherit',
});

console.log(`\nRelease package created: ${zipName}`);
