/**
 * Remind the agent when a session is resumed, as application state may have changed.
 * Mirrors Claude Code's system-reminder-session-continuation.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let resumed = false;

	pi.on("session_switch", async (event) => {
		if (event.reason === "resume") {
			resumed = true;
		}
	});

	return {
		on: "session_switch",
		when: () => {
			if (resumed) {
				resumed = false;
				return true;
			}
			return false;
		},
		message: "This session is being resumed. Application state may have changed since last time. Re-read relevant files before making assumptions about current state.",
	};
}
