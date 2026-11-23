"""PocketSoccer's booth (PocketBasketball's tools/voice.py, pointed at this game): every line in tools/commentary.json, spoken by Chatterbox (Resemble AI, MIT license)
on this machine, then packed into audio/vo.pack with its index in js/vo.js.

The two voices are original: each is cloned from a reference clip made by Kokoro (Apache 2.0), a synthetic voice,
not a recording of anyone (tools/commentary.json names the Kokoro voice behind each). Chatterbox brings the energy:
every line has its own `ex` (exaggeration, 0.3 calm to 0.9 a big call).

Needs (once): a Python with chatterbox-tts, torch, numpy and soundfile (CB_PYTHON, default the TikTok project's
tools/tts-cb/.venv), and for the references kokoro-onnx with its model files in .voice/model/ (see .voice/mkref.py).
macOS afconvert encodes the clips. Nothing in .voice/ is part of the repository.

Run:  $CB_PYTHON tools/voice.py              record what is new or changed, then rebuild the pack
      $CB_PYTHON tools/voice.py --pack       only rebuild the pack from recorded clips
      $CB_PYTHON tools/voice.py --jobs f.json  record an ad-hoc list ({"jobs": [{"who","text","ex","out"}]})

After the model speaks: silence trimmed, rumble cut (under 90 Hz), loudness set (calm lines about -21 dB RMS, the
biggest calls about -16), peaks held under -1 dB, then AAC at 48 kbit/s. A take that runs far longer than its words
should (the model sometimes rambles) is recorded again with another seed. """
import hashlib
import json
import os
import struct
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
V = os.environ.get('VOICE_DIR') or os.path.normpath(os.path.join(ROOT, '..', 'PocketBasketball', '.voice'))   # shared with PocketBasketball: its reference voices and its recorded clips
CLIPS = os.path.join(V, 'clips')
SCRIPT = os.path.join(ROOT, 'tools', 'commentary.json')
SR_OUT = 24000

_model = None
_voice = None


CAP = [1000]


def model():
    global _model
    if _model is None:
        import torch
        from chatterbox.tts import ChatterboxTTS
        dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
        try:
            _model = ChatterboxTTS.from_pretrained(device=dev)
        except Exception as e:  # some ops are missing on MPS in some torch builds
            print(f'MPS failed ({e}); CPU', flush=True)
            _model = ChatterboxTTS.from_pretrained(device='cpu')
        # Chatterbox lets a take run to 1000 speech tokens (40 s); a short call that rambles wastes minutes before the
        # length check below catches it, so the cap follows the words (speech tokens come at 25 a second)
        orig = _model.t3.inference

        def capped(*a, **k):
            k['max_new_tokens'] = CAP[0]
            return orig(*a, **k)
        _model.t3.inference = capped
    return _model


def use_voice(ref, ex):
    global _voice
    m = model()
    if _voice != (ref, round(ex, 2)):
        m.prepare_conditionals(ref, exaggeration=ex)
        _voice = (ref, round(ex, 2))


def max_len(text):
    return 0.8 + len(text.split()) * 0.42


def speak(ref, text, ex, seed):
    import torch
    m = model()
    use_voice(ref, ex)
    CAP[0] = int(max_len(text) * 25) + 12
    for attempt in range(5):
        torch.manual_seed(seed + attempt * 7919)
        with torch.inference_mode():
            w = m.generate(text, exaggeration=ex, cfg_weight=0.3 if ex > 0.6 else 0.4, temperature=0.75 if attempt < 3 else 0.6)
        x = w.squeeze().cpu().numpy()
        x = trim(x, m.sr)
        if len(x) / m.sr <= max_len(text):
            break
        print(f'   runaway {len(x) / m.sr:.1f}s, again', flush=True)
    if hasattr(torch, 'mps') and torch.backends.mps.is_available():
        torch.mps.empty_cache()
    return x, m.sr


def trim(x, sr, th=0.012, pad=0.05):
    i = np.where(np.abs(x) > th)[0]
    return x if len(i) == 0 else x[max(i[0] - int(pad * sr), 0):min(i[-1] + int(pad * sr), len(x))]


