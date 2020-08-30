import {SourceMapConsumer} from 'source-map';
import { BasicSourceMapConsumer, NullableMappedPosition, MappedPosition, NullablePosition } from 'source-map';
import { LoggingDebugSession } from 'vscode-debugadapter';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as normalize from 'normalize-path';

export abstract class SourceMapSession extends LoggingDebugSession {

	private _generatedfileToSourceMap = new Map<string, BasicSourceMapConsumer>();
	private _sourceMaps = new Map<string, BasicSourceMapConsumer>();

	protected abstract log(message: string): void;
	protected abstract get_configs(): CommonArguments;

	private async load_source_map(p_path: string): Promise<BasicSourceMapConsumer> {
		const json = JSON.parse(fs.readFileSync(p_path).toString());
		if (!json.sourceRoot) json.sources = json.sources.map(source => path.resolve(path.dirname(p_path), source));
		const smc = await new SourceMapConsumer(json);
		return smc;
	}

	protected async loadSourceMaps() {
		const commonArgs = this.get_configs();
		if (!commonArgs.sourceMaps === false) return;
		// options is optional
		const files = glob.sync("**/*.map", { cwd: commonArgs.cwd });
		for (const file of files) {
			const source_map_file: string = path.join(commonArgs.cwd, file);
			const smc = await this.load_source_map(source_map_file);
			let js_file = normalize(source_map_file.substring(0, source_map_file.length - ".map".length));
			if (fs.existsSync(js_file)) {
				js_file = this.global_to_relative(js_file);
			} else {
				js_file = normalize(smc.file);
			}
			smc.file = js_file;
			this._generatedfileToSourceMap.set(js_file, smc);
			for (const s of smc.sources) {
				this._sourceMaps.set(this.global_to_relative(s), smc);
			}
		}
	}

	private global_to_relative(p_file) {
		const normalized = normalize(p_file);
		if (!path.isAbsolute(normalized)) return normalized;
		const commonArgs = this.get_configs();
		return path.relative(commonArgs.cwd, normalized);
	}

	private relative_to_global(p_file) {
		const normalized = normalize(p_file);
		if (path.isAbsolute(normalized)) return normalized;
		const commonArgs = this.get_configs();
		return path.join(commonArgs.cwd, normalized);
	}


	translateFileLocationToRemote(sourceLocation: MappedPosition): MappedPosition {
		try {
			const workspace_path = this.global_to_relative(sourceLocation.source);
			const sm = this._sourceMaps.get(workspace_path);
			if (!sm) throw new Error('no source map');
			const actualSourceLocation = Object.assign({}, sourceLocation);
			var unmappedPosition: NullablePosition = sm.generatedPositionFor(actualSourceLocation);
			if (!unmappedPosition.line === null) throw new Error('map failed');
			return {
				source: `res://${sm.file}`,
				// the source-map docs indicate that line is 1 based, but that seems to be wrong.
				line: (unmappedPosition.line || 0) + 1,
				column: unmappedPosition.column || 0,
			}
		} catch (e) {
			var ret = Object.assign({}, sourceLocation);
			ret.source = "res://" + this.global_to_relative(sourceLocation.source);
			return ret;
		}
	}

	translateRemoteLocationToLocal(sourceLocation: MappedPosition): MappedPosition {
		sourceLocation.source = sourceLocation.source.replace("res://", "");
		try {
			const sm = this._generatedfileToSourceMap.get(sourceLocation.source);
			if (!sm) throw new Error('no source map');
			let original = sm.originalPositionFor({line: sourceLocation.line, column: sourceLocation.column, bias: SourceMapConsumer.LEAST_UPPER_BOUND});
			if (this.is_null_poisition(original)) {
				throw new Error("unable to map");
			}
			return original;
		} catch (e) {
			var ret = Object.assign({}, sourceLocation);
			ret.source = this.relative_to_global(sourceLocation.source);
			return ret;
		}
	}

	private is_null_poisition(pos: NullableMappedPosition) {
		const original = pos;
		return (original == null || original.line === null || original.column === null || original.source === null);
	}
}