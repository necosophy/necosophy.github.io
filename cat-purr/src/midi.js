import { MOD_WHEEL_CC } from './config.js';

// Thin wrapper around the Web MIDI API. Connects to whatever's plugged in
// (e.g. an AKAI MPK Mini) and dispatches note on/off and CC1 (mod wheel)
// to the handlers passed in. Fails gracefully when Web MIDI isn't
// supported or no device is connected — the cat still runs on idle motion.
export function initMIDI({ onNoteOn, onNoteOff, onCC, onStatus }) {
  if (!navigator.requestMIDIAccess) {
    onStatus({ ok: false, message: 'Web MIDI not supported in this browser' });
    return;
  }

  navigator.requestMIDIAccess({ sysex: false }).then(
    (access) => {
      const attachInputs = () => {
        const inputs = Array.from(access.inputs.values());
        for (const input of inputs) {
          input.onmidimessage = (event) => handleMessage(event.data, { onNoteOn, onNoteOff, onCC });
        }
        if (inputs.length === 0) {
          onStatus({ ok: false, message: 'No MIDI device found — waiting…' });
        } else {
          const names = inputs.map((i) => i.name).join(', ');
          onStatus({ ok: true, message: `MIDI connected: ${names}` });
        }
      };

      attachInputs();
      access.onstatechange = attachInputs;
    },
    () => {
      onStatus({ ok: false, message: 'MIDI access denied' });
    }
  );
}

function handleMessage(data, { onNoteOn, onNoteOff, onCC }) {
  const [status, data1, data2] = data;
  const command = status & 0xf0;

  if (command === 0x90 && data2 > 0) {
    onNoteOn(data1, data2);
  } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
    onNoteOff(data1);
  } else if (command === 0xb0 && data1 === MOD_WHEEL_CC) {
    onCC(data1, data2);
  }
}
