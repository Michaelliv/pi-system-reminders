/**
 * Warn when a read result was truncated.
 * Mirrors Claude Code's system-reminder-file-truncated.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let truncatedFile = "";
	let truncated = false;

	pi.on("tool_result", async (event) => {
		if (event.toolName === "read" && !event.isError) {
			const details = (event as any).details;
			if (details?.truncation?.truncated) {
				truncated = true;
				truncatedFile = (event.input as any)?.path || "unknown";
			}
		}
	});

	return {
		on: "tool_execution_end",
		when: () => {
			if (truncated) {
				truncated = false;
				return true;
			}
			return false;
		},
		message: () => `Note: ${truncatedFile} was too large and has been truncated. Use the read tool with offset to read more of the file if you need.`,
	};
}
