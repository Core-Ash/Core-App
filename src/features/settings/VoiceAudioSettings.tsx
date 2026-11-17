import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Headphones, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/features/settings/settings-context";

interface DeviceItem {
  value: string;
  label: string;
}

export function VoiceAudioSettings() {
  const { preferences, updatePreferences } = usePreferences();
  const id = useId();
  const [inputs, setInputs] = useState<DeviceItem[]>([{ value: "default", label: "Default Microphone" }]);
  const [outputs, setOutputs] = useState<DeviceItem[]>([{ value: "default", label: "Default Output Device" }]);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const audioInputs: DeviceItem[] = [{ value: "default", label: "Default Microphone" }];
      const audioOutputs: DeviceItem[] = [{ value: "default", label: "Default Output Device" }];
      let inCount = 0;
      let outCount = 0;
      for (const device of list) {
        if (device.kind === "audioinput") {
          inCount += 1;
          const value = device.deviceId || `input-${inCount}`;
          if (value === "default") continue;
          audioInputs.push({
            value,
            label: device.label.trim() || `Microphone ${inCount}`,
          });
        } else if (device.kind === "audiooutput") {
          outCount += 1;
          const value = device.deviceId || `output-${outCount}`;
          if (value === "default") continue;
          audioOutputs.push({
            value,
            label: device.label.trim() || `Speaker / Headphones ${outCount}`,
          });
        }
      }
      setInputs(audioInputs);
      setOutputs(audioOutputs);
    } catch {
      // Device enumeration may be blocked until permission is granted.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDevices();
    }, 0);
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!media?.addEventListener) {
      return () => window.clearTimeout(timer);
    }
    const handleChange = () => {
      void refreshDevices();
    };
    media.addEventListener("devicechange", handleChange);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("devicechange", handleChange);
    };
  }, [refreshDevices]);

  function stopMicTest() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setTesting(false);
    setLevel(0);
  }

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  async function startMicTest() {
    setMicError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone testing is not supported in this browser environment.");
      return;
    }
    try {
      const audioConstraint =
        preferences.inputDeviceId && preferences.inputDeviceId !== "default"
          ? { deviceId: { ideal: preferences.inputDeviceId } }
          : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });
      streamRef.current = stream;
      void refreshDevices();

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i += 1) {
            sum += buffer[i] ?? 0;
          }
          const avg = sum / buffer.length;
          const scaled = Math.min(100, Math.round((avg / 140) * 100 * (preferences.inputVolume / 100)));
          setLevel(scaled);
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setLevel(35);
      }
      setTesting(true);
    } catch (err) {
      stopMicTest();
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setMicError("Microphone permission was denied. Allow microphone access in your browser to test your input.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setMicError("No microphone input device was found.");
      } else {
        setMicError("Could not access microphone for local testing.");
      }
    }
  }

  const activeInput = inputs.some((item) => item.value === preferences.inputDeviceId)
    ? preferences.inputDeviceId
    : "default";
  const activeOutput = outputs.some((item) => item.value === preferences.outputDeviceId)
    ? preferences.outputDeviceId
    : "default";

  return (
    <div className="settings-section-stack">
      <div className="settings-callout">
        <Headphones size={18} aria-hidden="true" />
        <div>
          <strong>Voice connections aren’t available yet</strong>
          <p>
            Voice channels and live calls are not connected to the backend yet. You can configure your local device preferences and test your microphone locally in your browser.
          </p>
        </div>
      </div>

      <section className="settings-group" aria-labelledby={`${id}-devices`}>
        <h3 id={`${id}-devices`} className="settings-group-title">Voice Settings</h3>
        <div className="settings-device-grid">
          <div className="settings-field">
            <label htmlFor={`${id}-input-device`} className="settings-label">Input Device</label>
            <select
              id={`${id}-input-device`}
              className="settings-select"
              value={activeInput}
              onChange={(event) => updatePreferences({ inputDeviceId: event.target.value })}
            >
              {inputs.map((device) => (
                <option key={device.value} value={device.value}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor={`${id}-output-device`} className="settings-label">Output Device</label>
            <select
              id={`${id}-output-device`}
              className="settings-select"
              value={activeOutput}
              onChange={(event) => updatePreferences({ outputDeviceId: event.target.value })}
            >
              {outputs.map((device) => (
                <option key={device.value} value={device.value}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>

          <div className="settings-field">
            <div className="settings-slider-header">
              <label htmlFor={`${id}-input-volume`} className="settings-label">Input Volume</label>
              <span className="settings-slider-value">{preferences.inputVolume}%</span>
            </div>
            <input
              id={`${id}-input-volume`}
              type="range"
              min={0}
              max={100}
              value={preferences.inputVolume}
              onChange={(event) => updatePreferences({ inputVolume: Number(event.target.value) })}
              className="settings-range"
            />
          </div>

          <div className="settings-field">
            <div className="settings-slider-header">
              <label htmlFor={`${id}-output-volume`} className="settings-label">Output Volume</label>
              <span className="settings-slider-value">{preferences.outputVolume}%</span>
            </div>
            <input
              id={`${id}-output-volume`}
              type="range"
              min={0}
              max={100}
              value={preferences.outputVolume}
              onChange={(event) => updatePreferences({ outputVolume: Number(event.target.value) })}
              className="settings-range"
            />
          </div>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-mic-test`}>
        <h3 id={`${id}-mic-test`} className="settings-group-title">Mic Test</h3>
        <p className="settings-description">
          Having mic issues? Start a local test and say something—we’ll show your input level right here without transmitting audio to any server.
        </p>
        <div className="settings-mic-test-row">
          <Button
            type="button"
            variant={testing ? "outline" : "default"}
            size="sm"
            onClick={() => {
              if (testing) stopMicTest();
              else void startMicTest();
            }}
          >
            {testing ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
            {testing ? "Stop Testing" : "Let's Check"}
          </Button>
          <div
            className="settings-mic-meter"
            role="meter"
            aria-label="Microphone input level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={level}
          >
            {Array.from({ length: 24 }).map((_, idx) => {
              const threshold = Math.round(((idx + 1) / 24) * 100);
              const active = testing && level >= threshold;
              return (
                <span
                  key={idx}
                  className={`settings-mic-bar${active ? " is-active" : ""}`}
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </div>
        {micError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {micError}
          </p>
        )}
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-input-mode`}>
        <h3 id={`${id}-input-mode`} className="settings-group-title">Input Mode</h3>
        <p className="settings-description">
          Saved locally for your browser and ready for when live voice channels are enabled.
        </p>
        <div className="settings-choice-grid" role="radiogroup" aria-labelledby={`${id}-input-mode`}>
          <button
            type="button"
            role="radio"
            aria-checked={preferences.inputMode === "voice-activity"}
            className={`settings-choice-card${preferences.inputMode === "voice-activity" ? " is-selected" : ""}`}
            onClick={() => updatePreferences({ inputMode: "voice-activity" })}
          >
            <Mic size={18} aria-hidden="true" />
            <div>
              <strong>Voice Activity</strong>
              <span>Automatically transmit when you speak</span>
            </div>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={preferences.inputMode === "push-to-talk"}
            className={`settings-choice-card${preferences.inputMode === "push-to-talk" ? " is-selected" : ""}`}
            onClick={() => updatePreferences({ inputMode: "push-to-talk" })}
          >
            <Volume2 size={18} aria-hidden="true" />
            <div>
              <strong>Push to Talk</strong>
              <span>Only transmit while holding your keybind</span>
            </div>
          </button>
        </div>
      </section>

      <hr className="settings-divider" />

      <section className="settings-group" aria-labelledby={`${id}-processing`}>
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-processing`} className="settings-group-title">Audio Processing</h3>
          <span className="settings-badge-unavailable">Unavailable</span>
        </div>
        <p className="settings-description">
          Advanced voice processing requires the live voice engine and is not available yet.
        </p>
        <div className="settings-disabled-list">
          <div className="settings-disabled-row">
            <div>
              <strong>Echo Cancellation</strong>
              <p>Prevents your microphone from picking up speaker output during voice calls.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
          <div className="settings-disabled-row">
            <div>
              <strong>Noise Suppression</strong>
              <p>Filters background fan and keyboard noise from your voice stream.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
          <div className="settings-disabled-row">
            <div>
              <strong>Automatic Gain Control</strong>
              <p>Automatically balances your microphone volume level during calls.</p>
            </div>
            <span className="settings-badge-unavailable">Unavailable</span>
          </div>
        </div>
      </section>
    </div>
  );
}
