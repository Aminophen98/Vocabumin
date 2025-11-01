console.log('[Vocaminary] Auth bridge loaded');

window.addEventListener('message', async (event) => {
  console.log('[Vocaminary] Received message:', event.data);
  
  if (event.origin !== 'https://app.vocaminary.com' && event.origin !== 'http://localhost:3000') {
    console.log('[Vocaminary] Wrong origin:', event.origin);
    return;
  }
  
  if (event.data.type === 'VOCAMINARY_AUTH') {
    console.log('[Vocaminary] Auth message detected, saving...');

    // Calculate expiry if not provided (fallback to 30 days)
    const expiresAt = event.data.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiryDate = new Date(expiresAt);

    console.log('[Vocaminary] Token expires at:', expiryDate.toLocaleString());

    chrome.storage.sync.set({
      vocabToken: event.data.token,
      vocabUserId: event.data.userId,
      vocabEmail: event.data.email,
      vocabTokenExpiry: expiresAt
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Vocaminary] Save failed:', chrome.runtime.lastError);
      } else {
        console.log('[Vocaminary] Auth saved successfully! Expires:', expiryDate.toLocaleDateString());
        window.postMessage({ type: 'VOCAMINARY_AUTH_SUCCESS' }, '*');
      }
    });
  }

  if (event.data.type === 'VOCAMINARY_ONBOARDING') {
    console.log('[Vocaminary] Onboarding message detected, saving settings...');

    const settings = event.data.settings;
    const expiresAt = event.data.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000);

    chrome.storage.sync.set({
      // Auth data
      vocabToken: event.data.token,
      vocabUserId: event.data.userId,
      vocabEmail: event.data.email,
      vocabTokenExpiry: expiresAt,
      // Language settings
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
      definitionLevel: settings.definitionLevel,
      // API settings
      apiMode: settings.apiMode,
      openaiApiKey: settings.openaiApiKey || '',
      // Mark onboarding as complete
      needsOnboarding: false
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Vocaminary] Onboarding save failed:', chrome.runtime.lastError);
      } else {
        console.log('[Vocaminary] Onboarding completed successfully!');
        console.log('[Vocaminary] Settings:', {
          targetLanguage: settings.targetLanguage,
          definitionLevel: settings.definitionLevel,
          apiMode: settings.apiMode
        });
        window.postMessage({ type: 'VOCAMINARY_ONBOARDING_SUCCESS' }, '*');
      }
    });
  }

  const channel = new BroadcastChannel('vocaminary-auth');
  channel.addEventListener('message', async (event) => {
      if (event.data.type === 'SIGNED_OUT') {
          console.log('[Vocaminary] Sign out detected, clearing extension auth');
          await chrome.storage.sync.remove([
              'vocabToken',
              'vocabUserId',
              'vocabEmail',
              'vocabTokenExpiry'
          ]);
      }
  });

});