#!/usr/bin/env python3
"""Pack authored full frames, retaining full-color RGB and a binary alpha.

Follows Pixel Game Asset Skills' shared-scale/baseline and lossless APNG
contracts. No body parts are warped, synthesized or mirrored within a gait.
"""
from pathlib import Path
import hashlib
import json
import base64
from collections import deque
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'design/animation-refresh'
SIZE, BASELINE = 128, 118
ORDER = ['contact-a', 'passing-a', 'contact-b', 'passing-b', 'idle',
         'rise', 'fall', 'land', 'dash', 'anticipation', 'strike', 'recovery']


def remove_cell_bleed(frame):
    """Discard small isolated fragments of a neighboring grid cell.

    Preserve floating accessories: only a border fragment or subpixel speck
    separated by eight transparent source pixels can qualify. The main body,
    connected weapons and substantial interior islands remain intact.
    """
    width, height = frame.size
    alpha = bytearray(frame.getchannel('A').tobytes())
    total = sum(bool(a) for a in alpha)
    seeds = (i for i, value in enumerate(alpha) if value)
    visited = set()
    fragments = []
    for seed in seeds:
        if not alpha[seed] or seed in visited:
            continue
        component, queue = [], deque([seed])
        visited.add(seed)
        while queue:
            index = queue.popleft()
            component.append(index)
            x, y = index % width, index // width
            neighbors = ([index - 1] if x else []) + ([index + 1] if x + 1 < width else [])
            neighbors += ([index - width] if y else []) + ([index + width] if y + 1 < height else [])
            for neighbor in neighbors:
                if alpha[neighbor] and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        if len(component) >= total * .05:
            continue
        if len(component) > 16 and not any(i < width or i >= (height - 1) * width or i % width in (0, width - 1) for i in component):
            continue
        fragments.append(component)
    if sum(map(len, fragments)) >= total * .05:
        return frame
    candidate = alpha.copy()
    for component in fragments:
        for index in component:
            candidate[index] = 0
    remaining = Image.frombytes('L', frame.size, bytes(candidate)).getbbox()
    if remaining is None:
        return frame
    for component in fragments:
        xs, ys = [i % width for i in component], [i // width for i in component]
        if max(remaining[0] - max(xs) - 1, min(xs) - remaining[2],
               remaining[1] - max(ys) - 1, min(ys) - remaining[3]) >= 8:
            for index in component:
                alpha[index] = 0
    frame.putalpha(Image.frombytes('L', frame.size, bytes(alpha)))
    return frame


def cells(path, cols, rows):
    image = Image.open(path).convert('RGBA')
    frames = []
    for y in range(rows):
        for x in range(cols):
            frame = image.crop((x * image.width // cols, y * image.height // rows,
                                (x + 1) * image.width // cols, (y + 1) * image.height // rows))
            frame.putalpha(frame.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
            frame = remove_cell_bleed(frame)
            box = frame.getbbox()
            if box is None:
                raise ValueError(f'Empty frame: {path} {x},{y}')
            frames.append(frame.crop(box))
    return frames


def pack_character(character, source_format, motion):
    if source_format in ('split', 'walk-override'):
        action_suffix = 'actions' if source_format == 'split' else 'atlas'
        sources = [ART / 'source' / f'{character}-walk.png', ART / 'source' / f'{character}-{action_suffix}.png']
        subjects = cells(sources[0], 2, 2) + cells(sources[1], 4, 3)[4:]
        walk_factor = max(f.height for f in subjects[4:]) / max(f.height for f in subjects[:4])
        subjects[:4] = [frame.resize((round(frame.width * walk_factor), round(frame.height * walk_factor)), Image.Resampling.LANCZOS) for frame in subjects[:4]]
    else:
        sources = [ART / 'source' / f'{character}-atlas.png']
        subjects = cells(sources[0], 4, 3)
    scale = min(108 / max(f.height for f in subjects), 116 / max(f.width for f in subjects))
    frames = []
    for subject in subjects:
        frame = Image.new('RGBA', (SIZE, SIZE))
        resized = subject.resize((max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.Resampling.LANCZOS)
        resized.putalpha(resized.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
        # Resampling can leave a fully transparent last row. Anchor the
        # resulting opaque feet, rather than that discarded padding.
        resized = resized.crop(resized.getbbox())
        opaque = sum(bool(a) for a in resized.getchannel('A').get_flattened_data())
        assert opaque < resized.width * resized.height * .95, f'{character}: opaque rectangular background in pose {len(frames)}'
        frame.alpha_composite(resized, ((SIZE - resized.width) // 2, BASELINE - resized.height))
        box = frame.getbbox()
        assert box and box[0] > 0 and box[1] > 0 and box[2] < SIZE and box[3] == BASELINE, f'Invalid frame bounds: {box}'
        assert set(frame.getchannel('A').get_flattened_data()) <= {0, 255}
        frames.append(frame)
    # Anchor the head during locomotion. Centering the entire silhouette
    # follows the leading boot/weapon and makes the torso slide sideways.
    heads = [f.crop((0, 0, SIZE, 50)).getbbox() for f in frames[:4]]
    assert all(heads), 'Walk frames must retain the expected head region'
    anchor = (heads[0][0] + heads[0][2]) / 2
    for i, head in enumerate(heads):
        dx = round(anchor - (head[0] + head[2]) / 2)
        # Ghosts have no planted foot: keep their heads stable while the
        # spectral tail changes length, rather than pinning its tip down.
        dy = heads[0][1] - head[1] if motion == 'glide' else 0
        box = frames[i].getbbox()
        assert box[0] + dx > 0 and box[2] + dx < SIZE, 'Head alignment must not clip the sprite'
        assert box[1] + dy > 0 and box[3] + dy < SIZE, 'Glide alignment must not clip the tail'
        aligned = Image.new('RGBA', (SIZE, SIZE))
        aligned.alpha_composite(frames[i], (dx, dy))
        frames[i] = aligned
    contact_a = set(i for i, a in enumerate(frames[0].getchannel('A').get_flattened_data()) if a)
    contact_b = set(i for i, a in enumerate(frames[2].getchannel('A').get_flattened_data()) if a)
    iou = len(contact_a & contact_b) / len(contact_a | contact_b)
    assert iou >= .85, f'{character}: contact silhouette stability failed: {iou:.3f}'
    boxes = [f.getbbox() for f in frames[:4]]
    assert max(b[0] for b in boxes) - min(b[0] for b in boxes) <= SIZE * .065, f'Horizontal drift: {boxes}'
    assert max(b[1] for b in boxes) - min(b[1] for b in boxes) <= SIZE * .035, f'Vertical drift: {boxes}'
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
    entry = 'data:image/png;base64,' + base64.b64encode((target / 'spritesheet.png').read_bytes()).decode()
    evidence = {'frames': ORDER, 'frameSize': SIZE, 'baseline': BASELINE, 'motion': motion,
        'sourceSha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
        'bounds': [list(f.getbbox()) for f in frames], 'contactSilhouetteIoU': iou,
        'alpha': [0, 255], 'paletteReduction': False}
    return entry, evidence


def main():
    entries, evidence, failures = {}, {}, {}
    roster = json.loads((ART / 'roster.json').read_text())
    for character in roster:
        try:
            entry, report = pack_character(character['id'], character['source'], character['motion'])
            entries[character['id']] = entry
            evidence[character['id']] = report
            print(f"PASS {character['id']}: contact IoU {report['contactSilhouetteIoU']:.3f}")
        except (AssertionError, ValueError, FileNotFoundError) as error:
            failures[character['id']] = str(error) or 'geometry validation failed'
    if failures:
        raise SystemExit(json.dumps(failures, indent=2))

    (ART / 'packing-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    (ART / 'preview-roster.js').write_text('// Generated roster for the standalone review page.\nwindow.animationRoster = ' + json.dumps([[c['id'], c['name']] for c in roster]) + ';\n')
    (ROOT / 'src/game/rendering/character-animation-data.ts').write_text(
        '// Generated by scripts/build-character-animations.py. Full authored poses.\n' +
        'export const CHARACTER_ANIMATIONS: Record<string, string> = ' + json.dumps(entries, indent=2) + ';\n')
    print(f'Packed {len(entries)} characters × 12 poses; binary alpha, baseline and frame boundaries checked.')


if __name__ == '__main__':
    main()
