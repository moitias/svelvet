/* eslint-disable no-console */
import * as util from 'util';
import { exec as execSync } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import * as path from 'path';
import * as svelte from 'svelte/compiler';
import * as chokidar from 'chokidar';
import * as babel from '@babel/core';
import * as glob from 'glob';
import * as terser from 'terser';
import pLimit from 'p-limit';
import * as servor from 'servor';
import * as rimraf from 'rimraf';

const exec = util.promisify(execSync);

const IS_PRODUCTION_MODE = process.env.NODE_ENV === 'production';

// Check for and load a custom babel config file
const BABEL_CONFIG = existsSync('./babel.config.js')
    ? require(path.join(process.cwd(), 'babel.config.js'))
    : {
          plugins: [
              [
                  'snowpack/assets/babel-plugin.js',
                  {
                      // Append .js to all src file imports
                      optionalExtensions: true,
                      importMap: '../dist/web_modules/import-map.json',
                  },
              ],
          ],
      };

async function cleanDist(): Promise<void> {
    if (process.argv.includes('--no-clean')) return;
    await new Promise(resolve => rimraf('dist', resolve));
}

async function compile(
    srcPath: string
): Promise<{
    destPath: string | null;
    logSvelteWarnings: () => void;
}> {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    let logSvelteWarnings = (): void => {};

    try {
        const source = await fs.readFile(srcPath, 'utf8');
        const isSvelte = srcPath.endsWith('.svelte');

        let newSource = source;
        // Only compile svelte files
        if (isSvelte) {
            const result = svelte.compile(source, {
                // https://svelte.dev/docs#Compile_time
                filename: srcPath,
                dev: !IS_PRODUCTION_MODE,
                hydratable: process.argv.includes('--hydratable'),
                immutable: process.argv.includes('--immutable'),
            });

            logSvelteWarnings = (): void => {
                result.warnings.forEach(warning => {
                    console.log('');
                    console.warn(
                        '\x1b[33m%s\x1b[0m',
                        `SVELTE WARNING (${warning.filename}) -> ${warning.message}`
                    );
                    console.warn(warning.frame);
                });
            };

            newSource = result.js.code;
        }

        const destPath = srcPath
            .replace(/^src\//, 'dist/')
            .replace(/.svelte$/, '.js');
        // Create all ancestor directories for this file
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, newSource);

        console.info(`Svelte compiled ${destPath}`);

        return {
            destPath,
            logSvelteWarnings,
        };
    } catch (err) {
        console.log('');
        console.error(`Failed to compile with svelte: ${srcPath}`);
        console.error(err);
        console.log('');
        return {
            destPath: null,
            logSvelteWarnings,
        };
    }
}

