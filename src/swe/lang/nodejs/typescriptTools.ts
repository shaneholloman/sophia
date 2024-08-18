import { existsSync, readFileSync } from 'node:fs';
import { join } from 'path';
import { getFileSystem } from '#agent/agentContext';
import { func, funcClass } from '#functionSchema/functionDecorators';
import { logger } from '#o11y/logger';
import { ExecResult, execCommand, failOnError, runShellCommand } from '#utils/exec';
import { LanguageTools } from '../languageTools';

// https://typescript.tv/errors/

@funcClass(__filename)
export class TypescriptTools implements LanguageTools {
	/**
	 * Runs the command `npm run <script>`
	 * @param script the script in the package.json file to run
	 * @reutrn the stdout and stderr
	 */
	@func()
	async runNpmScript(script: string): Promise<string> {
		const packageJson = JSON.parse(readFileSync('package.json').toString());
		if (!packageJson.scripts[script]) throw new Error(`Npm script ${script} doesn't exist in package.json`);
		const result = await runShellCommand(`npm run ${script}`);
		failOnError(`Error running npm run ${script}`, result);
		return `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`;
	}

	/**
	 * Generates an outline of a TypeScript repository by running the tsc command with the emitDeclarationOnly flag
	 * and returning the contents of all the type definition files.
	 * @returns a comprehensive outline of the project
	 */
	@func()
	async generateProjectMap(): Promise<string> {
		// Note that the project needs to be in a compilable state otherwise this will fail
		logger.info('Generating TypeScript project map');
		const dtsFolder = '.nous/dts';
		const tsConfigExists = await getFileSystem().fileExists('tsconfig.json');
		if (!tsConfigExists) throw new Error(`tsconfig.json not found in ${getFileSystem().getWorkingDirectory()}`);

		const { exitCode, stdout, stderr } = await execCommand(`npx tsc -d --declarationDir "./${dtsFolder}" --emitDeclarationOnly`);
		// Always returns 0 with no output?
		logger.info(`Generating TypeScript project result: ${exitCode} ${stdout} ${stderr}`);

		const dtsFiles = new Map();
		// getFileSystem().setWorkingDirectory(dtsFolder)
		const allFiles = await getFileSystem().getFileContentsRecursively(dtsFolder, false);
		// getFileSystem().setWorkingDirectory(process.cwd())

		allFiles.forEach((value, key) => {
			dtsFiles.set(key.replace('.d.ts', '.ts').replace(dtsFolder, 'src'), value);
		});
		logger.info(`${dtsFiles.size} dts files`);
		return getFileSystem().formatFileContentsAsXml(dtsFiles);
	}

	/**
	 * Installs a package using the appropriate package manager (yarn, pnpm, or npm)
	 * @param packageName The name of the package to install
	 */
	@func()
	async installPackage(packageName: string): Promise<void> {
		// TODO check Snyk etc for any major vulnerability
		let result: ExecResult;
		// NODE_ENV=development is required other if it's set to production the devDependencies won't be installed
		if (existsSync(join(getFileSystem().getWorkingDirectory(), 'yarn.lock'))) {
			result = await runShellCommand(`yarn add ${packageName}`, { envVars: { NODE_ENV: 'development' } });
		} else if (existsSync(join(getFileSystem().getWorkingDirectory(), 'pnpm-lock.yaml'))) {
			result = await runShellCommand(`pnpm install ${packageName}`, { envVars: { NODE_ENV: 'development' } });
		} else {
			result = await runShellCommand(`nvm use && npm install ${packageName}`, { envVars: { NODE_ENV: 'development' } });
		}

		if (result.exitCode > 0) throw new Error(`${result.stdout}\n${result.stderr}`);
	}

	async getInstalledPackages(): Promise<string> {
		try {
			const fileContent = await getFileSystem().readFile('package.json');
			const packageJson = JSON.parse(fileContent);

			let info = '<installed_packages>\n';

			// Include dependencies and peerDependencies
			const productionDependencies = {
				...packageJson.dependencies,
				...packageJson.peerDependencies,
			};

			info += '<production>\n';
			for (const [pkg, version] of Object.entries(productionDependencies)) {
				info += `${pkg}: ${version}\n`;
			}
			info += '</production>\n';

			// Include devDependencies if they exist
			if (packageJson.devDependencies) {
				info += '<development>\n';
				for (const [pkg, version] of Object.entries(packageJson.devDependencies)) {
					info += `${pkg}: ${version}\n`;
				}
				info += '</development>\n';
			}

			info += '</installed_packages>';

			return info;
		} catch (error) {
			throw new Error(`Error reading package.json: ${error.message}`);
		}
	}
}
