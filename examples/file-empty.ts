/**
 * Warn when a read returns an empty file.
 * Mirrors Claude Code's system-reminder-file-exists-but-empty.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let emptyFileDetected = false;
	let emptyFileName = "";

	pi.on("tool_result", async (event) => {
		if (event.toolName === "read" && !event.isError) {
			const content = event.content;
			const text = Array.isArray(content)
				? content.map((c: any) => c.text || "").join("")
				: String(content || "");
			if (text.trim() === "") {
				emptyFileDetected = true;
				emptyFileName = (event.input as any)?.path || "unknown";
			}
		}
	});

	return {
		on: "tool_execution_end",
		when: () => {
			if (emptyFileDetected) {
				emptyFileDetected = false;
				return true;
			}
			return false;
		},
		message: () => `Warning: the file ${emptyFileName} exists but the contents are empty.`,
	};
}
