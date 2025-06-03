// Cross-platform script to copy assets
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('Project root:', projectRoot);

// Ensure directories exist
function ensureDirectoryExists(dir) {
  console.log(`Checking if directory exists: ${dir}`);
  try {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Directory created successfully: ${dir}`);
        return true;
      } catch (err) {
        console.error(`ERROR: Failed to create directory: ${dir}`, err);
        return false;
      }
    } else {
      console.log(`Directory already exists: ${dir}`);
      // Check if we can write to the directory
      try {
        const testFile = path.join(dir, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`Directory is writable: ${dir}`);
        return true;
      } catch (err) {
        console.error(`ERROR: Directory exists but is not writable: ${dir}`, err);
        return false;
      }
    }
  } catch (err) {
    console.error(`ERROR: Failed to check if directory exists: ${dir}`, err);
    return false;
  }
}

// Copy file if it exists
function copyFileIfExists(src, dest) {
  console.log(`Checking if source file exists: ${src}`);
  try {
    const srcExists = fs.existsSync(src);
    console.log(`Source file exists: ${srcExists}`);
    
    if (srcExists) {
      // Check source file stats
      try {
        const srcStats = fs.statSync(src);
        console.log(`Source file size: ${srcStats.size} bytes`);
        
        console.log(`Attempting to copy: ${src} -> ${dest}`);
        try {
          // First remove the destination file if it exists
          if (fs.existsSync(dest)) {
            console.log(`Destination file already exists, removing it: ${dest}`);
            fs.unlinkSync(dest);
          }
          
          // Now copy the file
          fs.copyFileSync(src, dest);
          
          // Verify the file was copied correctly
          if (fs.existsSync(dest)) {
            const destStats = fs.statSync(dest);
            console.log(`Destination file size: ${destStats.size} bytes`);
            
            if (srcStats.size === destStats.size) {
              console.log(`SUCCESS: File copied successfully: ${path.basename(src)} (${destStats.size} bytes)`);
              return true;
            } else {
              console.error(`ERROR: File copied but size mismatch: ${src} (${srcStats.size} bytes) vs ${dest} (${destStats.size} bytes)`);
              return false;
            }
          } else {
            console.error(`ERROR: Failed to copy file - destination does not exist after copy: ${dest}`);
            return false;
          }
        } catch (err) {
          console.error(`ERROR: Failed to copy file: ${src} -> ${dest}`, err);
          return false;
        }
      } catch (err) {
        console.error(`ERROR: Failed to get source file stats: ${src}`, err);
        return false;
      }
    } else {
      console.error(`ERROR: Source file does not exist: ${src}`);
      return false;
    }
  } catch (err) {
    console.error(`ERROR: Failed to check if source file exists: ${src}`, err);
    return false;
  }
}

// Main function
function copyAssets() {
  try {
    console.log('Starting to copy assets...');
    let success = true;
    
    // Set paths
    const publicAssetsDir = path.resolve(projectRoot, 'public/assets');
    const sourceModelPath = path.resolve(projectRoot, 'debug/Sketchbook-master/build/assets/boxman.glb');
    const destModelPath = path.join(publicAssetsDir, 'boxman.glb');
    
    console.log('Paths:');
    console.log('- Public assets dir:', publicAssetsDir);
    console.log('- Source model path:', sourceModelPath);
    console.log('- Destination model path:', destModelPath);
    
    // Create directories
    const dirResult = ensureDirectoryExists(publicAssetsDir);
    console.log('Directory creation result:', dirResult);
    
    if (!dirResult) {
      console.error('CRITICAL ERROR: Failed to create/access assets directory');
      process.exit(1);
    }
    
    // Copy boxman.glb
    console.log('--------- COPYING BOXMAN.GLB ---------');
    const boxmanResult = copyFileIfExists(sourceModelPath, destModelPath);
    console.log('Boxman copy result:', boxmanResult);
    
    if (!boxmanResult) {
      success = false;
      console.error('CRITICAL ERROR: Failed to copy boxman.glb');
    }
    
    // Check if boxman.glb exists in the destination
    try {
      const exists = fs.existsSync(destModelPath);
      console.log(`FINAL VERIFICATION: boxman.glb exists at destination: ${exists}`);
      
      if (exists) {
        const stats = fs.statSync(destModelPath);
        console.log(`FINAL VERIFICATION: File size: ${stats.size} bytes`);
      } else {
        console.error(`FINAL VERIFICATION FAILED: boxman.glb does not exist at destination: ${destModelPath}`);
        success = false;
      }
    } catch (err) {
      console.error('FINAL VERIFICATION ERROR:', err);
      success = false;
    }
    
    if (success) {
      console.log('Assets copied successfully');
    } else {
      console.error('Failed to copy some assets');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
  }
}

// Run the copy function
copyAssets(); 