def finish(x, sr, ex):
    """rumble out, loudness by energy, peaks under -1 dB, a short fade at each end"""
    # one-pole high-pass at ~90 Hz
    a = np.exp(-2 * np.pi * 90 / sr)
    y = np.empty_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = a * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    rms = np.sqrt(np.mean(y ** 2) + 1e-12)
    target = 10 ** ((-21 + 5 * min(1, max(0, (ex - 0.3) / 0.6))) / 20)
    y *= target / rms
    pk = np.abs(y).max()
    if pk > 0.89:
        y *= 0.89 / pk
    f = int(0.01 * sr)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def key_of(ref, text, ex):
    return hashlib.sha1(f'{os.path.basename(ref)}|{text}|{ex:.2f}|v2'.encode()).hexdigest()[:12]


def record(jobs):
    os.makedirs(CLIPS, exist_ok=True)
    jobs = sorted(jobs, key=lambda j: (j['ref'], j['ex']))   # fewer voice changes
    for n, j in enumerate(jobs):
        wav = os.path.join(CLIPS, j['id'] + '.wav')
        if os.path.exists(wav) and not j.get('out'):
            continue
        x = None
        for attempt in range(3):
            try:
                x, sr = speak(j['ref'], j['text'], j['ex'], 11 + n * 101)
                break
            except RuntimeError as e:   # the GPU's memory fills up now and then on a busy Mac: free it and try again
                print(f'   {str(e)[:80]}; retrying', flush=True)
                import gc
                import time
                gc.collect()
                import torch
                if torch.backends.mps.is_available():
                    torch.mps.empty_cache()
                time.sleep(20)
        if x is None:
            print(f'   skipped: {j["text"]}', flush=True)
            continue
        y = finish(x, sr, j['ex'])
        sf.write(j.get('out') or wav, y, sr)
        print(f'{n + 1:4d}/{len(jobs)} {len(y) / sr:5.2f}s  {j["text"]}', flush=True)


def load_script():
    s = json.load(open(SCRIPT))
    refs = {who: os.path.join(V, 'refs', v['ref'] + '.wav') for who, v in s['voices'].items()}
    jobs, calls = [], {}
    for key, lines in s['calls'].items():
        calls[key] = []
        for ln in lines:
            ref = refs[ln['who']]
            cid = key_of(ref, ln['text'], ln['ex'])
            jobs.append({'id': cid, 'ref': ref, 'text': ln['text'], 'ex': ln['ex']})
            calls[key].append((cid, ln['who'], ln['text']))
    return jobs, calls


def pack(calls):
    """every clip as its own small m4a, end to end in one file; the index gives each call its clips"""
    out = open(os.path.join(ROOT, 'audio', 'vo.pack'), 'wb')
    pos, index, done = 0, {}, {}
    tmp = os.path.join(V, 'tmp.m4a')
    for key, clips in calls.items():
        index[key] = []
        for cid, who, text in clips:
            if cid not in done:
                wav = os.path.join(CLIPS, cid + '.wav')
                if not os.path.exists(wav):
                    continue
                for tries in range(3):   # afconvert now and then dies on a clip for no reason; it works the next time
                    r = subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '32000', '-c', '1', wav, tmp])
                    if r.returncode == 0:
                        break
                else:
                    raise RuntimeError(f'afconvert failed on {wav}')
                data = open(tmp, 'rb').read()
                out.write(data)
                secs = sf.info(wav).duration
                done[cid] = [pos, len(data), round(secs, 2)]
                pos += len(data)
            index[key].append(done[cid] + [who, text])
    out.close()
    with open(os.path.join(ROOT, 'js', 'vo.js'), 'w') as f:
        f.write('/* Generated by tools/voice.py: the booth\'s calls. Each clip: [offset, bytes, seconds, who, words]. */\n')
        f.write('window.PS = window.PS || {};\nPS.VO = ' + json.dumps(index, separators=(',', ':')) + ';\n')
    print(f'{len(done)} clips, {pos // 1024} kB -> audio/vo.pack')


def main():
    if '--jobs' in sys.argv:
        spec = json.load(open(sys.argv[sys.argv.index('--jobs') + 1]))
        s = json.load(open(SCRIPT)) if os.path.exists(SCRIPT) else {'voices': {}}
        jobs = []
        for j in spec['jobs']:
            ref = j['ref'] if 'ref' in j else os.path.join(V, 'refs', s['voices'][j['who']]['ref'] + '.wav')
            jobs.append({'id': key_of(ref, j['text'], j['ex']), 'ref': ref, 'text': j['text'], 'ex': j['ex'], 'out': j['out']})
        record(jobs)
        return
    jobs, calls = load_script()
    if '--pack' not in sys.argv:
        record(jobs)
    pack(calls)


if __name__ == '__main__':
    main()
