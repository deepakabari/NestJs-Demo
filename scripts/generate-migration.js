const { execSync } = require('child_process');
const name = process.argv[2];

if (!name) {
  console.error(
    'Error: Please provide a migration name. Usage: npm run migration:generate -- Name',
  );
  process.exit(1);
}

try {
  console.log(`🚀 Building and generating migration: ${name}...`);
  // The script automatically adds the path prefix
  const command = `npm run typeorm migration:generate src/database/migrations/${name}`;
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}
