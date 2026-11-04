#!/usr/bin/env python3
"""Pack authored full frames, retaining full-color RGB and a binary alpha.

Follows Pixel Game Asset Skills' shared-scale/baseline and lossless APNG
contracts. No body parts are warped, synthesized or mirrored within a gait.
"""
from pathlib import Path
import hashlib
import json
import base64
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'design/animation-refresh'
SIZE, BASELINE = 128, 118
ORDER = ['contact-a', 'passing-a', 'contact-b', 'passing-b', 'idle',
         'rise', 'fall', 'land', 'dash', 'anticipation', 'strike', 'recovery']


def cells(path, cols, rows):
    image = Image.open(path).convert('RGBA')
    frames = []
    for y in range(rows):
        for x in range(cols):
            frame = image.crop((x * image.width // cols, y * image.height // rows,
                                (x + 1) * image.width // cols, (y + 1) * image.height // rows))
            frame.putalpha(frame.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
            box = frame.getbbox()
            if box is None:
                raise ValueError(f'Empty frame: {path} {x},{y}')
            frames.append(frame.crop(box))
    return frames


entries, evidence = {}, {}
for character in ['knight', 'ninja', 'cherry']:
    sources = [ART / 'source' / f'{character}-walk.png', ART / 'source' / f'{character}-actions.png']
    # Walk is a separately generated complete 2x2 cycle; reject the repeated
    # leading-leg walk in row one of the initial action study.
    subjects = cells(sources[0], 2, 2) + cells(sources[1], 4, 3)[4:]
    # Use a single scale for the action study. Walk sheets can have a different
    # source resolution, so first match their standing body height to the study.
    walk_height = max(frame.height for frame in subjects[:4])
    action_height = max(frame.height for frame in subjects[4:])
    walk_factor = action_height / walk_height
    subjects[:4] = [frame.resize((round(frame.width * walk_factor), round(frame.height * walk_factor)), Image.Resampling.LANCZOS) for frame in subjects[:4]]
    scale = min(108 / max(f.height for f in subjects), 116 / max(f.width for f in subjects))
    frames = []
    for subject in subjects:
        frame = Image.new('RGBA', (SIZE, SIZE))
        resized = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.Resampling.LANCZOS)
        resized.putalpha(resized.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        frame.alpha_composite(resized, ((SIZE - resized.width) // 2, BASELINE - resized.height))
        box = frame.getbbox()
        assert box and box[0] > 0 and box[1] > 0 and box[2] < SIZE and box[3] == BASELINE
        assert set(frame.getchannel('A').get_flattened_data()) <= {0, 255}
        frames.append(frame)
    # Anchor the head during locomotion. Centering the entire silhouette
    # follows the leading boot/weapon and makes the torso slide sideways.
    heads = [f.crop((0, 0, SIZE, 50)).getbbox() for f in frames[:4]]
    assert all(heads), 'Walk frames must retain the expected head region'
    anchor = (heads[0][0] + heads[0][2]) / 2
    for i, head in enumerate(heads):
        dx = round(anchor - (head[0] + head[2]) / 2)
        box = frames[i].getbbox()
        assert box[0] + dx > 0 and box[2] + dx < SIZE, 'Head alignment must not clip the sprite'
        aligned = Image.new('RGBA', (SIZE, SIZE))
        aligned.alpha_composite(frames[i], (dx, 0))
        frames[i] = aligned
    contact_a = set(i for i, a in enumerate(frames[0].getchannel('A').get_flattened_data()) if a)
    contact_b = set(i for i, a in enumerate(frames[2].getchannel('A').get_flattened_data()) if a)
    iou = len(contact_a & contact_b) / len(contact_a | contact_b)
    assert iou >= .85, f'{character}: contact silhouette stability failed: {iou:.3f}'
    boxes = [f.getbbox() for f in frames[:4]]
    assert max(b[0] for b in boxes) - min(b[0] for b in boxes) <= SIZE * .065
    assert max(b[1] for b in boxes) - min(b[1] for b in boxes) <= SIZE * .035
    assert len({f.tobytes() for f in frames[:4]}) == 4, 'Walk requires four distinct authored frames'
    sheet = Image.new('RGBA', (SIZE * len(frames), SIZE))
    target = ART / character
    target.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(frames):
        sheet.alpha_composite(frame, (i * SIZE, 0))
        frame.save(target / f'{ORDER[i]}.png')
    sheet.save(target / 'spritesheet.png')
    for direction in ['right', 'left']:
        loop = frames[:4] if direction == 'right' else [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames[:4]]
        loop[0].save(target / f'walk-{direction}.png', save_all=True, append_images=loop[1:], duration=[150, 110, 150, 110], loop=0, disposal=0, blend=0)
    entries[character] = 'data:image/png;base64,' + base64.b64encode((target / 'spritesheet.png').read_bytes()).decode()
    evidence[character] = {'frames': ORDER, 'frameSize': SIZE, 'baseline': BASELINE,
        'sourceSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
        'bounds': [list(f.getbbox()) for f in frames], 'contactSilhouetteIoU': iou,
        'alpha': [0, 255], 'paletteReduction': False}

(ART / 'packing-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
(ROOT / 'src/game/rendering/character-animation-data.ts').write_text(
    '// Generated by scripts/build-character-animations.py. Full authored poses.\n' +
    'export const CHARACTER_ANIMATIONS: Record<string, string> = ' + json.dumps(entries, indent=2) + ';\n')
print('Packed 3 characters × 12 poses; binary alpha, baseline and frame boundaries checked.')
