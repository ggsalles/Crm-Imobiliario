/**
 * ICQ Sound & Audio Notification Service for SalesScore CRM
 * Plays the iconic "Uh-oh!" when a new lead enters the pipeline via public links or capture forms.
 */

const SOUND_STORAGE_KEY = 'crm_icq_sound_enabled';
const AUDIO_SRC = '/sounds/icq_uh_oh.mp3';

let audioInstance: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;

/**
 * Check if the ICQ sound is enabled by the user (default: true)
 */
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
}

/**
 * Toggle or set ICQ sound enabled state
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('crm-sound-toggle', { detail: { enabled } }));
  } catch (err) {
    console.error('Error saving sound preference:', err);
  }
}

/**
 * Unlock AudioContext on user interaction to comply with browser autoplay policies
 */
export function unlockAudio(): void {
  if (isAudioUnlocked || typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!audioContext) {
        audioContext = new AudioCtx();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    }

    if (!audioInstance) {
      audioInstance = new Audio(AUDIO_SRC);
      audioInstance.load();
    }

    isAudioUnlocked = true;
  } catch (e) {
    // Ignore unlock errors
  }
}

// Auto-register first user interaction listener to unlock audio
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockAudio();
    window.removeEventListener('click', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
    window.removeEventListener('touchstart', handleFirstInteraction);
  };

  window.addEventListener('click', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });
  window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
}

/**
 * Synthesizes the classic ICQ two-tone "Uh-oh!" sound using Web Audio API as a fail-safe fallback
 */
function playSynthesizedIcqFallback(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContext || new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First syllable: "Uh" (lower tone around 330 Hz, E4)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second syllable: "Oh!" (higher punchy tone around 490 Hz, B4)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(460, now + 0.16);
    osc2.frequency.exponentialRampToValueAtTime(490, now + 0.28);

    gain2.gain.setValueAtTime(0, now + 0.16);
    gain2.gain.linearRampToValueAtTime(0.4, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.16);
    osc2.stop(now + 0.48);
  } catch (err) {
    console.warn('Web Audio synthesis error:', err);
  }
}

/**
 * Plays the authentic ICQ "Uh-oh!" sound
 * Falls back to Web Audio synthesis if audio element fails
 */
export async function playIcqSound(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!isSoundEnabled()) return false;

  unlockAudio();

  try {
    // Attempt playback of authentic mp3
    const audio = new Audio(AUDIO_SRC);
    audio.volume = 0.85;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      return true;
    }
  } catch (err) {
    console.info('Audio file playback failed or restricted by browser, using synthesizer fallback:', err);
    try {
      playSynthesizedIcqFallback();
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
