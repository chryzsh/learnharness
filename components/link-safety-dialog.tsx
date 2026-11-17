"use client";

import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";
import { HostDialog } from "@/components/host-dialog";

/**
 * Streamdown asks before it opens a link from a chat message. Its own
 * prompt renders where the link is, inside the paragraph, which is invalid
 * HTML (React logs "<div> cannot be a descendant of <p>"). This prompt
 * opens as a host dialog instead: a portal on the body, with the layered
 * Esc and focus handling every other dialog uses.
 */

/** The dialog's pure content, for SSR pins. */
export function LinkSafetyBody({ url, onClose, onConfirm }: Omit<LinkSafetyModalProps, "isOpen">) {
	return (
		<>
			<h2 className="text-sm font-semibold text-card-foreground">Open external link?</h2>
			<p className="mt-1.5 text-xs text-muted-foreground">This link opens a website outside LearnHarness.</p>
			<div data-testid="link-safety-url" className="mt-3 max-h-32 overflow-y-auto break-all rounded-md bg-muted p-3 font-mono text-xs">{url}</div>
			<div className="mt-4 flex justify-end gap-2">
				<button type="button" onClick={onClose} className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
					Cancel
				</button>
				<button type="button" data-testid="link-safety-open" onClick={onConfirm} className="rounded-sm bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90">
					Open link
				</button>
			</div>
		</>
	);
}

function LinkSafetyDialog({ isOpen, url, onClose, onConfirm }: LinkSafetyModalProps) {
	return (
		<HostDialog open={isOpen} aria-label="Open external link?"
			frame={<div className="mx-4 w-full max-w-md rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()} />}
			onClose={() => { onClose(); return "closed"; }}
			backdropProps={{ className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm", "data-testid": "link-safety-dialog" }}>
			<LinkSafetyBody url={url} onClose={onClose} onConfirm={onConfirm} />
		</HostDialog>
	);
}

export const messageLinkSafety: LinkSafetyConfig = {
	enabled: true,
	renderModal: (props) => <LinkSafetyDialog {...props} />,
};
