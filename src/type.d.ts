declare interface ConnectionConfig {
	hostname?: string;
	port?: number;
}

declare interface CommonArguments extends ConnectionConfig {
	sourceMaps?: boolean;
	sourceRoot?: string;
	sourceMapPathOverrides?: {[key: string]: string};
	program?: string;
	args?: string[];
	cwd?: string;
	trace?: boolean;
}
