// UPDATE handleWordClick method:
async handleWordClick(word, wordIndex) {
// Debounce rapid clicks
const now = Date.now();
const clickKey = `${word}_${wordIndex}`;

    // If same word clicked within 300ms, ignore
    if (this.pendingAnalysis.has(clickKey)) {
        console.log('[YT Overlay] ⏳ Analysis already pending for:', word);
        return;
    }

    if (now - this.lastWordClick < this.clickDebounceMs) {
        console.log('[YT Overlay] ⏱️ Click debounced');
        return;
    }

    this.lastWordClick = now;
    this.pendingAnalysis.set(clickKey, true);

    try {
        // ... existing handleWordClick code ...
    } finally {
        // Clear pending flag
        setTimeout(() => {
            this.pendingAnalysis.delete(clickKey);
        }, 1000);
    }

}
