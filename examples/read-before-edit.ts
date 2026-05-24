/**
 * Remind the agent to read a file before editing it.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const readFiles = new Set<string>();
	let editedUnread = false;
	let lastUnreadFile = "";

	pi.on("tool_result", async (event) => {
		if (event.toolName === "read" && !event.isError) {
			readFiles.add((event.input as any)?.path);
		}
		if (event.toolName === "edit" && !event.isError) {
			const filePath = (event.input as any)?.path;
			if (filePath && !readFiles.has(filePath)) {
				editedUnread = true;
				lastUnreadFile = filePath;
			}
		}
	});

	return {
		on: "tool_execution_end",
		when: () => {
			if (editedUnread) {
				editedUnread = false;
				return true;
			}
			return false;
		},
		message: () => `You edited ${lastUnreadFile} without reading it first. Always read files before editing to avoid stale oldText.`,
	};
}
