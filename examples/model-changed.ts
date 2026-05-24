/**
 * Notify the agent when the model changes mid-session.
 * Mirrors Claude Code's model awareness behavior.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI) {
	return {
		on: "model_select",
		when: ({ event }) => event.previousModel != null,
		message: ({ event }) => {
			const prev = `${event.previousModel.provider}/${event.previousModel.id}`;
			const next = `${event.model.provider}/${event.model.id}`;
			return `Model changed from ${prev} to ${next}. Capabilities may differ — adjust your approach if needed.`;
		},
	};
}
