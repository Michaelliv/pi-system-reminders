/**
 * Remind the agent to stop and rethink after consecutive bash failures.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let consecutiveFailures = 0;

	pi.on("tool_result", async (event) => {
		if (event.toolName === "bash") {
			consecutiveFailures = event.isError ? consecutiveFailures + 1 : 0;
		}
	});

	return {
		on: "tool_execution_end",
		when: () => consecutiveFailures >= 3,
		message: "3 consecutive bash failures. Stop, re-read the error messages, and rethink your approach.",
		cooldown: 10,
	};
}
