const { minify } = require('terser');
const fs = require('fs');
const path = require('path');

const JS_FILES = [
    'utils.js',
    'toast.js',
    'analytics.js',
    'animations.js',
    'landingPage.js',
    'mobileMenu.js',
    'marketRadar.js',
    'analyzer.js',
    'avg.js',
    'araarb.js',
    'profit.js',
    'positionSize.js',
    'dividend.js',
    'shareImage.js',
    'pwa-install.js',
    'sw.js'
];

const DIST_DIR = path.join(__dirname, 'dist', 'js');

async function build() {
    // Create dist directory
    fs.mkdirSync(DIST_DIR, { recursive: true });

    let totalOriginal = 0;
    let totalMinified = 0;

    for (const file of JS_FILES) {
        const srcPath = path.join(__dirname, file);
        const distPath = path.join(DIST_DIR, file);

        if (!fs.existsSync(srcPath)) {
            console.warn(`  SKIP  ${file} (not found)`);
            continue;
        }

        const code = fs.readFileSync(srcPath, 'utf8');
        const result = await minify(code, {
            compress: {
                drop_console: true,
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        });

        fs.writeFileSync(distPath, result.code);

        const origSize = Buffer.byteLength(code, 'utf8');
        const minSize = Buffer.byteLength(result.code, 'utf8');
        totalOriginal += origSize;
        totalMinified += minSize;

        const savings = ((1 - minSize / origSize) * 100).toFixed(1);
        console.log(`  OK    ${file.padEnd(20)} ${(origSize / 1024).toFixed(1)}KB -> ${(minSize / 1024).toFixed(1)}KB  (-${savings}%)`);
    }

    console.log('');
    console.log(`  Total: ${(totalOriginal / 1024).toFixed(1)}KB -> ${(totalMinified / 1024).toFixed(1)}KB  (-${((1 - totalMinified / totalOriginal) * 100).toFixed(1)}%)`);
    console.log(`  Output: ${DIST_DIR}`);
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
