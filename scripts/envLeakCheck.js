const fs = require('fs');
const path = require('path');

const filesToCheck = ['.env', '.env.production', 'admin-backend/.env'];
const gitignorePath = path.resolve('.gitignore');

try {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

  filesToCheck.forEach((file) => {
    const isIgnored = gitignoreContent.includes(file);

    if (!isIgnored) {
      console.warn(`\x1b[31m🚨 SECURITY WARNING: "${file}" is NOT ignored in .gitignore!\x1b[0m`);
      process.exit(1);
    }
  });

  console.log('✅ .env files are safely ignored in .gitignore');

} catch (err) {
  console.error('❌ Error checking .gitignore:', err.message);
  process.exit(1);
}
