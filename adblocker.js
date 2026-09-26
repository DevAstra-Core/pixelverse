/**
 * PixelVerse AdBlocker
 *
 * Hides ad containers and removes ad iframes that live in YOUR page's DOM.
 * It cannot reach inside cross-origin iframes (e.g. a YouTube embed), so it
 * will not remove ads that YouTube plays inside its own player.
 */

class PixelVerseAdBlocker {

    constructor(rules) {
        this.rules = rules;
        this.observer = null;
        this.scheduled = false;
    }

    start() {
        if (!this.rules.enabled) {
            console.log("PixelVerse AdBlocker: disabled");
            return;
        }

        this.injectStyles();
        this.scan();

        // Re-scan when the page adds new elements (throttled to once per frame)
        this.observer = new MutationObserver(() => this.scheduleScan());
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log("PixelVerse AdBlocker: started");
    }

    // Hide every matching selector with one <style> tag. This applies instantly
    // (no flash of ad) and also covers elements added later.
    injectStyles() {
        if (document.getElementById("pixelverse-adblock-style")) return;

        const validSelectors = (this.rules.selectors || []).filter(selector => {
            try {
                document.createDocumentFragment().querySelector(selector);
                return true;
            } catch (error) {
                console.warn("PixelVerse AdBlocker: invalid selector", selector);
                return false;
            }
        });

        if (validSelectors.length === 0) return;

        const style = document.createElement("style");
        style.id = "pixelverse-adblock-style";
        style.textContent =
            validSelectors.join(",\n") + " { display: none !important; }";
        document.head.appendChild(style);
    }

    scheduleScan() {
        if (this.scheduled) return;
        this.scheduled = true;

        requestAnimationFrame(() => {
            this.scheduled = false;
            this.scan();
        });
    }

    scan() {
        this.blockAdIframes();
    }

    blockAdIframes() {
        const domains = this.rules.iframeDomains;
        if (!Array.isArray(domains)) return;

        document.querySelectorAll("iframe").forEach(iframe => {
            const src = iframe.src || "";

            if (domains.some(domain => src.includes(domain))) {
                iframe.remove();
            }
        });
    }

    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        const style = document.getElementById("pixelverse-adblock-style");
        if (style) style.remove();

        console.log("PixelVerse AdBlocker: stopped");
    }
}


// Resolve ad-rules.json relative to THIS script file, not the page URL.
// (Keep ad-rules.json in the same folder as adblocker.js.)
const PV_ADBLOCK_BASE = document.currentScript
    ? new URL(".", document.currentScript.src).href
    : "./";


export async function startPixelVerseAdBlocker() {
    try {
        // Make sure document.body exists before observing it
        if (document.readyState === "loading") {
            await new Promise(resolve =>
                document.addEventListener("DOMContentLoaded", resolve, { once: true })
            );
        }

        const response = await fetch(new URL("ad-rules.json", PV_ADBLOCK_BASE));

        if (!response.ok) {
            throw new Error(`Failed to load ad-rules.json: HTTP ${response.status}`);
        }

        const rules = await response.json();

        window.pixelVerseAdBlocker = new PixelVerseAdBlocker(rules);
        window.pixelVerseAdBlocker.start();

    } catch (error) {
        console.error("PixelVerse AdBlocker: failed to start", error);
    }
}