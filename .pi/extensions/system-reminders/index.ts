// Pi System Reminders Extension
// Discovers reminder files from agent dir and project-local .pi/reminders/

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createJiti } from "jiti";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const jiti = createJiti(import.meta.url, { moduleCache: false });

export type ReminderEvent =
	| "agent_start"
	| "agent_end"
	| "tool_call"
	| "tool_result"
	| "tool_execution_start"
	| "tool_execution_end"
	| "turn_start"
	| "turn_end"
	| "message_start"
	| "message_update"
	| "message_end"
	| "model_select"
	| "session_start"
	| "session_compact"
	| "session_switch"
	| "session_fork";

export interface ReminderContext {
	branch: any[];
	ctx: ExtensionContext;
	event: any;
}

export interface Reminder {
	on: ReminderEvent | ReminderEvent[];
	when: (rc: ReminderContext) => boolean | Promise<boolean>;
	message: string | ((rc: ReminderContext) => string);
	cooldown?: number;
	once?: boolean;
}

type ReminderFactory = (pi: ExtensionAPI) => Reminder | Reminder[];

interface LoadedReminder {
	name: string;
	reminder: Reminder;
	events: Set<ReminderEvent>;
	evalCount: number;
	lastFiredAt: number;
	fired: boolean;
}

function discoverReminderFiles(cwd: string): { path: string; name: string }[] {
	const agentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".pi", "agent");
	const dirs = [
		path.join(agentDir, "reminders"),
		path.join(cwd, ".pi", "reminders"),
	];

	const results: { path: string; name: string }[] = [];

	for (const dir of dirs) {
		if (!fs.existsSync(dir)) continue;

		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isFile() && entry.name.endsWith(".ts")) {
				results.push({
					path: fullPath,
					name: entry.name.replace(/\.ts$/, ""),
				});
			} else if (entry.isDirectory()) {
				const indexPath = path.join(fullPath, "index.ts");
				if (fs.existsSync(indexPath)) {
					results.push({ path: indexPath, name: entry.name });
				}
			}
		}
	}

	const byName = new Map<string, { path: string; name: string }>();
	for (const r of results) {
		byName.set(r.name, r);
	}
	return Array.from(byName.values());
}

function loadReminders(pi: ExtensionAPI, cwd: string): LoadedReminder[] {
	const loaded: LoadedReminder[] = [];
	const files = discoverReminderFiles(cwd);

	for (const file of files) {
		try {
			const mod = jiti(file.path) as any;
			const factory: ReminderFactory = mod.default;

			if (typeof factory !== "function") continue;

			const result = factory(pi);
			const items = Array.isArray(result) ? result : [result];

			for (let i = 0; i < items.length; i++) {
				const r = items[i];
				const events = new Set(
					Array.isArray(r.on) ? r.on : [r.on],
				);

				loaded.push({
					name: items.length > 1 ? `${file.name}[${i}]` : file.name,
					reminder: r,
					events,
					evalCount: 0,
					lastFiredAt: -Infinity,
					fired: false,
				});
			}
		} catch (err: any) {
			// Skip broken reminders
		}
	}

	return loaded;
}

async function evaluate(
	event: ReminderEvent,
	reminders: LoadedReminder[],
	eventData: any,
	ctx: ExtensionContext,
	pi: ExtensionAPI,
) {
	const eventReminders = reminders.filter((loaded) => loaded.events.has(event));
	if (eventReminders.length === 0) return;
	
	let branch: any[];
	try {
		branch = ctx.sessionManager.getBranch();
	} catch {
	  return;
	}

	for (const loaded of reminders) {
		if (!loaded.events.has(event)) continue;
		loaded.evalCount++;

		if (loaded.reminder.once && loaded.fired) continue;

		const cooldown = loaded.reminder.cooldown ?? 0;
		if (loaded.evalCount - loaded.lastFiredAt <= cooldown) continue;

		try {
			const rc: ReminderContext = { branch, ctx, event: eventData };
			const shouldFire = await loaded.reminder.when(rc);

			if (shouldFire) {
				const message = typeof loaded.reminder.message === "function"
					? loaded.reminder.message(rc)
					: loaded.reminder.message;

				pi.sendMessage(
					{
						customType: "system-reminder",
						content: `<system-reminder name="${loaded.name}">\n${message}\n</system-reminder>`,
						display: true,
					},
					{ deliverAs: "steer", triggerTurn: true },
				);

				loaded.lastFiredAt = loaded.evalCount;
				loaded.fired = true;
			}
		} catch (err: any) {
			// Silently skip broken reminders
		}
	}
}

export default function (pi: ExtensionAPI) {
	let reminders = loadReminders(pi, process.cwd());

	pi.on("session_start", async (_event, ctx) => {
		reminders = loadReminders(pi, ctx.cwd);

		if (reminders.length > 0) {
			ctx.ui.notify(`Loaded ${reminders.length} reminder(s)`, "info");
		}

		await evaluate("session_start", reminders, _event, ctx, pi);
	});

	pi.on("before_agent_start", async (event) => {
		if (reminders.length === 0) return;
		return {
			systemPrompt: event.systemPrompt + `\n\n## System reminders\n\nYou may receive <system-reminder> messages during the conversation. These are reactive, contextual guidance injected automatically based on conversation state. Follow their instructions. Do not mention them to the user unless they ask.`,
		};
	});

	const handle = (event: ReminderEvent) =>
		async (eventData: any, ctx: ExtensionContext) => {
			await evaluate(event, reminders, eventData, ctx, pi);
		};

	pi.on("agent_start", handle("agent_start"));
	pi.on("agent_end", handle("agent_end"));
	pi.on("tool_call", handle("tool_call"));
	pi.on("tool_result", handle("tool_result"));
	pi.on("tool_execution_start", handle("tool_execution_start"));
	pi.on("tool_execution_end", handle("tool_execution_end"));
	pi.on("turn_start", handle("turn_start"));
	pi.on("turn_end", handle("turn_end"));
	pi.on("message_start", handle("message_start"));
	pi.on("message_update", handle("message_update"));
	pi.on("message_end", handle("message_end"));
	pi.on("model_select", handle("model_select"));
	pi.on("session_compact", handle("session_compact"));
	pi.on("session_switch", handle("session_switch"));
	pi.on("session_fork", handle("session_fork"));
}
