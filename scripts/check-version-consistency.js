#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Vérifie la cohérence des versions dans le monorepo
 * - Compare les versions des packages avec leurs dépendances internes
 * - Vérifie que les versions sont cohérentes
 * - Affiche les incohérences potentielles
 */

function readPackageJson(path) {
  try {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Impossible de lire ${path}:`, error.message);
    return null;
  }
}

function getPackageVersion(packageName, packages) {
  for (const pkg of packages) {
    if (pkg.name === packageName) {
      return pkg.version;
    }
  }
  return null;
}

function checkInternalDependencies(packageJson, packages) {
  const issues = [];
  const { name, version, dependencies = {}, devDependencies = {} } = packageJson;
  
  const allDeps = { ...dependencies, ...devDependencies };
  
  for (const [depName, depVersion] of Object.entries(allDeps)) {
    if (depName.startsWith('@n8n-as-code/')) {
      const actualVersion = getPackageVersion(depName, packages);
      if (actualVersion) {
        // Extraire la version spécifiée (sans ^ ou ~)
        const specifiedVersion = depVersion.replace(/^[\^~]/, '');
        
        if (specifiedVersion !== actualVersion) {
          issues.push({
            package: name,
            dependency: depName,
            specified: depVersion,
            actual: actualVersion,
            message: `La dépendance ${depName} spécifie ${depVersion} mais le package est en version ${actualVersion}`
          });
        }
      }
    }
  }
  
  return issues;
}

async function main() {
  console.log('🔍 Vérification de la cohérence des versions dans le monorepo...\n');
  
  // Lire tous les package.json
  const packages = [
    { path: join(rootDir, 'package.json'), name: 'monorepo' },
    { path: join(rootDir, 'packages/core/package.json'), name: '@n8n-as-code/core' },
    { path: join(rootDir, 'packages/cli/package.json'), name: '@n8n-as-code/cli' },
    { path: join(rootDir, 'packages/agent-cli/package.json'), name: '@n8n-as-code/agent-cli' },
    { path: join(rootDir, 'packages/vscode-extension/package.json'), name: 'n8n-as-code' },
  ];
  
  const packageData = packages.map(pkg => ({
    ...pkg,
    data: readPackageJson(pkg.path)
  })).filter(pkg => pkg.data !== null);
  
  // Afficher les versions actuelles
  console.log('📦 Versions actuelles des packages:');
  packageData.forEach(({ name, data }) => {
    if (data.version) {
      console.log(`  ${name}: ${data.version}`);
    }
  });
  
  console.log('\n🔗 Vérification des dépendances internes...');
  
  let hasIssues = false;
  const allPackages = packageData
    .filter(pkg => pkg.data.name && pkg.data.version)
    .map(pkg => ({ name: pkg.data.name, version: pkg.data.version }));
  
  for (const pkg of packageData) {
    if (pkg.data.dependencies || pkg.data.devDependencies) {
      const issues = checkInternalDependencies(pkg.data, allPackages);
      
      if (issues.length > 0) {
        hasIssues = true;
        console.log(`\n⚠️  Incohérences dans ${pkg.name}:`);
        issues.forEach(issue => {
          console.log(`  • ${issue.message}`);
        });
      }
    }
  }
  
  if (!hasIssues) {
    console.log('✅ Toutes les dépendances internes sont cohérentes!');
  }
  
  // Vérifier la configuration Changeset
  console.log('\n📋 Configuration Changeset:');
  const changesetConfig = readPackageJson(join(rootDir, '.changeset/config.json'));
  if (changesetConfig) {
    console.log(`  • fixed: ${JSON.stringify(changesetConfig.fixed)}`);
    console.log(`  • linked: ${JSON.stringify(changesetConfig.linked)}`);
    console.log(`  • updateInternalDependencies: ${changesetConfig.updateInternalDependencies}`);
    
    if (changesetConfig.fixed.length === 0 && changesetConfig.linked.length === 0) {
      console.log('  ✅ Configuration pour versionnement indépendant (option A)');
    }
  }
  
  console.log('\n💡 Recommandations:');
  console.log('  1. Utilisez "npx changeset add" pour déclarer les modifications');
  console.log('  2. Changeset mettra à jour automatiquement les dépendances internes');
  console.log('  3. Exécutez "npm run version-packages" pour appliquer les versions');
  console.log('  4. Le workflow GitHub publiera les packages de manière cohérente');
  
  if (hasIssues) {
    console.log('\n❌ Des incohérences ont été détectées.');
    console.log('   Exécutez "npm run version-packages" pour les corriger automatiquement.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Erreur lors de la vérification:', error);
  process.exit(1);
});