async function copyFile(srcPath: string): Promise<void> {
    const destPath = srcPath.replace(/^src\//, 'dist/');
    // Create all ancestor directories for this file
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
    console.info(`Copied asset ${destPath}`);
}

// Update the import paths to correctly point to web_modules.
async function transform(destPath: string): Promise<void> {
    try {
        const source = await fs.readFile(destPath, 'utf8');

        const transformed = (await babel.transformAsync(
            source,
            BABEL_CONFIG
        )) as babel.BabelFileResult;

        await fs.writeFile(destPath, transformed.code);
        console.info(`Babel transformed ${destPath}`);
    } catch (err) {
        console.log('');
        console.error(`Failed to transform with babel: ${destPath}`);
        console.error(err);
        console.log('');
    }
}

// Minify file with terser.
async function minify(destPath: string): Promise<void> {
    try {
        const source = await fs.readFile(destPath, 'utf8');

        const result = terser.minify(source, {
            module: true,
        });

        await fs.writeFile(destPath, result.code);
        console.info(`Terser minified ${destPath}`);
    } catch (err) {
        console.log('');
        console.error(`Failed to minify with terser: ${destPath}`);
        console.error(err);
        console.log('');
    }
}

// Only needs to run during the initial compile cycle. If a developer adds a new package dependency,
// they should restart svelvet.
const snowpack = async (): Promise<void> => {
    const maybeOptimize = IS_PRODUCTION_MODE ? '--optimize' : '';

    console.info(`\nBuilding web_modules with snowpack...`);

    try {
        const snowpackLocation = path.resolve(
            require.resolve('snowpack'),
            '../index.bin.js'
        );

        const { stdout, stderr } = await exec(
            `${snowpackLocation} --include 'dist/**/*' --dest dist/web_modules ${maybeOptimize}`
        );

        // TODO: hide behind --verbose flag
        // Show any output from snowpack...
        stdout && console.info(stdout);
        stderr && console.info(stderr);
    } catch (err) {
        console.log('');
        console.error('Failed to build with snowpack');
        console.error(err.stderr || err);
        // Don't continue trying to build if snowpack fails.
        process.exit(1);
    }
};

async function initialBuild(): Promise<void> {
    if (IS_PRODUCTION_MODE) console.info(`Building in production mode...`);

    const concurrencyLimit = pLimit(8);
    const globConfig = { nodir: true };
    const svelteAndJsFiles = glob.sync(
        'src/**/!(*+(spec|test)).+(js|mjs|svelte)',
        globConfig
    );
    const otherAssetFiles = glob.sync(
        'src/**/*.!(spec.[tj]s|test.[tj]s|[tj]s|mjs|svelte)',
        globConfig
    );

    // Just copy all other asset types, no point in reading them.
    await Promise.all(
        otherAssetFiles.map(srcPath =>
            concurrencyLimit(async () => copyFile(srcPath))
        )
    );

    // Compile all source files with svelte.
    const svelteWarnings: Array<() => void> = [];
    const destFiles = await Promise.all(
        svelteAndJsFiles.map(srcPath =>
            concurrencyLimit(async () => {
                const { destPath, logSvelteWarnings } = await compile(srcPath);
                svelteWarnings.push(logSvelteWarnings);
                return destPath;
            })
        )
    );

    // Need to run this (only once) before transforming the import paths, or else it will fail.
    await snowpack();

    // Transform all generated js files with babel.
    await Promise.all(
        destFiles.map(destPath =>
            concurrencyLimit(async () => {
                if (!destPath) return;
                await transform(destPath);
            })
        )
    );

    // Minify js files with terser if in production.
    if (IS_PRODUCTION_MODE && !process.argv.includes('--no-minify')) {
        await Promise.all(
            destFiles.map(destPath =>
                concurrencyLimit(async () => {
                    if (!destPath) return;
                    await minify(destPath);
                })
            )
        );
    }

    // Log all svelte warnings
    svelteWarnings.forEach(f => f());
}

function startWatchMode(): void {
    console.info(`Watching for files...`);

    const handleFile = async (srcPath: string): Promise<void> => {
        // Copy updated non-js/svelte files
        if (
            !srcPath.endsWith('.svelte') &&
            !srcPath.endsWith('.js') &&
            !srcPath.endsWith('.mjs')
        ) {
            copyFile(srcPath);
            return;
        }

        const { destPath, logSvelteWarnings } = await compile(srcPath);
        if (!destPath) return;
        await transform(destPath);
        logSvelteWarnings();
    };

    const srcWatcher = chokidar.watch('src', {
        ignored: /(^|[/\\])\../, // Ignore dotfiles
        ignoreInitial: true, // Don't fire "add" events when starting the watcher
    });

    srcWatcher.on('add', handleFile);
    srcWatcher.on('change', handleFile);
}

async function startDevServer(): Promise<void> {
    if (process.argv.includes('--no-serve')) return;
    const { url } = await servor({
        root: './dist',
        fallback: 'index.html',
        port: 8080,
        reload: true,
    });
    console.info(`Server running on ${url}`);
}

async function main(): Promise<void> {
    await cleanDist();
    await initialBuild();
    if (IS_PRODUCTION_MODE) return;
    startWatchMode();
    startDevServer();
}

main();
