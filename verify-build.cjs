const path = require('path');
const fs = require('fs');

// Check if the build command would run
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  console.log("The 'dist' directory doesn't exist - build would run");
} else {
  console.log("The 'dist' directory exists, you wouldn't need to build again");
  
  // Check for index.html and JS files
  const indexPath = path.join(__dirname, 'dist', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log("The index.html file exists in the build directory");
    
    // Check if it contains basic HTML structure
    const content = fs.readFileSync(indexPath, 'utf8');
    if (content.includes('<html') && content.includes('<body') && content.includes('<script')) {
      console.log("index.html appears to be a valid HTML file with basic structure");
    } else {
      console.log("index.html may be incomplete or invalid");
    }
  } else {
    console.log("ERROR: index.html is missing from the build directory!");
  }
  
  // Look for JS files
  const jsFiles = fs.readdirSync(path.join(__dirname, 'dist', 'public', 'assets'))
    .filter(file => file.endsWith('.js'));
  
  if (jsFiles.length > 0) {
    console.log(`Found ${jsFiles.length} JS files in the assets directory`);
  } else {
    console.log("ERROR: No JS files found in assets directory!");
  }
}

// Check if package.json has a build script
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
if (packageJson.scripts && packageJson.scripts.build) {
  console.log(`Build script exists in package.json: ${packageJson.scripts.build}`);
} else {
  console.log("WARNING: No build script found in package.json!");
}
