/**
 * Central timing instrumentation for startup profiling.
 * Enable with PI_TIMING=1 environment variable.
 */

const ENABLED = process.env.PI_TIMING === "1";
const timings: Array<{ label: string; ms: number }> = [];
let lastTime = Date.now();

export function time(label: string): void {
	if (!ENABLED) return;
	const now = Date.now();
	timings.push({ label, ms: now - lastTime });
	lastTime = now;
}

export function printTimings(): void {
	if (!ENABLED || timings.length === 0) return;
	console.error("\n--- Startup Timings ---");
	for (const t of timings) {
		console.error(`  ${t.label}: ${t.ms}ms`);
	}
	console.error(`  TOTAL: ${timings.reduce((a, b) => a + b.ms, 0)}ms`);
	console.error("------------------------\n");
}

export function createPhaseTimer(scope: string): {
	step(label: string): void;
	end(): void;
} {
	if (!ENABLED) {
		return {
			step() {},
			end() {},
		};
	}

	const startedAt = Date.now();
	let lastStepAt = startedAt;
	const entries: Array<{ label: string; ms: number }> = [];

	return {
		step(label: string) {
			const now = Date.now();
			entries.push({ label, ms: now - lastStepAt });
			lastStepAt = now;
		},
		end() {
			const total = Date.now() - startedAt;
			const details = entries.map((entry) => `${entry.label}=${entry.ms}ms`).join(", ");
			console.error(`[timing:${scope}] total=${total}ms${details ? ` | ${details}` : ""}`);
		},
	};
}
