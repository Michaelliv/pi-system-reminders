/**
 * After compaction, remind the agent that file contents may have been summarized away.
 * Mirrors Claude Code's system-reminder-compact-file-reference.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
	return {
		on: "session_compact",
		when: () => true,
		message: "Conversation was just compacted. Previously read file contents may have been summarized away. Use the read tool to re-read any files you need to reference.",
		once: true,
	};
}
