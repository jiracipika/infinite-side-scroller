#!/usr/bin/env python3
"""Regression checks for source-sheet cleanup; requires Pillow."""
import importlib.util
from pathlib import Path
import unittest
import tempfile
from unittest.mock import patch
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('packing', Path(__file__).with_name('build-character-animations.py'))
packing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packing)


class CellBleedTests(unittest.TestCase):
    def subject(self):
        frame = Image.new('RGBA', (100, 100))
        ImageDraw.Draw(frame).rectangle((20, 10, 80, 75), fill='white')
        return frame

    def test_neighbor_fragment_and_adjacent_speck_are_removed_together(self):
        frame = self.subject()
        draw = ImageDraw.Draw(frame)
        draw.rectangle((40, 95, 50, 99), fill='red')
        draw.point((38, 94), fill='red')
        self.assertEqual(packing.remove_cell_bleed(frame).getchannel('A').tobytes(), self.subject().getchannel('A').tobytes())

    def test_connected_weapon_reaching_border_is_preserved(self):
        frame = self.subject()
        ImageDraw.Draw(frame).rectangle((0, 30, 25, 33), fill='red')
        expected = frame.tobytes()
        self.assertEqual(packing.remove_cell_bleed(frame).tobytes(), expected)

    def test_interior_floating_accessory_is_preserved(self):
        frame = self.subject()
        ImageDraw.Draw(frame).rectangle((35, 88, 45, 92), fill='red')
        expected = frame.tobytes()
        self.assertEqual(packing.remove_cell_bleed(frame).tobytes(), expected)

    def test_border_detail_close_to_subject_is_preserved(self):
        frame = self.subject()
        ImageDraw.Draw(frame).rectangle((18, 0, 20, 6), fill='red')
        expected = frame.tobytes()
        self.assertEqual(packing.remove_cell_bleed(frame).tobytes(), expected)

    def test_opaque_source_sheet_is_rejected_before_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'source').mkdir()
            Image.new('RGBA', (400, 300), 'white').save(root / 'source/fixture-atlas.png')
            with patch.object(packing, 'ART', root):
                with self.assertRaisesRegex(AssertionError, 'opaque rectangular background'):
                    packing.pack_character('fixture', 'atlas', 'walk')
            self.assertFalse((root / 'fixture').exists())


if __name__ == '__main__':
    unittest.main()
