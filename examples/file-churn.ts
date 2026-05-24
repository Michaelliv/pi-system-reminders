/**
 * Remind the agent when it keeps editing the same file repeatedly.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const editCounts = new Map<string, number>();

	pi.on("tool_result", async (event) => {
		if (event.toolName === "edit" && !event.isError) {
			const filePath = (event.input as any)?.path;
			if (filePath) {
				editCounts.set(filePath, (editCounts.get(filePath) ?? 0) + 1);
			}
		}
	});

	return {
		on: "tool_execution_end",
		when: () => {
			for (const [, count] of editCounts) {
				if (count >= 5) return true;
			}
			return false;
		},
		message: () => {
			const worst = [...editCounts.entries()].sort((a, b) => b[1] - a[1])[0];
			return `You've edited ${worst[0]} ${worst[1]} times. Step back and consider a different approach.`;
		},
		cooldown: 10,
	};
}
