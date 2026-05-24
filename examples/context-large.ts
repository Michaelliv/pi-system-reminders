/**
 * Remind the agent to compact when context gets large.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
	return {
		on: "turn_start",
		when: ({ ctx }) => (ctx.getContextUsage()?.tokens ?? 0) > 150_000,
		message: "Context exceeds 150k tokens. Consider compacting to maintain quality.",
		once: true,
	};
}
